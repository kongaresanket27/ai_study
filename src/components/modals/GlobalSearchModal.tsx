/**
 * StudyPilot - Global Search Command Palette (Cmd+K)
 * Real-time fast fuzzy search across all topics, concepts,
 * content units, diagrams, video timestamps, and past quizzes.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Search, X, BookOpen, Presentation, Video, FileText, Image, ArrowRight } from 'lucide-react';
import { Course, ContentUnit, Citation } from '../../types';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Course;
  onSelectUnit: (citation: Citation) => void;
  onSelectTopic: (topicId: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  course,
  onSelectUnit,
  onSelectTopic,
}) => {
  const [query, setQuery] = useState('');

  const searchResults = useMemo(() => {
    if (!query.trim()) return { matchedUnits: [] as ContentUnit[], matchedTopics: [] as Course['topics'] };
    const q = query.toLowerCase().trim();

    const matchedUnits = course.content_units
      .filter(u =>
        u.title.toLowerCase().includes(q) ||
        u.summary.toLowerCase().includes(q) ||
        u.full_text_excerpt.toLowerCase().includes(q) ||
        u.concept_tags.some(tag => tag.toLowerCase().includes(q))
      )
      .slice(0, 8);

    const matchedTopics = course.topics
      .filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.concepts.some(c => c.toLowerCase().includes(q))
      )
      .slice(0, 4);

    return { matchedUnits, matchedTopics };
  }, [query, course]);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 pt-16 sm:pt-24">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
      />

      {/* Palette Container */}
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col animate-in zoom-in-95 duration-150">
        {/* Search Input Field */}
        <div className="flex items-center px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-4 h-4 text-slate-400 mr-2.5 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all lecture slides, video timestamps, formulas, topics..."
            autoFocus
            className="w-full text-sm bg-transparent border-none text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Results Area */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-3">
          {!query.trim() ? (
            <div className="p-6 text-center text-xs text-slate-400">
              <p>{course.content_units.length ? 'Search your uploaded sources and extracted topics.' : 'Upload study materials to search their content here.'}</p>
            </div>
          ) : searchResults.matchedUnits.length === 0 && searchResults.matchedTopics.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No matching content units found for "{query}".
            </div>
          ) : (
            <>
              {/* Matched Topics */}
              {searchResults.matchedTopics.length > 0 && (
                <div className="space-y-1">
                  <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Topics
                  </p>
                  {searchResults.matchedTopics.map((topic) => (
                    <button
                      key={topic.id}
                      onClick={() => {
                        onSelectTopic(topic.id);
                        onClose();
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-left transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <BookOpen className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {topic.title}
                        </span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                    </button>
                  ))}
                </div>
              )}

              {/* Matched Content Units */}
              {searchResults.matchedUnits.length > 0 && (
                <div className="space-y-1">
                  <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Content Units & Sources
                  </p>
                  {searchResults.matchedUnits.map((unit) => {
                    const citation: Citation = {
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

                    return (
                      <button
                        key={unit.id}
                        onClick={() => {
                          onSelectUnit(citation);
                          onClose();
                        }}
                        className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 text-left transition-colors cursor-pointer group"
                      >
                        <div className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 mt-0.5 shrink-0">
                          {unit.source_type === 'video' || unit.source_type === 'youtube' ? (
                            <Video className="w-3.5 h-3.5 text-rose-500" />
                          ) : unit.source_type === 'slide' ? (
                            <Presentation className="w-3.5 h-3.5 text-amber-500" />
                          ) : unit.is_figure ? (
                            <Image className="w-3.5 h-3.5 text-cyan-500" />
                          ) : (
                            <FileText className="w-3.5 h-3.5 text-indigo-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {unit.title}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {unit.source_file} · {unit.source_location}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-2.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 px-4">
          <span>Esc to exit</span>
          <span>Open any result to view its uploaded-source excerpt</span>
        </div>
      </div>
    </div>
  );
};
