/**
 * StudyPilot - Central Application State Management
 * 
 * Manages courses, active knowledge base, BKT learner model,
 * quiz submissions, chat history, and UI drawer states with localStorage persistence.
 */

import { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import {
  Course,
  TopicMasteryState,
  LearnerProfile,
  QuizSubmission,
  ChatMessage,
  Citation,
} from '../types';
import {
  getInitialCourse,
  getInitialLearnerProfile,
  getWelcomeMessage,
} from '../config/courseConfig';
import { initializeTopicMastery, updateBKT, applyConversationalNudge, getMasteryStatus } from '../learner/bkt';
import { updateStabilityAfterReview, calculateRetrievability, calculateReviewDueTimestamp } from '../learner/spacedRepetition';

const STORAGE_KEYS = {
  ACTIVE_COURSE: 'studypilot_active_course_v2',
  TOPIC_MASTERY: 'studypilot_topic_mastery_v2',
  LEARNER_PROFILE: 'studypilot_learner_profile_v2',
  QUIZ_HISTORY: 'studypilot_quiz_history_v2',
  CHAT_HISTORY: 'studypilot_chat_history_v2',
  THEME: 'studypilot_theme_v1',
};

const LEGACY_WORKSPACE_OWNER_KEY = 'studypilot_legacy_workspace_owner_v1';

function scopedStorageKey(key: string, scope: string): string {
  return `${key}::${encodeURIComponent(scope)}`;
}

function readStoredValue<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) as T : fallback;
  } catch {
    return fallback;
  }
}

