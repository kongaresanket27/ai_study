/**
 * StudyPilot - Post-Assessment Results & Analysis Report
 * Learner-facing quiz summary with score, topic results, and next steps.
 */

import React from 'react';
import {
  Award,
  Clock,
  RotateCcw,
  BookOpen,
  Sparkles,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { QuizSubmission, Course, TopicMasteryState } from '../types';

interface QuizResultsPageProps {
  submission: QuizSubmission;
  course: Course;
  onPracticeWeakTopics: (topicId: string) => void;
  onRetake: () => void;
  onNavigateToRevision: () => void;
  onNavigateToDashboard: () => void;
}

export const QuizResultsPage: React.FC<QuizResultsPageProps> = ({
  submission,
  course,
  onPracticeWeakTopics,
  onRetake,
  onNavigateToRevision,
  onNavigateToDashboard,
}) => {
  const isPass = submission.score_percentage >= 70;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-900 border border-indigo-500/30 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center sm:text-left">
          <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/60 px-2.5 py-1 rounded-md border border-cyan-800/40">
            Assessment Completed
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            {submission.quiz_title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Completed {submission.correct_questions} of {submission.total_questions} questions in {Math.round(submission.time_spent_seconds / 60)}m {submission.time_spent_seconds % 60}s.
          </p>
        </div>

        {/* Big Score Ring */}
        <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-slate-800 stroke-current"
              strokeWidth="3.5"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className={`stroke-current transition-all duration-1000 ${
                isPass ? 'text-emerald-500' : 'text-amber-500'
              }`}
              strokeDasharray={`${submission.score_percentage}, 100`}
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <div className="absolute text-center">
            <p className="text-2xl font-black text-white tabular-nums">
              {submission.score_percentage}%
            </p>
            <p className="text-[10px] uppercase font-bold text-slate-400">
              {isPass ? 'Good work' : 'Keep practicing'}
            </p>
          </div>
        </div>
      </div>

      {/* Topic results */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-500" />
          Results by topic
        </h3>
        <p className="text-xs text-slate-500">
          See which topics you answered correctly and choose what to review next.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Object.entries(submission.topic_accuracies).map(([topicId, accuracy]) => {
            const topic = course.topics.find(t => t.id === topicId);
            return (
              <div
                key={topicId}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{topic?.title || 'Uploaded topic'}</p>
                  <p className="shrink-0 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {accuracy.correct} / {accuracy.total} correct
                  </p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div className={`h-full rounded-full ${accuracy.percentage >= 70 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${accuracy.percentage}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onRetake}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Try another quiz</span>
          </button>
          <button
            onClick={onNavigateToRevision}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/50 dark:border-indigo-800/50 hover:bg-indigo-100 transition-colors cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Review uploaded material</span>
          </button>
        </div>

        <button
          onClick={onNavigateToDashboard}
          className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm transition-colors cursor-pointer"
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
};
