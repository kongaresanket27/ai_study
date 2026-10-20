/**
 * StudyPilot - Top Navigation Bar
 * Implements the Top Bar Contract with Global Search (Cmd+K),
 * Display settings and upload/search shortcuts.
 */

import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, CircleUserRound, Clock3, LogIn, LogOut, Search, Flame, Moon, Sun, Menu, UploadCloud, X } from 'lucide-react';
import { useAppStore } from '../../store/useStore';

interface NavbarProps {
  store: ReturnType<typeof useAppStore>;
  onOpenSearch: () => void;
  onOpenNavigation: () => void;
  onNavigateToIngestion: () => void;
  isGuest: boolean;
  isAuthenticated: boolean;
  accountEmail?: string;
  onOpenAuth: () => void;
  onSignOut: () => Promise<void>;
}

export const Navbar: React.FC<NavbarProps> = ({ store, onOpenSearch, onOpenNavigation, onNavigateToIngestion, isGuest, isAuthenticated, accountEmail, onOpenAuth, onSignOut }) => {
  const [signOutError, setSignOutError] = useState('');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const {
    isDarkMode,
    setIsDarkMode,
    learnerProfile,
    course,
  } = store;

  useEffect(() => {
    if (!isProfileOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !profileRef.current?.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsProfileOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isProfileOpen]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setSignOutError('');
    try {
      await onSignOut();
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : 'Could not sign out. Please try again.');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <header className="h-16 px-6 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-between gap-4 sticky top-0 z-30 transition-colors">
      {/* Zone 1: Brand & Course Context */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3 shrink-0">
        <button
          type="button"
          onClick={onOpenNavigation}
          aria-label="Open navigation menu"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 sm:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center text-white font-bold text-base shadow-sm shadow-indigo-500/20">
            S
          </div>
          <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
            StudyPilot
          </span>
        </div>
        <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 hidden lg:inline truncate max-w-xs">
          {[course.code, course.title].filter(Boolean).join(': ') || 'Upload study materials to get started'}
        </span>
      </div>

      {/* Zone 2: Global Search Affordance */}
      <div className="flex-1 max-w-md hidden md:flex items-center justify-center">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-3.5 py-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-100/80 dark:bg-slate-900/80 hover:bg-slate-200/70 dark:hover:bg-slate-800/80 rounded-lg border border-slate-200/80 dark:border-slate-800 transition-all cursor-pointer shadow-inner"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span>Search topics, slide concepts, video timestamps...</span>
          </div>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-xs">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Zone 3: Interactive Controls & User Metrics */}
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5 shrink-0">
        {isGuest && (
          <button type="button" onClick={onOpenAuth} className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/50 sm:inline-flex">
            <LogIn className="h-4 w-4" />
            <span>Sign in</span>
          </button>
        )}
        {isAuthenticated && (
          <button type="button" onClick={() => void handleSignOut()} disabled={isSigningOut} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">{isSigningOut ? 'Signing out…' : 'Sign out'}</span>
          </button>
        )}
        {signOutError && <span role="alert" className="text-xs text-rose-600 dark:text-rose-400">{signOutError}</span>}
        <button
          type="button"
          onClick={onNavigateToIngestion}
          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
        >
          <UploadCloud className="h-4 w-4" />
          <span className="hidden sm:inline">Upload</span>
        </button>
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Search uploaded materials"
          title="Search uploaded materials (Ctrl+K)"
          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
        >
          <Search className="h-4 w-4" />
        </button>
        {/* Dark / Light Toggle */}
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors cursor-pointer"
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* Learner Streak Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200/60 dark:border-amber-900/50">
          <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500 animate-pulse" />
          <span>{learnerProfile.current_streak_days}d</span>
        </div>

        {/* User Profile Avatar */}
        <div ref={profileRef} className="relative flex items-center pl-1">
          <button
            type="button"
            onClick={() => setIsProfileOpen((isOpen) => !isOpen)}
            aria-label="Open your profile"
            aria-haspopup="dialog"
            aria-expanded={isProfileOpen}
            aria-controls="learner-profile-panel"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:hover:bg-slate-800"
          >
            {learnerProfile.avatar_url ? (
              <img
                src={learnerProfile.avatar_url}
                alt=""
                referrerPolicy="no-referrer"
                className="h-7 w-7 rounded-full object-cover ring-2 ring-indigo-500/30"
              />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 ring-2 ring-indigo-500/30 dark:bg-indigo-900 dark:text-indigo-200">
                {learnerProfile.student_name.slice(0, 1).toUpperCase() || <CircleUserRound className="h-4 w-4" />}
              </span>
            )}
          </button>
          {isProfileOpen && (
            <section
              id="learner-profile-panel"
              role="dialog"
              aria-label="Your profile"
              className="absolute right-0 top-full z-50 mt-3 w-[min(20rem,calc(100vw-1rem))] rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {learnerProfile.avatar_url ? (
                    <img
                      src={learnerProfile.avatar_url}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-10 w-10 rounded-full object-cover ring-2 ring-indigo-500/30"
                    />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200">
                      {learnerProfile.student_name.slice(0, 1).toUpperCase() || <CircleUserRound className="h-5 w-5" />}
                    </span>
                  )}
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold">{learnerProfile.student_name || 'Student'}</h2>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {isAuthenticated ? accountEmail || 'Signed-in account' : 'Guest workspace'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsProfileOpen(false)}
                  aria-label="Close profile"
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="my-4 border-t border-slate-200 dark:border-slate-700" />
              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
                  <dt className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <Flame className="h-3.5 w-3.5 text-amber-500" /> Current streak
                  </dt>
                  <dd className="mt-1 font-semibold">{learnerProfile.current_streak_days} days</dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
                  <dt className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <BookOpen className="h-3.5 w-3.5 text-indigo-500" /> Course topics
                  </dt>
                  <dd className="mt-1 font-semibold">{course.topics.length}</dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
                  <dt className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <Clock3 className="h-3.5 w-3.5 text-cyan-500" /> Study this week
                  </dt>
                  <dd className="mt-1 font-semibold">
                    {learnerProfile.completed_hours_this_week} / {learnerProfile.weekly_goal_hours} hours
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
                  <dt className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <BookOpen className="h-3.5 w-3.5 text-emerald-500" /> Quizzes completed
                  </dt>
                  <dd className="mt-1 font-semibold">{learnerProfile.total_quizzes_taken}</dd>
                </div>
              </dl>
              {isAuthenticated ? (
                <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">Your profile stats are saved in this browser workspace.</p>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    onOpenAuth();
                  }}
                  className="mt-4 w-full rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  Create an account to sign in
                </button>
              )}
            </section>
          )}
        </div>
      </div>
    </header>
  );
};
