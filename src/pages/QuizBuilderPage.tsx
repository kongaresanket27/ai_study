/**
 * StudyPilot - Quiz Builder Page
 * Configure student-chosen scope and difficulty (including adaptive targeting),
 * source scope, difficulty, and timed practice options.
 */

import React, { useState } from 'react';
import {
  BrainCircuit,
  Sliders,
  CheckSquare,
  Clock,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  BookOpen,
} from 'lucide-react';
import { useAppStore } from '../store/useStore';
import { Question } from '../types';
import { generateAdaptiveQuestions } from '../services/geminiService';

interface QuizBuilderPageProps {
  store: ReturnType<typeof useAppStore>;
  onStartQuiz: (questions: Question[], quizTitle: string, isTimed: boolean) => void;
  onNavigateToIngestion: () => void;
  initialTopicId?: string;
}

export const QuizBuilderPage: React.FC<QuizBuilderPageProps> = ({
  store,
  onStartQuiz,
  onNavigateToIngestion,
  initialTopicId,
}) => {
  const { course, topicMastery, quizHistory } = store;

  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>(
    initialTopicId ? [initialTopicId] : []
  );
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'adaptive'>('adaptive');
  const [isTimedExam, setIsTimedExam] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationError, setGenerationError] = useState('');

  // Previously answered IDs are provided to generation as a best-effort avoidance signal.
  const pastAnsweredQuestionIds = new Set<string>();
  quizHistory.forEach(q => {
    q.answers.forEach(a => pastAnsweredQuestionIds.add(a.question_id));
  });

  const toggleTopic = (id: string) => {
    setSelectedTopicIds(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const handleSelectAllTopics = () => {
    if (selectedTopicIds.length === course.topics.length) {
      setSelectedTopicIds([]);
    } else {
      setSelectedTopicIds(course.topics.map(t => t.id));
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationError('');
    try {
      const targetTopicIds = selectedTopicIds.length > 0
        ? selectedTopicIds
        : course.topics.map(t => t.id);

      const questions = await generateAdaptiveQuestions(
        targetTopicIds,
        questionCount,
        difficulty,
        pastAnsweredQuestionIds,
        course.content_units
      );

      const title = selectedTopicIds.length === 1
        ? `${course.topics.find(t => t.id === selectedTopicIds[0])?.title} Quiz`
        : isTimedExam
        ? 'Timed Quiz'
        : `Quiz (${difficulty})`;

      onStartQuiz(questions, title, isTimedExam);
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : 'Could not generate a quiz from the selected sources.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="pb-4 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200/50 dark:border-indigo-800/50">
            Personalized practice
          </span>
          <span className="text-xs text-slate-400">·</span>
          <span className="text-xs text-slate-500">
            Source-grounded question generation
          </span>
        </div>
        {generationError && (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
            {generationError}
          </p>
        )}
        {course.topics.length === 0 && (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <span>Upload study materials before creating a source-grounded quiz.</span>
              <button onClick={onNavigateToIngestion} className="rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white hover:bg-indigo-700">
                Upload materials
              </button>
            </div>
        )}
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
          Adaptive Assessment Generator
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Generate quiz questions from your uploaded materials, with source citations for review.
        </p>
      </div>

      {/* Main Settings Card */}
      <div className="p-6 md:p-8 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
        {/* Step 1: Topic Scope Selector */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              1. Choose Assessment Scope
            </label>
            <button
              onClick={handleSelectAllTopics}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
            >
              {selectedTopicIds.length === course.topics.length ? 'Deselect All' : 'Select Whole Course'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {course.topics.map((topic) => {
              const isChecked = selectedTopicIds.includes(topic.id);
              const tm = topicMastery.find(m => m.topic_id === topic.id);
              const masteryPct = tm ? Math.round(tm.mastery * 100) : 25;

              return (
                <div
                  key={topic.id}
                  onClick={() => toggleTopic(topic.id)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                    isChecked
                      ? 'bg-indigo-50/80 dark:bg-indigo-950/60 border-indigo-500/60 text-slate-900 dark:text-white'
                      : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div
                      className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                        isChecked
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
                      }`}
                    >
                      {isChecked && <CheckSquare className="w-3 h-3" />}
                    </div>
                    <span className="font-semibold truncate">{topic.title}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 ml-2 shrink-0">
                    {tm?.attempts_count ? `${masteryPct}% progress` : 'Not practiced'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 2: Difficulty & adaptive targeting */}
        <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            2. Difficulty & Adaptive Mode
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { id: 'adaptive', label: 'Adaptive', desc: 'Prioritizes topics needing review' },
              { id: 'easy', label: 'Foundational', desc: 'Prerequisites & definitions' },
              { id: 'medium', label: 'Exam Standard', desc: 'Derivations & architectures' },
              { id: 'hard', label: 'Advanced Challenge', desc: 'Non-convex proofs & math' },
            ].map((d) => (
              <button
                key={d.id}
                onClick={() => setDifficulty(d.id as any)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  difficulty === d.id
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-900 dark:text-indigo-200 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <p className="text-xs font-bold">{d.label}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{d.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Step 3: Question Count & Mode */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
          {/* Question Count */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">Number of Questions</span>
              <span className="font-bold font-mono text-indigo-600 dark:text-indigo-400">{questionCount} items</span>
            </div>
            <input
              type="range"
              min="3"
              max="10"
              value={questionCount}
              onChange={(e) => setQuestionCount(parseInt(e.target.value, 10))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>3 Quick</span>
              <span>5 Standard</span>
              <span>10 Comprehensive</span>
            </div>
          </div>

          {/* Timed Mock Exam Toggle */}
          <div className="space-y-2">
            <span className="font-bold text-xs text-slate-700 dark:text-slate-300 block">
              Assessment Format
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsTimedExam(false)}
                className={`flex-1 py-2 px-3 text-xs rounded-xl font-medium border transition-colors cursor-pointer ${
                  !isTimedExam
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-600 dark:text-indigo-300 font-bold'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                Untimed Practice
              </button>
              <button
                onClick={() => setIsTimedExam(true)}
                className={`flex-1 py-2 px-3 text-xs rounded-xl font-medium border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                  isTimedExam
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-600 dark:text-indigo-300 font-bold'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Timed Exam Mode</span>
              </button>
            </div>
          </div>
        </div>

        {/* Source and repetition context */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Generated from uploaded source excerpts</span>
          </div>
          <span className="font-mono text-[11px] text-slate-500">
            {pastAnsweredQuestionIds.size} previously answered
          </span>
        </div>

        {/* Start Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || course.content_units.length === 0}
          className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>Generating source-cited questions...</span>
            </>
          ) : (
            <>
              <BrainCircuit className="w-4 h-4" />
              <span>Launch Assessment ({isTimedExam ? '10 min timer' : 'Self-Paced'})</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
