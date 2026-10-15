import { mkdirSync } from 'node:fs';
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import type { Express, Request, RequestHandler, Response } from 'express';

const COOKIE_NAME = 'studypilot_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
const PASSWORD_HASH_BYTES = 64;
const SCRYPT_OPTIONS = { N: 32_768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const SIGN_IN_WINDOW_MS = 15 * 60 * 1000;
const SIGN_IN_MAX_ATTEMPTS = 10;
const databasePath = path.resolve(
  process.env.STUDYPILOT_DB_PATH || path.join(process.cwd(), 'data', 'studypilot.sqlite'),
);

mkdirSync(path.dirname(databasePath), { recursive: true });

const database = new DatabaseSync(databasePath);
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
`);

interface UserRecord {
  id: string;
  email: string;
  password_salt: string;
  password_hash: string;
}

interface SessionUserRecord {
  id: string;
  email: string;
}

const signInFailures = new Map<string, { count: number; resetAt: number }>();
const signUpAttempts = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: Request): string {
  return request.ip || request.socket.remoteAddress || 'unknown';
}

function pruneExpiredAttempts(now: number): void {
  for (const attemptsByIp of [signInFailures, signUpAttempts]) {
    for (const [ip, attempts] of attemptsByIp) {
      if (attempts.resetAt <= now) attemptsByIp.delete(ip);
    }
  }
}

const limitSignInAttempts: RequestHandler = (request, response, next) => {
  const now = Date.now();
  pruneExpiredAttempts(now);
  const attempts = signInFailures.get(getClientIp(request));
  if (attempts && attempts.count >= SIGN_IN_MAX_ATTEMPTS && attempts.resetAt > now) {
    response.setHeader('Retry-After', String(Math.ceil((attempts.resetAt - now) / 1000)));
    response.status(429).json({ error: 'Too many sign-in attempts. Please wait a few minutes and try again.' });
    return;
  }

  next();
};

const limitSignUpAttempts: RequestHandler = (request, response, next) => {
  const now = Date.now();
  pruneExpiredAttempts(now);
  const ip = getClientIp(request);
  const attempts = signUpAttempts.get(ip);
  if (attempts && attempts.count >= SIGN_IN_MAX_ATTEMPTS && attempts.resetAt > now) {
    response.setHeader('Retry-After', String(Math.ceil((attempts.resetAt - now) / 1000)));
    response.status(429).json({ error: 'Too many account-creation attempts. Please wait a few minutes and try again.' });
    return;
  }

  if (!attempts || attempts.resetAt <= now) {
    signUpAttempts.set(ip, { count: 1, resetAt: now + SIGN_IN_WINDOW_MS });
  } else {
    attempts.count += 1;
  }
  next();
};

function recordFailedSignIn(request: Request): void {
  const now = Date.now();
  const ip = getClientIp(request);
  const attempts = signInFailures.get(ip);
  if (!attempts || attempts.resetAt <= now) {
    signInFailures.set(ip, { count: 1, resetAt: now + SIGN_IN_WINDOW_MS });
  } else {
    attempts.count += 1;
  }
}

function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function getSessionToken(request: Request): string | undefined {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return undefined;

  const sessionCookie = cookieHeader.split(';').map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${COOKIE_NAME}=`));
  return sessionCookie?.slice(COOKIE_NAME.length + 1);
}

function setSessionCookie(response: Response, request: Request, token: string): void {
  const secure = process.env.NODE_ENV === 'production' || request.secure;
  response.append('Set-Cookie', [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    ...(secure ? ['Secure'] : []),
  ].join('; '));
}

function clearSessionCookie(response: Response, request: Request): void {
  const secure = process.env.NODE_ENV === 'production' || request.secure;
  response.append('Set-Cookie', [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    ...(secure ? ['Secure'] : []),
  ].join('; '));
}

function displayNameForEmail(email: string): string {
  return email.slice(0, email.lastIndexOf('@'));
}

