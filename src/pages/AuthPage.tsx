import React, { useState } from 'react';
import { ArrowRight, BookOpen, Eye, EyeOff, Loader2, LockKeyhole, Mail, Sparkles } from 'lucide-react';
import { AuthMode, authenticate } from '../services/authProvider';

interface AuthPageProps {
  onContinueAsGuest: () => void;
  onAuthenticated: (userId: string, displayName?: string, email?: string) => void;
  initialError?: string;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onContinueAsGuest, onAuthenticated, initialError = '' }) => {
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(initialError);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError('');
    setConfirmPassword('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const normalizedEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }
    if (mode === 'sign-up' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await authenticate(mode, normalizedEmail, password);
      if (!result.userId) {
        throw new Error('The sign-in response did not include an account identifier. Please try again.');
      }
      onAuthenticated(result.userId, result.displayName, result.email);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not complete that request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:flex sm:items-center sm:justify-center sm:p-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-indigo-950/10 dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-cyan-600 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-xl font-black ring-1 ring-white/20">S</div>
            <p className="mt-8 text-sm font-semibold text-cyan-100">StudyPilot</p>
            <h1 className="mt-3 max-w-sm text-4xl font-black leading-tight">Your study space, built around your materials.</h1>
            <p className="mt-5 max-w-sm text-sm leading-6 text-indigo-100">Upload course content, ask cited questions, practice quizzes, and keep your review plan in one place.</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-indigo-100">
            <BookOpen className="h-5 w-5" />
            <span>Your current local study workspace stays on this device.</span>
          </div>
        </section>

        <section className="p-6 sm:p-10">
          <div className="mx-auto max-w-sm">
            <div className="flex items-center gap-2 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 font-black text-white">S</div>
              <span className="font-bold">StudyPilot</span>
            </div>
            <div className="mt-7 lg:mt-0">
              <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Welcome to StudyPilot</p>
              <h2 className="mt-2 text-2xl font-bold">{mode === 'sign-in' ? 'Sign in to your account' : 'Create your account'}</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{mode === 'sign-in' ? 'Continue where you left off.' : 'Save your learning space with an account.'}</p>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
              <div>
                <label htmlFor="auth-email" className="mb-1.5 block text-sm font-medium">Email address</label>
                <div className="relative"><Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input id="auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950" placeholder="you@example.com" required />
                </div>
              </div>
              <div>
                <label htmlFor="auth-password" className="mb-1.5 block text-sm font-medium">Password</label>
                <div className="relative"><LockKeyhole className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input id="auth-password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-11 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950" placeholder="At least 8 characters" required minLength={8} />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                </div>
              </div>
              {mode === 'sign-up' && <div>
                <label htmlFor="auth-confirm-password" className="mb-1.5 block text-sm font-medium">Confirm password</label>
                <input id="auth-confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950" placeholder="Repeat your password" required />
              </div>}
              {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
              <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isSubmitting ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
              </button>
            </form>
            <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">{mode === 'sign-in' ? 'New to StudyPilot?' : 'Already have an account?'} <button type="button" onClick={() => switchMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')} className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">{mode === 'sign-in' ? 'Create an account' : 'Sign in'}</button></p>
            <div className="my-6 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />or<span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" /></div>
            <button type="button" onClick={onContinueAsGuest} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><span>Continue without an account</span><ArrowRight className="h-4 w-4" /></button>
            <p className="mt-3 text-center text-xs leading-5 text-slate-400">Guest work stays in this browser and is not synced to an account.</p>
          </div>
        </section>
      </div>
    </main>
  );
};
