/**
 * StudyPilot - Spaced Repetition Study Planner
 * Generates a day-by-day study calendar from quiz activity, review timing,
 * time remaining before the exam, and topics needing more practice.
 */

import React, { useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Sparkles,
  BookOpen,
  ChevronDown,
  FileText,
} from 'lucide-react';
import { useAppStore } from '../store/useStore';
import { initializeTopicMastery } from '../learner/bkt';
import { calculateRetrievability, generateStudySchedule } from '../learner/spacedRepetition';

interface StudyPlanPageProps {
  store: ReturnType<typeof useAppStore>;
  onStartStudySession: (topicTitle: string) => void;
}

export const StudyPlanPage: React.FC<StudyPlanPageProps> = ({
  store,
  onStartStudySession,
}) => {
  const { course, topicMastery } = store;

  const topicsLookup = useMemo(() => {
    const map: Record<string, { title: string; estimated_study_minutes: number }> = {};
    course.topics.forEach((t) => {
      map[t.id] = { title: t.title, estimated_study_minutes: t.estimated_study_minutes };
    });
    return map;
  }, [course]);

  const plannerTopicStates = useMemo(() => course.topics.map((topic) => {
    const savedState = topicMastery.find((state) => state.topic_id === topic.id);
    const state = savedState || initializeTopicMastery(topic.id);
    return {
      ...state,
      retrievability: calculateRetrievability(state.last_practiced_timestamp, state.stability_days),
    };
  }), [course.topics, topicMastery]);

  const schedule = useMemo(() => {
    return generateStudySchedule(
      plannerTopicStates,
      topicsLookup,
      course.exam_date,
      course.target_weekly_hours
    );
  }, [plannerTopicStates, topicsLookup, course.exam_date, course.target_weekly_hours]);

  const documents = useMemo(() => {
    const groups = new Map<string, { fileName: string; topicIds: Set<string>; unitCount: number }>();
    const topicIds = new Set(course.topics.map((topic) => topic.id));

    course.content_units.forEach((unit) => {
      const fileName = unit.source_file.trim() || 'Uploaded material';
      let document = groups.get(fileName);
      if (!document) {
        document = { fileName, topicIds: new Set(), unitCount: 0 };
        groups.set(fileName, document);
      }

      document.unitCount += 1;
      if (topicIds.has(unit.topic_id)) document.topicIds.add(unit.topic_id);
    });

    return Array.from(groups.values()).map((document) => ({
      ...document,
      topics: Array.from(document.topicIds)
        .map((topicId) => course.topics.find((topic) => topic.id === topicId))
        .filter((topic) => topic !== undefined),
    }));
  }, [course.content_units, course.topics]);

  const scheduleByTopic = useMemo(() => {
    const grouped = new Map<string, typeof schedule>();
    schedule.forEach((block) => {
      const topicBlocks = grouped.get(block.topicId) || [];
      topicBlocks.push(block);
      grouped.set(block.topicId, topicBlocks);
    });
    return grouped;
  }, [schedule]);

  // Exam days countdown
  const examDate = course.exam_date ? new Date(course.exam_date) : null;
  const daysUntilExam = examDate && !Number.isNaN(examDate.getTime()) && examDate.getTime() > Date.now()
    ? Math.max(1, Math.ceil((examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/60 dark:border-slate-800/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200/50 dark:border-indigo-800/50">
              Personalized study plan
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500">
              {daysUntilExam === null ? 'Weekly review plan' : `Exam: ${course.exam_date} (${daysUntilExam} days remaining)`}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            Personalized Study Planner
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            A practical review calendar based on your quiz activity and upcoming study goals.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Target Pace</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {course.target_weekly_hours} hrs/week (~{(course.target_weekly_hours / 7).toFixed(1)} hrs/day)
            </span>
          </div>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
          <p className="font-semibold text-slate-800 dark:text-slate-100">Add study materials to build your plan</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">The planner will organize your schedule by uploaded document, with each document’s topics listed underneath.</p>
        </div>
      ) : (
      <>
      {/* Forgetting Curve Concept Card */}
      <div className="p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-xs font-bold text-indigo-950 dark:text-indigo-200 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-cyan-500" />
            Review schedule
          </h3>
          <p className="text-xs text-indigo-900/80 dark:text-indigo-300/80 max-w-3xl leading-relaxed">
            Topics with lower quiz progress or due reviews are prioritized to help you revisit material at useful intervals.
          </p>
        </div>
        <div className="text-xs text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 shrink-0">
          Reviews adapt to your quiz results
        </div>
      </div>

      {/* Uploaded Documents with their topic review schedules */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-indigo-500" />
          Study Plan by Uploaded Document
        </h3>

        <div className="space-y-4">
          {documents.map((document) => (
            <details
              key={document.fileName}
              open
              className="group rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 [&::-webkit-details-marker]:hidden">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                    <FileText className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">{document.fileName}</span>
                    <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                      {document.topics.length} {document.topics.length === 1 ? 'topic' : 'topics'} · {document.unitCount} {document.unitCount === 1 ? 'section' : 'sections'}
                    </span>
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
              </summary>

              <div className="space-y-4 border-t border-slate-200 p-4 dark:border-slate-800 sm:p-5">
                {document.topics.map((topic) => {
                  const topicState = plannerTopicStates.find((state) => state.topic_id === topic.id);
                  const topicBlocks = scheduleByTopic.get(topic.id) || [];

                  return (
                    <section key={topic.id} className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{topic.title}</h4>
                        {topicState && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            Mastery: {Math.round(topicState.mastery * 100)}%
                          </span>
                        )}
                      </div>

                      {topicBlocks.length === 0 ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">No review session is scheduled for this topic in the current planning window.</p>
                      ) : (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {topicBlocks.map((block) => {
                            const isToday = block.date === new Date().toISOString().slice(0, 10);
                            const badgeColor = block.urgency === 'high'
                              ? 'border border-rose-200/60 bg-rose-50 text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/60 dark:text-rose-400'
                              : block.urgency === 'medium'
                                ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
                            const urgencyBorder = block.urgency === 'high'
                              ? 'border-rose-200 dark:border-rose-900/40'
                              : 'border-slate-200 dark:border-slate-800';

                            return (
                              <div
                                key={`${topic.id}-${block.date}`}
                                className={`relative flex flex-col justify-between space-y-3 rounded-xl border bg-white p-4 dark:bg-slate-900 ${urgencyBorder} ${
                                  isToday ? 'ring-2 ring-indigo-500/40 shadow-md' : ''
                                }`}
                              >
                                {isToday && (
                                  <span className="absolute -top-2.5 right-3 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                                    Today
                                  </span>
                                )}

                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{block.dayLabel}</span>
                                    <span className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                                      <Clock className="h-3 w-3" />
                                      {block.estimatedMinutes}m
                                    </span>
                                  </div>
                                  <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-medium ${badgeColor}`}>
                                    {block.reason === 'weak_mastery'
                                      ? 'Practice this topic'
                                      : block.reason === 'overdue_review'
                                        ? 'Review due'
                                        : block.reason === 'exam_prep'
                                          ? 'Exam preparation'
                                          : 'Keep practicing'}
                                  </span>
                                </div>

                                <button
                                  onClick={() => onStartStudySession(`Help me review ${topic.title}. Give me a brief explanation from ${document.fileName}, then ask me a source-grounded question.`)}
                                  className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-400"
                                >
                                  <BookOpen className="h-3.5 w-3.5" />
                                  <span>Start Review Session</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      </div>
      </>
      )}
    </div>
  );
};
