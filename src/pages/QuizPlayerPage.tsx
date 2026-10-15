/**
 * StudyPilot - Distraction-Free Quiz Player
 * Interactive assessment interface featuring instant feedback,
 * source-cited questions, feedback, and celebratory confetti.
 */

import React, { useState, useEffect } from 'react';
import {
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ArrowRight,
  BookOpen,
  Award,
  AlertTriangle,
  Send,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Question, QuizSubmission, Citation } from '../types';
import { useAppStore } from '../store/useStore';

interface QuizPlayerPageProps {
  questions: Question[];
  quizTitle: string;
  isTimed: boolean;
  store: ReturnType<typeof useAppStore>;
  onFinishQuiz: (submission: QuizSubmission) => void;
  onExit: () => void;
}

export const QuizPlayerPage: React.FC<QuizPlayerPageProps> = ({
  questions,
  quizTitle,
  isTimed,
  store,
  onFinishQuiz,
  onExit,
}) => {
  const { openCitation, topicMastery } = store;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(isTimed ? 600 : 0);
  const [startTime] = useState(Date.now());

  // Record student responses
  const [recordedAnswers, setRecordedAnswers] = useState<{
    question_id: string;
    user_answer: string;
    is_correct: boolean;
    feedback: string;
    identified_misconception?: string;
  }[]>([]);

  const currentQ = questions[currentIndex];

  // Timer countdown if isTimed
  useEffect(() => {
    if (!isTimed) return;
    const interval = setInterval(() => {
      setTimeLeftSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmitAnswer(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimed]);

  const handleSubmitAnswer = (forceTimeUp: boolean = false) => {
    if (isSubmitted) return;

    const answer = currentQ.type === 'mcq' ? selectedOption : typedAnswer;
    if (answer === null && !forceTimeUp) return;

    let isCorrect = false;
    let identifiedMisconception: string | undefined;

    if (currentQ.type === 'mcq') {
      isCorrect = answer === currentQ.correct_answer;
      if (!isCorrect && currentQ.misconceptions) {
        const found = currentQ.misconceptions.find(m => m.option_index.toString() === answer);
        if (found) {
          identifiedMisconception = found.misconception_label;
        }
      }
    } else {
      // Numerical check
      const cleanUser = (answer || '').trim().toLowerCase();
      const cleanCorrect = currentQ.correct_answer.trim().toLowerCase();
      isCorrect = cleanUser === cleanCorrect || cleanUser.includes(cleanCorrect);
    }

    const feedback = isCorrect
      ? `Correct! ${currentQ.worked_solution}`
      : `Incorrect. Expected ${currentQ.type === 'mcq' && currentQ.options ? currentQ.options[parseInt(currentQ.correct_answer, 10)] : currentQ.correct_answer}. ${currentQ.worked_solution}`;

    const newRecord = {
      question_id: currentQ.id,
      user_answer: answer || '',
      is_correct: isCorrect,
      feedback,
      identified_misconception: identifiedMisconception,
    };

    setRecordedAnswers(prev => [...prev, newRecord]);
    setIsSubmitted(true);
  };

  const handleNextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setTypedAnswer('');
      setIsSubmitted(false);
    } else {
      // Completed Quiz!
      const totalTimeSpent = Math.round((Date.now() - startTime) / 1000);
      const correctCount = recordedAnswers.filter(a => a.is_correct).length;
      const scorePct = Math.round((correctCount / questions.length) * 100);

      // Trigger Confetti if high score!
      if (scorePct >= 75) {
        try {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
          });
        } catch {}
      }

      // Group per-topic accuracies
      const topicAccuracies: QuizSubmission['topic_accuracies'] = {};
      const weakTopicSet = new Set<string>();
      const misconceptionsList: string[] = [];

      questions.forEach((q, idx) => {
        const record = recordedAnswers[idx];
        if (!topicAccuracies[q.topic_id]) {
          topicAccuracies[q.topic_id] = { correct: 0, total: 0, percentage: 0 };
        }
        topicAccuracies[q.topic_id].total += 1;
        if (record?.is_correct) {
          topicAccuracies[q.topic_id].correct += 1;
        } else {
          weakTopicSet.add(q.topic_id);
          if (record?.identified_misconception) {
            misconceptionsList.push(record.identified_misconception);
          }
        }
      });

      // Calculate percentages
      Object.keys(topicAccuracies).forEach(tid => {
        const info = topicAccuracies[tid];
        info.percentage = Math.round((info.correct / info.total) * 100);
      });

      // Calculate mastery before and after
      const masteryDeltas: QuizSubmission['mastery_deltas'] = {};
      Object.keys(topicAccuracies).forEach(tid => {
        const tm = topicMastery.find(m => m.topic_id === tid);
        const before = tm ? tm.mastery : 0.40;
        const pass = topicAccuracies[tid].percentage >= 60;
        const after = pass ? Math.min(0.95, before + 0.12) : Math.max(0.15, before - 0.08);
        masteryDeltas[tid] = { before, after: Number(after.toFixed(3)) };
      });

      const submission: QuizSubmission = {
        id: `quiz-run-${Date.now()}`,
        quiz_title: quizTitle,
        timestamp: Date.now(),
        time_spent_seconds: totalTimeSpent,
        score_percentage: scorePct,
        total_questions: questions.length,
        correct_questions: correctCount,
        topic_ids: Array.from(new Set(questions.map(q => q.topic_id))),
        answers: recordedAnswers,
        topic_accuracies: topicAccuracies,
        mastery_deltas: masteryDeltas,
        weak_topics: Array.from(weakTopicSet),
        key_misconceptions: misconceptionsList,
      };

      onFinishQuiz(submission);
    }
  };

  const handleOpenSourceExcerpt = () => {
    const citation: Citation = {
      id: 1,
      unit_id: currentQ.unit_id,
      source_title: currentQ.source_title,
      source_file: currentQ.source_file,
      source_location: currentQ.source_location,
      source_type: currentQ.source_type,
      excerpt: currentQ.source_excerpt,
    };
    openCitation(citation);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 sm:p-8 flex flex-col justify-between max-w-3xl mx-auto">
      {/* Top Header & Progress */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 dark:text-white">
              Question {currentIndex + 1} of {questions.length}
            </span>
            <span>·</span>
            <span className="truncate max-w-[200px]">{currentQ.topic_name}</span>
          </div>

          <div className="flex items-center gap-4">
            {isTimed && (
              <div className="flex items-center gap-1 font-mono font-bold text-rose-500">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {Math.floor(timeLeftSeconds / 60)}:{(timeLeftSeconds % 60).toString().padStart(2, '0')}
                </span>
              </div>
            )}
            <button
              onClick={onExit}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              Exit Quiz
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
          <div
            className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Main Question Card */}
      <div className="my-8 p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-6">
        {/* Verification Badge & Source Provenance */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-900/40">
            <BookOpen className="w-3.5 h-3.5" />
            <span>From uploaded source</span>
          </div>

          <button
            onClick={handleOpenSourceExcerpt}
            className="flex items-center gap-1 text-[11px] font-mono text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <BookOpen className="w-3 h-3" />
            <span>{currentQ.source_file} ({currentQ.source_location})</span>
          </button>
        </div>

        {/* Question Text */}
        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-relaxed">
          {currentQ.question}
        </h2>

        {/* Options for MCQ */}
        {currentQ.type === 'mcq' && currentQ.options && (
          <div className="space-y-3">
            {currentQ.options.map((opt, idx) => {
              const optStr = idx.toString();
              const isSelected = selectedOption === optStr;
              const isAnswerCorrect = currentQ.correct_answer === optStr;

              let style = 'bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-400';

              if (isSubmitted) {
                if (isAnswerCorrect) {
                  style = 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-semibold';
                } else if (isSelected && !isAnswerCorrect) {
                  style = 'bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-900 dark:text-rose-200';
                } else {
                  style = 'opacity-40 border-slate-200 dark:border-slate-800 text-slate-400';
                }
              } else if (isSelected) {
                style = 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-600 text-indigo-900 dark:text-indigo-100 shadow-xs';
              }

              return (
                <div
                  key={idx}
                  onClick={() => !isSubmitted && setSelectedOption(optStr)}
                  className={`p-4 rounded-xl border text-xs sm:text-sm cursor-pointer transition-all flex items-start gap-3 ${style}`}
                >
                  <span className="w-6 h-6 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="flex-1 leading-relaxed">{opt}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Input for Numerical / Short Answer */}
        {currentQ.type !== 'mcq' && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Enter your calculated numerical value or answer:
            </label>
            <input
              type="text"
              disabled={isSubmitted}
              value={typedAnswer}
              onChange={(e) => setTypedAnswer(e.target.value)}
              placeholder="e.g. 16, 0.45, O(W)..."
              className="w-full p-3.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}

        {/* Feedback Panel after submit */}
        {isSubmitted && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold">
                {recordedAnswers[recordedAnswers.length - 1]?.is_correct ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">Correct Answer</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-rose-500" />
                    <span className="text-rose-600 dark:text-rose-400">Incorrect</span>
                  </>
                )}
              </div>

              {/* Cited Source Chip */}
              <button
                onClick={handleOpenSourceExcerpt}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50 hover:bg-indigo-100 transition-colors"
              >
                <BookOpen className="w-3 h-3" />
                <span>View Cited Source Excerpt</span>
              </button>
            </div>

            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-xs">
              {currentQ.worked_solution}
            </p>

            {/* Identified Misconception */}
            {recordedAnswers[recordedAnswers.length - 1]?.identified_misconception && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2 mt-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Detected Misconception: </span>
                  <span>{recordedAnswers[recordedAnswers.length - 1].identified_misconception}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
        <span className="text-xs text-slate-400">
          Source: {currentQ.source_file}
        </span>

        {!isSubmitted ? (
          <button
            onClick={() => handleSubmitAnswer(false)}
            disabled={currentQ.type === 'mcq' ? selectedOption === null : !typedAnswer.trim()}
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-md transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span>Check Answer</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={handleNextQuestion}
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span>{currentIndex < questions.length - 1 ? 'Next Question' : 'Complete Assessment'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
