export type AuthMode = 'sign-in' | 'sign-up';

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  displayName?: string;
}

async function readResponse(response: Response): Promise<Record<string, unknown>> {
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error(
      'The sign-in service is unavailable at this address. Start StudyPilot with `npm run dev` and open the URL printed in the terminal.',
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('The sign-in service returned an invalid response. Restart StudyPilot and try again.');
  }
  if (typeof payload !== 'object' || payload === null) return {};
  return payload as Record<string, unknown>;
}

export async function authenticate(
  mode: AuthMode,
  email: string,
  password: string,
): Promise<AuthResult> {
  const response = await fetch(`/api/auth/${mode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  const payload = await readResponse(response);
  if (!response.ok || payload.authenticated !== true) {
    throw new Error(typeof payload.error === 'string' ? payload.error : 'We could not sign you in. Check your details and try again.');
  }

  if (typeof payload.userId !== 'string' || !payload.userId) {
    throw new Error('The sign-in response did not include an account identifier. Please try again.');
  }

  return {
    authenticated: true,
    userId: payload.userId,
    displayName: typeof payload.displayName === 'string' ? payload.displayName : undefined,
  };
}

export async function getCurrentSession(): Promise<AuthResult> {
  const response = await fetch('/api/auth/session', { credentials: 'include' });
  const payload = await readResponse(response);
  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : 'Could not check your sign-in session.');
  }
  return {
    authenticated: payload.authenticated === true,
    userId: typeof payload.userId === 'string' ? payload.userId : undefined,
    displayName: typeof payload.displayName === 'string' ? payload.displayName : undefined,
  };
}

export async function signOut(): Promise<void> {
  const response = await fetch('/api/auth/sign-out', {
    method: 'POST',
    credentials: 'include',
  });
  const payload = await readResponse(response);
  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : 'Could not sign out. Please try again.');
  }
}
