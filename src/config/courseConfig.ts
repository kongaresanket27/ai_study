import { Course, LearnerProfile } from '../types';

const getRuntimeEnv = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env as Record<string, string | undefined>;
  }

  if (typeof process !== 'undefined' && process.env) {
    return process.env as Record<string, string | undefined>;
  }

  return {} as Record<string, string | undefined>;
};

const readConfig = (key: string, fallback: string) => {
  const value = getRuntimeEnv()[key];
  return value && value.trim() ? value : fallback;
};

export const getInitialCourse = (): Course => ({
  id: readConfig('VITE_COURSE_ID', 'user-course'),
  title: readConfig('VITE_COURSE_TITLE', ''),
  code: readConfig('VITE_COURSE_CODE', ''),
  institution: readConfig('VITE_COURSE_INSTITUTION', ''),
  description: readConfig('VITE_COURSE_DESCRIPTION', ''),
  exam_date: readConfig('VITE_COURSE_EXAM_DATE', ''),
  target_weekly_hours: Number(readConfig('VITE_TARGET_WEEKLY_HOURS', '10')),
  topics: [],
  content_units: [],
  prerequisites: [],
});

export const getInitialLearnerProfile = (): LearnerProfile => ({
  student_name: readConfig('VITE_STUDENT_NAME', 'Student'),
  avatar_url: readConfig('VITE_STUDENT_AVATAR_URL', ''),
  current_streak_days: 0,
  last_active_date: new Date().toISOString().slice(0, 10),
  weekly_goal_hours: Number(readConfig('VITE_WEEKLY_GOAL_HOURS', '5')),
  completed_hours_this_week: 0,
  total_quizzes_taken: 0,
  total_questions_answered: 0,
  diagnostic_completed: false,
});

export const getWelcomeMessage = () =>
  readConfig(
    'VITE_WELCOME_MESSAGE',
    'Welcome to StudyPilot. Upload your study materials to build your course knowledge base, then ask questions or create a quiz grounded in those sources.',
  );
