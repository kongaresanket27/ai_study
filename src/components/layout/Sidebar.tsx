/**
 * StudyPilot - Left Navigation Sidebar
 * Clean collapsible sidebar with domain navigation, active route glowing indicator,
 * and course status indicators.
 */

import React from 'react';
import {
  LayoutDashboard,
  BookOpen,
  MessageSquareText,
  BrainCircuit,
  GitFork,
  Calendar,
  Layers,
  UploadCloud,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'knowledge_base'
  | 'tutor_chat'
  | 'quizzes'
  | 'course_map'
  | 'study_plan'
  | 'revision'
  | 'ingestion';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean) => void;
  courseTitle: string;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
  courseTitle,
  isMobileOpen,
  onMobileClose,
}) => {
  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'knowledge_base' as NavTab, label: 'Courses', icon: BookOpen },
    { id: 'tutor_chat' as NavTab, label: 'Tutor Chat', icon: MessageSquareText },
    { id: 'quizzes' as NavTab, label: 'Quizzes', icon: BrainCircuit },
    { id: 'course_map' as NavTab, label: 'Course Flow Map', icon: GitFork },
    { id: 'study_plan' as NavTab, label: 'Study Planner', icon: Calendar },
    { id: 'revision' as NavTab, label: 'Revision Hub', icon: Layers },
    { id: 'ingestion' as NavTab, label: 'Upload Materials', icon: UploadCloud },
  ];

  return (
    <>
      {isMobileOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={onMobileClose}
          className="fixed inset-0 z-40 bg-slate-950/50 sm:hidden"
        />
      )}
      <aside
        aria-label="Main navigation"
        className={`fixed inset-y-16 left-0 z-50 h-[calc(100dvh-4rem)] overflow-hidden border-r border-slate-200 bg-slate-50 dark:border-slate-800/80 dark:bg-slate-950/90 flex flex-col shrink-0 transition-transform duration-200 sm:sticky sm:top-0 sm:z-20 sm:h-[calc(100vh-4rem)] sm:translate-x-0 sm:transition-all ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'
        } ${isCollapsed ? 'sm:w-16' : 'sm:w-64'} w-64`}
      >
      {/* Course Context Header */}
      <div className="p-4 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
        {(!isCollapsed || isMobileOpen) && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                Active Course
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {courseTitle}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-md transition-colors ml-auto"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span className="hidden sm:inline">
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </span>
          <span className="sm:hidden text-xs">Close</span>
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                onMobileClose();
              }}
              aria-current={isActive ? 'page' : undefined}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/20 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-900/60'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
              {(!isCollapsed || isMobileOpen) && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      </aside>
    </>
  );
};
