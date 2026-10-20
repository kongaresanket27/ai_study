import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Pause, Play, RotateCw } from 'lucide-react';
import { useAppStore } from '../store/useStore';

interface RevisionHubPageProps {
  store: ReturnType<typeof useAppStore>;
}

export const RevisionHubPage: React.FC<RevisionHubPageProps> = ({ store }) => {
  const { course, topicMastery, openCitation } = store;
  const units = useMemo(() => [...course.content_units].sort((a, b) => {
    const masteryA = topicMastery.find((item) => item.topic_id === a.topic_id)?.mastery ?? 0;
    const masteryB = topicMastery.find((item) => item.topic_id === b.topic_id)?.mastery ?? 0;
    return masteryA - masteryB;
  }), [course.content_units, topicMastery]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const unit = units[index];

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const speak = () => {
    if (!unit || !('speechSynthesis' in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(`${unit.title}. ${unit.summary}. ${unit.full_text_excerpt}`);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  if (!unit) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Revision</h1>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Upload study materials to create revision cards and summaries from your sources.
        </p>
      </div>
    );
  }

  const citation = {
    id: 1,
    unit_id: unit.id,
    source_title: unit.title,
    source_file: unit.source_file,
    source_location: unit.source_location,
    source_type: unit.source_type,
    excerpt: unit.full_text_excerpt,
    figure_image_url: unit.figure_image_url,
    video_timestamp_seconds: unit.video_timestamp_seconds,
    youtube_video_id: unit.youtube_video_id,
  };

  const move = (delta: number) => {
    setIndex((current) => (current + delta + units.length) % units.length);
    setFlipped(false);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Revision from your materials</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Review source sections, with topics needing practice shown first.
        </p>
      </header>
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{index + 1} of {units.length} source sections</span>
        <button onClick={speak} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
          {speaking ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {speaking ? 'Stop reading' : 'Read aloud'}
        </button>
      </div>
      <button
        onClick={() => setFlipped((value) => !value)}
        className="min-h-64 w-full rounded-2xl border border-slate-200 bg-white p-8 text-left shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-500">
          {flipped ? <RotateCw className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
          {flipped ? 'Source excerpt' : unit.topic_name}
        </span>
        <h2 className="mt-5 text-xl font-semibold text-slate-900 dark:text-white">{unit.title}</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600 dark:text-slate-300">
          {flipped ? unit.full_text_excerpt : unit.summary}
        </p>
        <p className="mt-5 text-xs text-slate-400">{unit.source_file} · {unit.source_location}</p>
      </button>
      <div className="flex items-center justify-between">
        <button onClick={() => move(-1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>
        <button onClick={() => openCitation(citation)} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
          View source citation
        </button>
        <button onClick={() => move(1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
