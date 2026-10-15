/**
 * StudyPilot - Top Navigation Bar
 * Implements the Top Bar Contract with Global Search (Cmd+K),
 * Display settings and upload/search shortcuts.
 */

import React, { useState } from 'react';
import { LogIn, LogOut, Search, Flame, Moon, Sun, Menu, UploadCloud } from 'lucide-react';
import { useAppStore } from '../../store/useStore';

interface NavbarProps {
  store: ReturnType<typeof useAppStore>;
  onOpenSearch: () => void;
  onOpenNavigation: () => void;
  onNavigateToIngestion: () => void;
  isGuest: boolean;
  isAuthenticated: boolean;
  onOpenAuth: () => void;
  onSignOut: () => Promise<void>;
}

export const Navbar: React.FC<NavbarProps> = ({ store, onOpenSearch, onOpenNavigation, onNavigateToIngestion, isGuest, isAuthenticated, onOpenAuth, onSignOut }) => {
  const [signOutError, setSignOutError] = useState('');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const {
    isDarkMode,
    setIsDarkMode,
    learnerProfile,
    course,
  } = store;

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
        <div className="hidden sm:flex items-center gap-2 pl-1">
          {learnerProfile.avatar_url ? (
            <img
              src={learnerProfile.avatar_url}
              alt={learnerProfile.student_name}
              referrerPolicy="no-referrer"
              className="w-7 h-7 rounded-full object-cover ring-2 ring-indigo-500/30"
            />
          ) : (
            <span className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200 text-xs font-bold flex items-center justify-center ring-2 ring-indigo-500/30">
              {learnerProfile.student_name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
      </div>
    </header>
  );
};
