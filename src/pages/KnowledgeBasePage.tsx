/**
 * StudyPilot - Courses
 * Hierarchical topic tree (Topics > Subtopics > Concepts with learning progress)
 * paired with a filterable card deck of source-cited content units.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  Presentation,
  Video,
  Image,
  Filter,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Sparkles,
  Layers,
  Trash2,
} from 'lucide-react';
import { useAppStore } from '../store/useStore';
import { ContentUnit, Citation, SourceType } from '../types';

interface KnowledgeBasePageProps {
  store: ReturnType<typeof useAppStore>;
  onNavigateToIngestion: () => void;
  initialSelectedTopicId?: string;
}

export const KnowledgeBasePage: React.FC<KnowledgeBasePageProps> = ({
  store,
  onNavigateToIngestion,
  initialSelectedTopicId,
}) => {
  const { course, topicMastery, openCitation, deleteUploadedMaterial } = store;

  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(initialSelectedTopicId || null);
  const [selectedSourceType, setSelectedSourceType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});

  const toggleTopicExpand = (topicId: string) => {
    setExpandedTopics((prev) => ({ ...prev, [topicId]: !prev[topicId] }));
  };

  useEffect(() => {
    if (initialSelectedTopicId) setSelectedTopicId(initialSelectedTopicId);
  }, [initialSelectedTopicId]);

  // Filter content units
  const filteredUnits = useMemo(() => {
    return course.content_units.filter((unit) => {
      // Topic match
      if (selectedTopicId && unit.topic_id !== selectedTopicId) return false;
      // Source type match
      if (selectedSourceType !== 'all') {
        if (selectedSourceType === 'figure' && !unit.is_figure) return false;
        if (selectedSourceType === 'video') {
          if (unit.source_type !== 'video' && unit.source_type !== 'youtube') return false;
        } else if (selectedSourceType !== 'figure' && unit.source_type !== selectedSourceType) {
          return false;
        }
      }
      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = unit.title.toLowerCase().includes(q);
        const matchesSummary = unit.summary.toLowerCase().includes(q);
        const matchesTags = unit.concept_tags.some((t) => t.toLowerCase().includes(q));
        if (!matchesTitle && !matchesSummary && !matchesTags) return false;
      }
      return true;
    });
  }, [course, selectedTopicId, selectedSourceType, searchQuery]);

  const handleUnitClick = (unit: ContentUnit) => {
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
    openCitation(citation);
  };

  const handleDeleteMaterial = (topicId: string, title: string) => {
    const confirmed = window.confirm(
      `Delete "${title}" and all its uploaded sections? This also removes its topic progress and source-cited tutor answers. Quiz history will be kept.`
    );
    if (!confirmed) return;

    deleteUploadedMaterial(topicId);
    setSelectedTopicId((selected) => selected === topicId ? null : selected);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/60 dark:border-slate-800/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200/50 dark:border-indigo-800/50">
              Multimodal Knowledge Graph
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500">
              {course.content_units.length} source units across {course.topics.length} topics
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            Courses
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Explore uploaded material organized into source-linked content units.
          </p>
        </div>

        <button
          onClick={onNavigateToIngestion}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm transition-colors cursor-pointer shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          <span>Upload More Materials</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xs">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search concepts, equations, tags..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Source Filter Segmented Control */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-x-auto w-full sm:w-auto">
          {[
            { id: 'all', label: 'All Units' },
            { id: 'pdf', label: 'PDF Textbooks' },
            { id: 'slide', label: 'Lecture Slides' },
            { id: 'text', label: 'Notes' },
            { id: 'image', label: 'Images' },
            { id: 'video', label: 'Video Lectures' },
            { id: 'figure', label: 'Figures & Diagrams' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedSourceType(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                selectedSourceType === tab.id
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Two Column Layout: Left Tree & Right Units */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (4 cols): Topic Hierarchy Tree */}
        <div className="lg:col-span-4 p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Topic Hierarchy & Progress
            </span>
            {selectedTopicId && (
              <button
                onClick={() => setSelectedTopicId(null)}
                className="text-[11px] text-indigo-500 hover:underline cursor-pointer"
              >
                Clear Filter
              </button>
            )}
          </div>

          <div className="space-y-1">
            {course.topics.map((topic) => {
              const tm = topicMastery.find((m) => m.topic_id === topic.id);
              const masteryPct = tm ? Math.round(tm.mastery * 100) : 0;
              const isSelected = selectedTopicId === topic.id;
              const isExpanded = !!expandedTopics[topic.id];

              let dotColor = 'bg-rose-500';
              if (masteryPct >= 70) dotColor = 'bg-emerald-500';
              else if (masteryPct >= 40) dotColor = 'bg-amber-500';

              return (
                <div key={topic.id} className="rounded-xl overflow-hidden">
                  <div
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left"
                      onClick={() => setSelectedTopicId(isSelected ? null : topic.id)}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                      <span className="text-xs font-semibold truncate">{topic.title}</span>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                        {tm?.attempts_count ? `${masteryPct}%` : 'New'}
                      </span>
                      <button
                        type="button"
                        aria-label={`Delete uploaded material ${topic.title}`}
                        title="Delete uploaded material"
                        onClick={() => handleDeleteMaterial(topic.id, topic.title)}
                        className="p-1 rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${topic.title}`}
                        aria-expanded={isExpanded}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTopicExpand(topic.id);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Subtopics & Concepts Drawer */}
                  {isExpanded && (
                    <div className="pl-6 pr-2 py-1.5 space-y-1.5 border-l-2 border-slate-200 dark:border-slate-800 ml-3.5 my-1">
                      {topic.subtopics.map((sub, i) => (
                        <div key={i} className="text-[11px] text-slate-500 dark:text-slate-400">
                          <p className="font-medium text-slate-700 dark:text-slate-300">
                            {sub}
                          </p>
                        </div>
                      ))}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {topic.concepts.map((concept, ci) => (
                          <span
                            key={ci}
                            className="text-[10px] text-slate-500 dark:text-slate-400"
                          >
                            #{concept} {ci < topic.concepts.length - 1 ? '·' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column (8 cols): Content Unit Cards Grid */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              Showing {filteredUnits.length} content units {selectedTopicId ? `in selected topic` : ''}
            </span>
            <span>Open any unit to view its source excerpt</span>
          </div>

          {filteredUnits.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {course.content_units.length ? 'No units match these filters' : 'Your courses are empty'}
              </p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {course.content_units.length ? 'Try another search or source filter.' : 'Upload study materials to extract source-linked topics and content.'}
              </p>
              {course.content_units.length === 0 && (
                <button onClick={onNavigateToIngestion} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                  Upload materials
                </button>
              )}
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredUnits.map((unit) => {
              const getBadge = () => {
                switch (unit.source_type) {
                  case 'video':
                  case 'youtube':
                    return { label: `Video · ${unit.source_location}`, icon: Video, color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/40 border-rose-200/50 dark:border-rose-900/40' };
                  case 'slide':
                    return { label: `Slide · ${unit.source_location}`, icon: Presentation, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40 border-amber-200/50 dark:border-amber-900/40' };
                  case 'image':
                    return { label: `Image · ${unit.source_location}`, icon: Presentation, color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200/50 dark:border-cyan-900/40' };
                  case 'text':
                    return { label: `Note · ${unit.source_location}`, icon: FileText, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/50 dark:border-emerald-900/40' };
                  case 'pdf':
                  default:
                    return { label: `PDF · ${unit.source_location}`, icon: FileText, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200/50 dark:border-indigo-800/50' };
                }
              };

              const badge = getBadge();
              const BadgeIcon = badge.icon;

              return (
                <button
                  type="button"
                  key={unit.id}
                  onClick={() => handleUnitClick(unit)}
                  aria-label={`View ${unit.title} from ${unit.source_file}`}
                  className="p-5 text-left rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/90 shadow-xs hover:border-indigo-500/50 dark:hover:border-indigo-500/50 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    {/* Source Badge & Provenance */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${badge.color}`}>
                        <BadgeIcon className="w-3 h-3" />
                        <span>{badge.label}</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 truncate max-w-[120px]">
                        {unit.source_file}
                      </span>
                    </div>

                    {/* Figure Preview if present */}
                    {unit.figure_image_url && (
                      <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 aspect-video bg-slate-950 relative">
                        <img
                          src={unit.figure_image_url}
                          alt={unit.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-medium text-cyan-300">
                          Figure
                        </span>
                      </div>
                    )}

                    {/* Title & Summary */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                        {unit.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-3 leading-relaxed">
                        {unit.summary}
                      </p>
                    </div>
                  </div>

                  {/* Concept Tags Footer */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 truncate max-w-[200px]">
                      {unit.concept_tags.map((t, idx) => (
                        <span key={idx}>
                          #{t} {idx < unit.concept_tags.length - 1 ? '·' : ''}
                        </span>
                      ))}
                    </div>
                    <span className="text-indigo-600 dark:text-indigo-400 text-xs font-medium flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                      <span>View</span>
                      <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          )}
        </div>
      </div>
    </div>
  );
};
