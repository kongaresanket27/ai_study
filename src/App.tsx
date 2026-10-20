/**
 * StudyPilot - Main Application Shell
 * @license Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAppStore } from './store/useStore';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { SourceViewerDrawer } from './components/modals/SourceViewerDrawer';
import { GlobalSearchModal } from './components/modals/GlobalSearchModal';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { KnowledgeBasePage } from './pages/KnowledgeBasePage';
import { TutorChatPage } from './pages/TutorChatPage';
import { QuizBuilderPage } from './pages/QuizBuilderPage';
import { QuizPlayerPage } from './pages/QuizPlayerPage';
import { QuizResultsPage } from './pages/QuizResultsPage';
import { CourseFlowMapPage } from './pages/CourseFlowMapPage';
import { StudyPlanPage } from './pages/StudyPlanPage';
import { RevisionHubPage } from './pages/RevisionHubPage';
import { IngestionPage } from './pages/IngestionPage';
import { LocalPythonPage } from './pages/LocalPythonPage';
import { AuthPage } from './pages/AuthPage';
import { Question, QuizSubmission } from './types';
import { getCurrentSession, signOut } from './services/authProvider';

const tabPaths: Record<NavTab, string> = {
  dashboard: '/dashboard',
  knowledge_base: '/courses',
  tutor_chat: '/tutor',
  quizzes: '/quizzes',
  course_map: '/course-map',
  study_plan: '/study-plan',
  revision: '/revision',
  ingestion: '/upload',
  local_python: '/local-python',
};

function getTabFromPath(pathname: string): NavTab | undefined {
  if (pathname === '/') return 'dashboard';
  return (Object.entries(tabPaths) as Array<[NavTab, string]>)
    .find(([, path]) => path === pathname)?.[0];
}

function createGuestWorkspaceId(): string {
  const workspaceId = crypto.randomUUID();
  try {
    sessionStorage.setItem('studypilot_guest_workspace_id_v1', workspaceId);
  } catch {
    // Guest access remains available for the current page if session storage is disabled.
  }
  return workspaceId;
}

function getGuestWorkspaceId(): string {
  try {
    const existingId = sessionStorage.getItem('studypilot_guest_workspace_id_v1');
    if (existingId) return existingId;
  } catch {
    return createGuestWorkspaceId();
  }
  return createGuestWorkspaceId();
}

export default function App() {
  const [accessMode, setAccessMode] = useState<'checking' | 'choose' | 'guest' | 'authenticated'>(() => {
    try {
      return sessionStorage.getItem('studypilot_access_mode_v1') === 'guest' ? 'guest' : 'checking';
    } catch {
      return 'checking';
    }
  });
  const [authError, setAuthError] = useState('');
  const [authenticatedUserId, setAuthenticatedUserId] = useState<string | null>(null);
  const [authenticatedDisplayName, setAuthenticatedDisplayName] = useState<string>();
  const [authenticatedEmail, setAuthenticatedEmail] = useState<string>();
  const [authSourceGuestWorkspaceId, setAuthSourceGuestWorkspaceId] = useState<string | null>(null);
  const [guestWorkspaceId, setGuestWorkspaceId] = useState(() =>
    accessMode === 'guest' ? getGuestWorkspaceId() : '',
  );
  const storageScope = accessMode === 'authenticated' && authenticatedUserId
    ? `user:${authenticatedUserId}`
    : accessMode === 'guest'
      ? `guest:${guestWorkspaceId}`
      : null;
  const store = useAppStore(storageScope);
  const {
    course,
    activeCitation,
    isDrawerOpen,
    closeDrawer,
    isSearchModalOpen,
    setIsSearchModalOpen,
    openCitation,
    applyQuizResultsToMastery,
  } = store;

  const [activeTab, setActiveTab] = useState<NavTab>(() =>
    getTabFromPath(window.location.pathname) || 'dashboard',
  );
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false);
  const [pendingTutorQuery, setPendingTutorQuery] = useState('');
  const [selectedKnowledgeTopicId, setSelectedKnowledgeTopicId] = useState<string | undefined>();

  // Active quiz state
  const [activeQuizQuestions, setActiveQuizQuestions] = useState<Question[] | null>(null);
  const [activeQuizTitle, setActiveQuizTitle] = useState<string>('');
  const [activeQuizIsTimed, setActiveQuizIsTimed] = useState<boolean>(false);
  const [lastSubmission, setLastSubmission] = useState<QuizSubmission | null>(null);
  const [preselectedQuizTopicId, setPreselectedQuizTopicId] = useState<string | undefined>(undefined);

  const navigateToTab = (tab: NavTab) => {
    const nextPath = tabPaths[tab];
    if (window.location.pathname !== nextPath) {
      window.history.pushState({ tab }, '', nextPath);
    }
    setActiveTab(tab);
  };

  useEffect(() => {
    const currentPath = window.location.pathname;
    const pathTab = getTabFromPath(currentPath);
    if (!pathTab) {
      window.history.replaceState({ tab: 'dashboard' }, '', tabPaths.dashboard);
      setActiveTab('dashboard');
    } else if (currentPath !== tabPaths[pathTab]) {
      window.history.replaceState({ tab: pathTab }, '', tabPaths[pathTab]);
    }

    const syncTabWithPath = () => {
      const tab = getTabFromPath(window.location.pathname);
      if (tab) {
        setActiveTab(tab);
        setActiveQuizQuestions(null);
        setLastSubmission(null);
      } else {
        window.history.replaceState({ tab: 'dashboard' }, '', tabPaths.dashboard);
        setActiveTab('dashboard');
      }
    };
    window.addEventListener('popstate', syncTabWithPath);
    return () => window.removeEventListener('popstate', syncTabWithPath);
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (accessMode === 'guest') return;

    getCurrentSession().then((session) => {
      if (!isMounted) return;
      if (session.authenticated && session.userId) {
        setAuthenticatedUserId(session.userId);
        setAuthenticatedDisplayName(session.displayName);
        setAuthenticatedEmail(session.email);
        setAccessMode('authenticated');
      } else if (session.authenticated) {
        setAuthError('Your sign-in session did not include an account identifier. Please sign in again.');
        setAccessMode('choose');
      } else {
        setAccessMode('choose');
      }
    }).catch((error: unknown) => {
      if (!isMounted) return;
      setAuthError(error instanceof Error ? error.message : 'Could not check your sign-in session.');
      setAccessMode('choose');
    });

    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (accessMode === 'authenticated' && authenticatedDisplayName && store.isStorageReady) {
      store.setLearnerProfile((current) => ({ ...current, student_name: authenticatedDisplayName }));
    }
  }, [accessMode, authenticatedDisplayName, store.isStorageReady]);

  useEffect(() => {
    setActiveQuizQuestions(null);
    setLastSubmission(null);
    setPendingTutorQuery('');
    setSelectedKnowledgeTopicId(undefined);
  }, [storageScope]);

  const continueAsGuest = () => {
    setAuthenticatedUserId(null);
    setAuthenticatedDisplayName(undefined);
    setAuthenticatedEmail(undefined);
    setGuestWorkspaceId(authSourceGuestWorkspaceId || createGuestWorkspaceId());
    setAuthSourceGuestWorkspaceId(null);
    try {
      sessionStorage.setItem('studypilot_access_mode_v1', 'guest');
    } catch {}
    setAccessMode('guest');
  };

  const handleAuthenticated = (userId: string, displayName?: string, email?: string) => {
    if (authSourceGuestWorkspaceId) {
      store.transferGuestWorkspaceToAccount(authSourceGuestWorkspaceId, userId);
      setAuthSourceGuestWorkspaceId(null);
    }
    setAuthError('');
    setAuthenticatedUserId(userId);
    setAuthenticatedDisplayName(displayName);
    setAuthenticatedEmail(email);
    try {
      sessionStorage.removeItem('studypilot_access_mode_v1');
    } catch {}
    setAccessMode('authenticated');
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setAuthError('');
      setAuthenticatedUserId(null);
      setAuthenticatedDisplayName(undefined);
      setAuthenticatedEmail(undefined);
      setAccessMode('choose');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Could not sign out. Please try again.');
      throw error;
    }
  };

  // Global Keyboard Shortcuts (Cmd+K for search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setIsSearchModalOpen]);

  // Quiz Navigation Handlers
  const handleStartQuiz = (questions: Question[], quizTitle: string, isTimed: boolean) => {
    setActiveQuizQuestions(questions);
    setActiveQuizTitle(quizTitle);
    setActiveQuizIsTimed(isTimed);
    setLastSubmission(null);
  };

  const handleFinishQuiz = (submission: QuizSubmission) => {
    applyQuizResultsToMastery(submission);
    setLastSubmission(submission);
    setActiveQuizQuestions(null);
  };

  const handleExitQuiz = () => {
    setActiveQuizQuestions(null);
    setLastSubmission(null);
  };

  const handleLaunchQuizForTopic = (topicId?: string) => {
    setPreselectedQuizTopicId(topicId);
    setActiveQuizQuestions(null);
    setLastSubmission(null);
    navigateToTab('quizzes');
  };

  const handleAskTutorWithQuery = (initialQuery?: string) => {
    setPendingTutorQuery(initialQuery || '');
    navigateToTab('tutor_chat');
  };

  if (accessMode === 'checking') {
    return <main className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">Checking your local sign-in session…</main>;
  }

  if (accessMode === 'choose') {
    return <AuthPage onContinueAsGuest={continueAsGuest} onAuthenticated={handleAuthenticated} initialError={authError} />;
  }

  if (!store.isStorageReady) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">Loading your private study workspace…</main>;
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200 overflow-hidden">
      {/* Top Navbar */}
      <Navbar
        store={store}
        onOpenSearch={() => setIsSearchModalOpen(true)}
        onOpenNavigation={() => setIsMobileNavigationOpen(true)}
        onNavigateToIngestion={() => navigateToTab('ingestion')}
        isGuest={accessMode === 'guest'}
        isAuthenticated={accessMode === 'authenticated'}
        accountEmail={authenticatedEmail}
        onOpenAuth={() => {
          if (accessMode === 'guest') setAuthSourceGuestWorkspaceId(guestWorkspaceId);
          setAccessMode('choose');
        }}
        onSignOut={handleSignOut}
      />

      {/* Main Workspace: Left Sidebar + Center View */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            navigateToTab(tab);
            setActiveQuizQuestions(null);
            setLastSubmission(null);
          }}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          courseTitle={course.title}
          isMobileOpen={isMobileNavigationOpen}
          onMobileClose={() => setIsMobileNavigationOpen(false)}
        />

        {/* Dynamic Center Page View (Independently Scrollable) */}
        <main className="flex-1 min-w-0 overflow-y-auto h-full">
          {activeTab === 'dashboard' && (
            <DashboardPage
              store={store}
              onNavigateToQuiz={handleLaunchQuizForTopic}
              onNavigateToTutor={handleAskTutorWithQuery}
              onNavigateToCourseMap={() => navigateToTab('course_map')}
              onNavigateToIngestion={() => navigateToTab('ingestion')}
            />
          )}

          {activeTab === 'knowledge_base' && (
            <KnowledgeBasePage
              store={store}
              onNavigateToIngestion={() => navigateToTab('ingestion')}
              initialSelectedTopicId={selectedKnowledgeTopicId}
            />
          )}

          {activeTab === 'tutor_chat' && (
            <TutorChatPage
              store={store}
              initialQuery={pendingTutorQuery}
              onInitialQueryHandled={() => setPendingTutorQuery('')}
              onNavigateToIngestion={() => navigateToTab('ingestion')}
            />
          )}

          {activeTab === 'quizzes' && (
            <>
              {activeQuizQuestions ? (
                <QuizPlayerPage
                  questions={activeQuizQuestions}
                  quizTitle={activeQuizTitle}
                  isTimed={activeQuizIsTimed}
                  store={store}
                  onFinishQuiz={handleFinishQuiz}
                  onExit={handleExitQuiz}
                />
              ) : lastSubmission ? (
                <QuizResultsPage
                  submission={lastSubmission}
                  course={course}
                  onPracticeWeakTopics={(tId) => handleLaunchQuizForTopic(tId)}
                  onRetake={() => handleLaunchQuizForTopic()}
                  onNavigateToRevision={() => navigateToTab('revision')}
                  onNavigateToDashboard={() => navigateToTab('dashboard')}
                />
              ) : (
                <QuizBuilderPage
                  store={store}
                  onStartQuiz={handleStartQuiz}
                  onNavigateToIngestion={() => navigateToTab('ingestion')}
                  initialTopicId={preselectedQuizTopicId}
                />
              )}
            </>
          )}

          {activeTab === 'course_map' && (
            <CourseFlowMapPage
              store={store}
              onStudyTopic={handleAskTutorWithQuery}
              onQuizTopic={handleLaunchQuizForTopic}
            />
          )}

          {activeTab === 'study_plan' && (
            <StudyPlanPage
              store={store}
              onStartStudySession={handleAskTutorWithQuery}
            />
          )}

          {activeTab === 'revision' && (
            <RevisionHubPage store={store} />
          )}

          {activeTab === 'ingestion' && (
            <IngestionPage
              store={store}
              onExploreKnowledgeBase={() => navigateToTab('knowledge_base')}
            />
          )}

          {activeTab === 'local_python' && <LocalPythonPage store={store} />}

        </main>
      </div>

      {/* Reusable Source Viewer Slide-over Drawer */}
      <SourceViewerDrawer
        citation={activeCitation}
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
      />

      {/* Global Cmd+K Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        course={course}
        onSelectUnit={(citation) => openCitation(citation)}
        onSelectTopic={(topicId) => {
          setSelectedKnowledgeTopicId(topicId);
          navigateToTab('knowledge_base');
        }}
      />
    </div>
  );
}
