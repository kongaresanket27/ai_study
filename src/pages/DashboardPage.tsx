import React from 'react';
import { BookOpen, Brain, Clock3, FileUp, Layers3, MessageSquareText } from 'lucide-react';
import { useAppStore } from '../store/useStore';

interface DashboardPageProps {
  store: ReturnType<typeof useAppStore>;
  onNavigateToQuiz: (topicId?: string) => void;
  onNavigateToTutor: (query?: string) => void;
  onNavigateToCourseMap: () => void;
  onNavigateToIngestion: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  store,
  onNavigateToQuiz,
  onNavigateToTutor,
  onNavigateToCourseMap,
  onNavigateToIngestion,
}) => {
  const { course, learnerProfile, topicMastery } = store;
  const hasMaterials = course.content_units.length > 0;
  const practicedCount = topicMastery.filter((topic) => topic.attempts_count > 0).length;
  const cards = [
    { label: 'Uploaded sources', value: course.content_units.length, icon: Layers3 },
    { label: 'Topics', value: course.topics.length, icon: BookOpen },
    { label: 'Quizzes completed', value: learnerProfile.total_quizzes_taken, icon: Brain },
    { label: 'Study time this week', value: `${learnerProfile.completed_hours_this_week}h`, icon: Clock3 },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6 md:p-8">
      <header>
        <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Your learning workspace</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">
          {course.title || 'Study dashboard'}
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {hasMaterials
            ? `${course.content_units.length} source sections are ready to study.`
            : 'Upload your study materials to create a source-grounded learning workspace.'}
        </p>
      </header>

      {!hasMaterials && (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6 dark:border-indigo-900 dark:bg-indigo-950/30">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div className="rounded-xl bg-white p-3 text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-400">
              <FileUp className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-slate-900 dark:text-white">Start with your own materials</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Add documents, notes, images, or lecture recordings. Topics, explanations, and quizzes will be based on those sources.
              </p>
            </div>
            <button
              onClick={onNavigateToIngestion}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Upload materials
            </button>
          </div>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
              <Icon className="h-4 w-4 text-indigo-500" />
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
          </div>
        ))}
      </section>

      {hasMaterials ? (
        <section className="grid gap-4 md:grid-cols-3">
          <button onClick={() => onNavigateToTutor()} className="rounded-xl border border-slate-200 bg-white p-5 text-left hover:border-indigo-400 dark:border-slate-800 dark:bg-slate-900">
            <MessageSquareText className="h-5 w-5 text-indigo-500" />
            <h2 className="mt-3 font-semibold text-slate-900 dark:text-white">Ask about your sources</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Get explanations with citations from uploaded materials.</p>
          </button>
          <button onClick={() => onNavigateToQuiz()} className="rounded-xl border border-slate-200 bg-white p-5 text-left hover:border-indigo-400 dark:border-slate-800 dark:bg-slate-900">
            <Brain className="h-5 w-5 text-indigo-500" />
            <h2 className="mt-3 font-semibold text-slate-900 dark:text-white">Practice a quiz</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Generate questions from your ingested content.</p>
          </button>
          <button onClick={onNavigateToCourseMap} className="rounded-xl border border-slate-200 bg-white p-5 text-left hover:border-indigo-400 dark:border-slate-800 dark:bg-slate-900">
            <BookOpen className="h-5 w-5 text-indigo-500" />
            <h2 className="mt-3 font-semibold text-slate-900 dark:text-white">Browse topics</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {practicedCount} of {course.topics.length} topics practiced.
            </p>
          </button>
        </section>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Your uploaded content and study activity will appear here.
        </p>
      )}
    </div>
  );
};