async function derivePasswordHash(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, PASSWORD_HASH_BYTES, SCRYPT_OPTIONS, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

function createSession(userId: string, request: Request, response: Response): string {
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  const expiresAt = now + SESSION_MAX_AGE_SECONDS * 1000;

  database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
  database.prepare(
    'INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
  ).run(hashSessionToken(token), userId, expiresAt, now);

  setSessionCookie(response, request, token);
  return token;
}

export function registerLocalAuthRoutes(app: Express): void {
  app.post('/api/auth/sign-up', limitSignUpAttempts, async (request, response) => {
    const { email, password } = request.body ?? {};
    if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim()) || email.trim().length > 254) {
      return response.status(400).json({ error: 'Enter a valid email address.' });
    }
    if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 512) {
      return response.status(400).json({ error: 'Use a password of at least 8 characters.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    try {
      const salt = randomBytes(16);
      const passwordHash = await derivePasswordHash(password, salt);
      const userId = randomUUID();
      database.prepare(
        'INSERT INTO users (id, email, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
      ).run(userId, normalizedEmail, salt.toString('hex'), passwordHash.toString('hex'), Date.now());

      createSession(userId, request, response);
      return response.status(201).json({
        authenticated: true,
        userId,
        displayName: displayNameForEmail(normalizedEmail),
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'errcode' in error &&
          (error.errcode === 2067 || error.errcode === 1555)) {
        return response.status(409).json({ error: 'An account with this email already exists. Sign in instead.' });
      }
      console.error('Local account creation failed:', error);
      return response.status(500).json({ error: 'We could not create your account. Please try again.' });
    }
  });

  app.post('/api/auth/sign-in', limitSignInAttempts, async (request, response) => {
    const { email, password } = request.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string' ||
        !/^\S+@\S+\.\S+$/.test(email.trim()) || email.trim().length > 254 ||
        password.length < 8 || Buffer.byteLength(password, 'utf8') > 512) {
      return response.status(400).json({ error: 'Enter a valid email and password.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = database.prepare(
      'SELECT id, email, password_salt, password_hash FROM users WHERE email = ? COLLATE NOCASE',
    ).get(normalizedEmail) as UserRecord | undefined;

    try {
      const salt = user ? Buffer.from(user.password_salt, 'hex') : randomBytes(16);
      const actualHash = await derivePasswordHash(password, salt);
      const expectedHash = user ? Buffer.from(user.password_hash, 'hex') : Buffer.alloc(PASSWORD_HASH_BYTES);
      const passwordMatches = actualHash.length === expectedHash.length &&
        timingSafeEqual(actualHash, expectedHash);

      if (!user || !passwordMatches) {
        recordFailedSignIn(request);
        return response.status(401).json({ error: 'Email or password is incorrect.' });
      }

      signInFailures.delete(getClientIp(request));
      createSession(user.id, request, response);
      return response.json({
        authenticated: true,
        userId: user.id,
        displayName: displayNameForEmail(user.email),
      });
    } catch (error) {
      console.error('Local sign-in failed:', error);
      return response.status(500).json({ error: 'We could not sign you in. Please try again.' });
    }
  });

  app.get('/api/auth/session', (request, response) => {
    const token = getSessionToken(request);
    if (!token) return response.json({ authenticated: false });

    const user = database.prepare(`
      SELECT users.id, users.email
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > ?
    `).get(hashSessionToken(token), Date.now()) as SessionUserRecord | undefined;

    if (!user) {
      clearSessionCookie(response, request);
      return response.json({ authenticated: false });
    }

    return response.json({
      authenticated: true,
      userId: user.id,
      displayName: displayNameForEmail(user.email),
    });
  });

  app.post('/api/auth/sign-out', (request, response) => {
    const token = getSessionToken(request);
    if (token) {
      database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashSessionToken(token));
    }
    clearSessionCookie(response, request);
    return response.json({ authenticated: false });
  });
}