export function useAppStore(storageScope: string | null) {
  // Course State
  const [course, setCourse] = useState<Course>(getInitialCourse);

  // Learner BKT Mastery States
  const [topicMastery, setTopicMastery] = useState<TopicMasteryState[]>([]);

  // Learner Profile
  const [learnerProfile, setLearnerProfile] = useState<LearnerProfile>(getInitialLearnerProfile);

  // Past Quiz Submissions
  const [quizHistory, setQuizHistory] = useState<QuizSubmission[]>([]);

  // Chat History
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => [{
    id: 'msg-welcome',
    role: 'assistant',
    content: getWelcomeMessage(),
    timestamp: Date.now(),
  }]);
  const [loadedStorageScope, setLoadedStorageScope] = useState<string | null>(null);

  // Theme preference is explicitly controlled by the application toggle.
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.THEME);
      if (stored === 'dark') return true;
      if (stored === 'light') return false;
    } catch {
      // Theme application must still work when storage is unavailable.
    }
    return true;
  });

  // Active Source Viewer Drawer State
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Global Search Modal
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!storageScope) {
      setLoadedStorageScope(null);
      return;
    }

    let migrateLegacy = false;
    try {
      const migrationOwner = localStorage.getItem(LEGACY_WORKSPACE_OWNER_KEY);
      migrateLegacy = migrationOwner === null || migrationOwner === `pending:${storageScope}`;
      if (migrationOwner === null) {
        localStorage.setItem(LEGACY_WORKSPACE_OWNER_KEY, `pending:${storageScope}`);
      }
    } catch {
      migrateLegacy = false;
    }

    const load = <T,>(key: string, fallback: T): T => {
      const scopedKey = scopedStorageKey(key, storageScope);
      if (migrateLegacy) {
        try {
          const legacy = localStorage.getItem(key);
          if (legacy !== null) return JSON.parse(legacy) as T;
        } catch {
          // Fall back to the account-scoped value if legacy data cannot be read.
        }
      }
      const scoped = readStoredValue<T | null>(scopedKey, null);
      if (scoped !== null) return scoped;
      return fallback;
    };

    const workspace = {
      course: load(STORAGE_KEYS.ACTIVE_COURSE, getInitialCourse()),
      topicMastery: load<TopicMasteryState[]>(STORAGE_KEYS.TOPIC_MASTERY, []),
      learnerProfile: load(STORAGE_KEYS.LEARNER_PROFILE, getInitialLearnerProfile()),
      quizHistory: load<QuizSubmission[]>(STORAGE_KEYS.QUIZ_HISTORY, []),
      chatMessages: load<ChatMessage[]>(STORAGE_KEYS.CHAT_HISTORY, [{
        id: 'msg-welcome',
        role: 'assistant',
        content: getWelcomeMessage(),
        timestamp: Date.now(),
      }]),
    };

    setCourse(workspace.course);
    setTopicMastery(workspace.topicMastery);
    setLearnerProfile(workspace.learnerProfile);
    setQuizHistory(workspace.quizHistory);
    setChatMessages(workspace.chatMessages);
    setActiveCitation(null);
    setIsDrawerOpen(false);
    setIsSearchModalOpen(false);

    if (migrateLegacy) {
      try {
        localStorage.setItem(scopedStorageKey(STORAGE_KEYS.ACTIVE_COURSE, storageScope), JSON.stringify(workspace.course));
        localStorage.setItem(scopedStorageKey(STORAGE_KEYS.TOPIC_MASTERY, storageScope), JSON.stringify(workspace.topicMastery));
        localStorage.setItem(scopedStorageKey(STORAGE_KEYS.LEARNER_PROFILE, storageScope), JSON.stringify(workspace.learnerProfile));
        localStorage.setItem(scopedStorageKey(STORAGE_KEYS.QUIZ_HISTORY, storageScope), JSON.stringify(workspace.quizHistory));
        localStorage.setItem(scopedStorageKey(STORAGE_KEYS.CHAT_HISTORY, storageScope), JSON.stringify(workspace.chatMessages));
        localStorage.setItem(LEGACY_WORKSPACE_OWNER_KEY, storageScope);
      } catch (error) {
        console.error('Could not migrate the previous study workspace to this user workspace:', error);
      }
    }
    setLoadedStorageScope(storageScope);
  }, [storageScope]);

  const isStorageReady = storageScope !== null && loadedStorageScope === storageScope;

  // Persist each workspace under its authenticated account or the separate guest workspace.
  useEffect(() => {
    if (!isStorageReady || !storageScope) return;
    try {
      localStorage.setItem(scopedStorageKey(STORAGE_KEYS.ACTIVE_COURSE, storageScope), JSON.stringify(course));
    } catch {}
  }, [course, isStorageReady, storageScope]);

  useEffect(() => {
    if (!isStorageReady || !storageScope) return;
    try {
      localStorage.setItem(scopedStorageKey(STORAGE_KEYS.TOPIC_MASTERY, storageScope), JSON.stringify(topicMastery));
    } catch {}
  }, [isStorageReady, storageScope, topicMastery]);

  useEffect(() => {
    if (!isStorageReady || !storageScope) return;
    try {
      localStorage.setItem(scopedStorageKey(STORAGE_KEYS.LEARNER_PROFILE, storageScope), JSON.stringify(learnerProfile));
    } catch {}
  }, [isStorageReady, learnerProfile, storageScope]);

  useEffect(() => {
    if (!isStorageReady || !storageScope) return;
    try {
      localStorage.setItem(scopedStorageKey(STORAGE_KEYS.QUIZ_HISTORY, storageScope), JSON.stringify(quizHistory));
    } catch {}
  }, [isStorageReady, quizHistory, storageScope]);

  useEffect(() => {
    if (!isStorageReady || !storageScope) return;
    try {
      localStorage.setItem(scopedStorageKey(STORAGE_KEYS.CHAT_HISTORY, storageScope), JSON.stringify(chatMessages));
    } catch {}
  }, [chatMessages, isStorageReady, storageScope]);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    document.documentElement.style.colorScheme = isDarkMode ? 'dark' : 'light';
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, isDarkMode ? 'dark' : 'light');
    } catch {}
  }, [isDarkMode]);

  // Open Citation Viewer
  const openCitation = useCallback((citation: Citation) => {
    setActiveCitation(citation);
    setIsDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  // Update BKT Mastery after a quiz submission
  const applyQuizResultsToMastery = useCallback((submission: QuizSubmission) => {
    setTopicMastery(prevStates => {
      const updated = prevStates.map(state => {
        const accuracyInfo = submission.topic_accuracies[state.topic_id];
        if (!accuracyInfo || accuracyInfo.total === 0) return state;

        // Apply BKT updates for each question in this topic
        let currentM = state.mastery;
        let stability = state.stability_days;
        const now = Date.now();

        // Fraction of correct answers
        const isOverallTopicPassed = accuracyInfo.percentage >= 65;

        // Step through BKT for each question
        for (let i = 0; i < accuracyInfo.total; i++) {
          const isQCorrect = i < accuracyInfo.correct;
          const bktResult = updateBKT(currentM, isQCorrect);
          currentM = bktResult.newMastery;
        }

        // Update Ebbinghaus stability
        stability = updateStabilityAfterReview(stability, isOverallTopicPassed, currentM);
        const reviewDue = calculateReviewDueTimestamp(now, stability);

        return {
          ...state,
          mastery: currentM,
          attempts_count: state.attempts_count + accuracyInfo.total,
          correct_count: state.correct_count + accuracyInfo.correct,
          last_practiced_timestamp: now,
          stability_days: stability,
          retrievability: 1.0,
          review_due_timestamp: reviewDue,
          status: getMasteryStatus(currentM),
        };
      });
      return updated;
    });

    // Append to quiz history
    setQuizHistory(prev => [submission, ...prev]);

    // Update learner profile stats
    setLearnerProfile(prev => ({
      ...prev,
      total_quizzes_taken: prev.total_quizzes_taken + 1,
      total_questions_answered: prev.total_questions_answered + submission.total_questions,
      completed_hours_this_week: Number((prev.completed_hours_this_week + submission.time_spent_seconds / 3600).toFixed(1)),
    }));
  }, []);

  // Apply conversational nudge to topic mastery
  const applyChatNudge = useCallback((topicId: string, signal: 'asked_basic_help' | 'deep_understanding') => {
    setTopicMastery(prev => prev.map(t => {
      if (t.topic_id === topicId) {
        const newM = applyConversationalNudge(t.mastery, signal);
        return {
          ...t,
          mastery: newM,
          status: getMasteryStatus(newM),
        };
      }
      return t;
    }));
  }, []);

  // Add new content unit from ingestion
  const addIngestedContent = useCallback((newUnits: typeof course.content_units, newTopics: typeof course.topics) => {
    const newTopicIds = new Set(newTopics.map((topic) => topic.id));
    setTopicMastery((previous) => {
      const knownTopicIds = new Set(previous.map((state) => state.topic_id));
      return [
        ...previous,
        ...Array.from(newTopicIds)
          .filter((topicId) => !knownTopicIds.has(topicId))
          .map((topicId) => initializeTopicMastery(topicId)),
      ];
    });
    setCourse(prev => {
      // Merge unique topics
      const existingTopicIds = new Set(prev.topics.map(t => t.id));
      const mergedTopics = [...prev.topics];
      for (const t of newTopics) {
        if (!existingTopicIds.has(t.id)) {
          mergedTopics.push(t);
        }
      }
      return {
        ...prev,
        topics: mergedTopics,
        content_units: [...newUnits, ...prev.content_units],
      };
    });
  }, []);

  const deleteUploadedMaterial = useCallback((topicId: string) => {
    const removedUnitIds = new Set(
      course.content_units
        .filter((unit) => unit.topic_id === topicId)
        .map((unit) => unit.id)
    );
    if (!removedUnitIds.size) return;

    setCourse((previous) => ({
      ...previous,
      topics: previous.topics
        .filter((topic) => topic.id !== topicId)
        .map((topic) => ({
          ...topic,
          prerequisite_ids: topic.prerequisite_ids.filter((id) => id !== topicId),
        })),
      content_units: previous.content_units.filter((unit) => !removedUnitIds.has(unit.id)),
      prerequisites: previous.prerequisites.filter(
        (edge) => edge.fromTopicId !== topicId && edge.toTopicId !== topicId
      ),
    }));
    setTopicMastery((previous) => previous.filter((state) => state.topic_id !== topicId));
    setChatMessages((previous) =>
      previous.filter((message) => !message.citations?.some((citation) => removedUnitIds.has(citation.unit_id)))
    );
    if (activeCitation && removedUnitIds.has(activeCitation.unit_id)) {
      setIsDrawerOpen(false);
      setActiveCitation(null);
    }
  }, [activeCitation, course.content_units]);

  const transferGuestWorkspaceToAccount = useCallback((guestWorkspaceId: string, userId: string) => {
    const guestScope = `guest:${guestWorkspaceId}`;
    const userScope = `user:${userId}`;
    const workspaceKeys = [
      STORAGE_KEYS.ACTIVE_COURSE,
      STORAGE_KEYS.TOPIC_MASTERY,
      STORAGE_KEYS.LEARNER_PROFILE,
      STORAGE_KEYS.QUIZ_HISTORY,
      STORAGE_KEYS.CHAT_HISTORY,
    ];

    try {
      const accountCourseKey = scopedStorageKey(STORAGE_KEYS.ACTIVE_COURSE, userScope);
      if (localStorage.getItem(accountCourseKey) !== null) return;

      for (const key of workspaceKeys) {
        const guestValue = localStorage.getItem(scopedStorageKey(key, guestScope));
        if (guestValue !== null) {
          localStorage.setItem(scopedStorageKey(key, userScope), guestValue);
        }
      }
    } catch (error) {
      console.error('Could not transfer the guest workspace to the signed-in account:', error);
      throw new Error('We could not move your guest workspace into the account. Please try signing in again.');
    }
  }, []);

  return {
    course,
    setCourse,
    topicMastery,
    setTopicMastery,
    learnerProfile,
    setLearnerProfile,
    quizHistory,
    chatMessages,
    setChatMessages,
    isDarkMode,
    setIsDarkMode,
    activeCitation,
    isDrawerOpen,
    openCitation,
    closeDrawer,
    isSearchModalOpen,
    setIsSearchModalOpen,
    isStorageReady,
    applyQuizResultsToMastery,
    applyChatNudge,
    addIngestedContent,
    deleteUploadedMaterial,
    transferGuestWorkspaceToAccount,
  };
}
