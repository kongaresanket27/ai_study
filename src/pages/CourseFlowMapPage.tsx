/**
 * StudyPilot - Interactive Course Flow Map
 * Visual directed acyclic graph (DAG) of topics and prerequisite edges,
 * colored dynamically by progress from quiz activity.
 */

import React, { useState } from 'react';
import {
  GitFork,
  BookOpen,
  BrainCircuit,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Info,
} from 'lucide-react';
import { useAppStore } from '../store/useStore';
import { Topic } from '../types';

interface CourseFlowMapPageProps {
  store: ReturnType<typeof useAppStore>;
  onStudyTopic: (topicId: string) => void;
  onQuizTopic: (topicId: string) => void;
}

export const CourseFlowMapPage: React.FC<CourseFlowMapPageProps> = ({
  store,
  onStudyTopic,
  onQuizTopic,
}) => {
  const { course, topicMastery } = store;
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const nodePositions = Object.fromEntries(course.topics.map((topic, index) => [
    topic.id,
    { x: 100 + (index % 4) * 240, y: 100 + Math.floor(index / 4) * 130 },
  ]));
  const canvasHeight = Math.max(250, Math.ceil(course.topics.length / 4) * 130 + 100);

  const getNodeColor = (topicId: string) => {
    const tm = topicMastery.find((m) => m.topic_id === topicId);
    if (!tm?.attempts_count) {
      return {
        fill: 'fill-slate-500/10 dark:fill-slate-800/40',
        stroke: 'stroke-slate-400',
        text: 'text-slate-500',
        badge: 'bg-slate-500',
        label: 'Not practiced yet',
      };
    }
    const mastery = tm.mastery;

    if (mastery >= 0.70) {
      return {
        fill: 'fill-emerald-500/10 dark:fill-emerald-950/40',
        stroke: 'stroke-emerald-500',
        text: 'text-emerald-500',
        badge: 'bg-emerald-500',
        label: 'Strong progress',
      };
    } else if (mastery >= 0.40) {
      return {
        fill: 'fill-amber-500/10 dark:fill-amber-950/40',
        stroke: 'stroke-amber-500',
        text: 'text-amber-500',
        badge: 'bg-amber-500',
        label: 'Building progress',
      };
    } else {
      return {
        fill: 'fill-rose-500/10 dark:fill-rose-950/40',
        stroke: 'stroke-rose-500',
        text: 'text-rose-500',
        badge: 'bg-rose-500',
        label: 'Needs practice',
      };
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/60 dark:border-slate-800/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200/50 dark:border-indigo-800/50">
              Topic map
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500">
              {course.topics.length} topics & {course.prerequisites.length} prerequisite connections
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            Visual Course Flow Map
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Explore how uploaded topics connect and track your learning progress.
          </p>
        </div>

        {/* Legend */}
        {course.topics.length > 0 && <div className="flex items-center gap-3 text-xs bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Needs practice</span>
          </span>
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Building progress</span>
          </span>
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Strong progress</span>
          </span>
        </div>}
      </div>

      {course.topics.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
          <p className="font-semibold text-slate-800 dark:text-slate-100">Your topic map is empty</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Upload study materials to build a map from extracted topics.</p>
        </div>
      ) : (
      <div className="relative rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        {/* Canvas Controls */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <button
            onClick={() => setZoomLevel((z) => Math.min(1.4, z + 0.1))}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.1))}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoomLevel(1)}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Reset Zoom"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* SVG DAG Visualizer */}
        <div className="overflow-x-auto p-8 min-h-[460px] flex items-center justify-center">
          <svg
            className="w-full max-w-5xl transition-transform duration-200 ease-out"
            height={canvasHeight}
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center' }}
            viewBox={`0 0 980 ${canvasHeight}`}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#64748b" />
              </marker>
              <marker
                id="arrowhead-active"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#6366f1" />
              </marker>
            </defs>

            {/* Prerequisite Directed Edges */}
            {course.prerequisites.map((edge, idx) => {
              const start = nodePositions[edge.fromTopicId];
              const end = nodePositions[edge.toTopicId];
              if (!start || !end) return null;

              const isConnectedToSelected =
                selectedTopic &&
                (selectedTopic.id === edge.fromTopicId || selectedTopic.id === edge.toTopicId);

              return (
                <g key={idx}>
                  <line
                    x1={start.x + 60}
                    y1={start.y + 25}
                    x2={end.x - 10}
                    y2={end.y + 25}
                    stroke={isConnectedToSelected ? '#6366f1' : '#94a3b8'}
                    strokeWidth={isConnectedToSelected ? 2.5 : 1.5}
                    strokeDasharray={edge.relationship === 'recommends' ? '4 4' : undefined}
                    markerEnd={isConnectedToSelected ? 'url(#arrowhead-active)' : 'url(#arrowhead)'}
                    className="transition-colors duration-200"
                  />
                </g>
              );
            })}

            {/* Topic Nodes */}
            {course.topics.map((topic) => {
              const pos = nodePositions[topic.id] || { x: 200, y: 200 };
              const color = getNodeColor(topic.id);
              const tm = topicMastery.find((m) => m.topic_id === topic.id);
              const pct = tm?.attempts_count ? Math.round(tm.mastery * 100) : null;
              const isSelected = selectedTopic?.id === topic.id;

              return (
                <g
                  key={topic.id}
                  onClick={() => setSelectedTopic(topic)}
                  className="cursor-pointer group"
                >
                  {/* Outer container */}
                  <rect
                    x={pos.x - 70}
                    y={pos.y - 10}
                    width="140"
                    height="70"
                    rx="12"
                    className={`${color.fill} ${color.stroke} transition-all duration-200 ${
                      isSelected ? 'stroke-[2.5px] shadow-lg' : 'stroke-[1.5px] hover:stroke-[2px]'
                    }`}
                  />

                  {/* Topic Title (wrapped / truncated) */}
                  <text
                    x={pos.x}
                    y={pos.y + 15}
                    textAnchor="middle"
                    className="text-[11px] font-bold fill-slate-800 dark:fill-slate-100 select-none group-hover:fill-indigo-500 transition-colors"
                  >
                    {topic.title.length > 18 ? topic.title.substring(0, 16) + '...' : topic.title}
                  </text>

                  {/* Subtitle / Topic ID */}
                  <text
                    x={pos.x}
                    y={pos.y + 32}
                    textAnchor="middle"
                    className="text-[9px] font-medium fill-slate-400 select-none"
                  >
                    {topic.concepts[0]}
                  </text>

                  {/* Mastery Pill */}
                  <rect
                    x={pos.x - 24}
                    y={pos.y + 42}
                    width="48"
                    height="14"
                    rx="7"
                    className="fill-slate-900/80 dark:fill-slate-800"
                  />
                  <text
                    x={pos.x}
                    y={pos.y + 52}
                    textAnchor="middle"
                    className="text-[9px] font-bold fill-white select-none font-mono"
                  >
                    {pct === null ? 'New' : `${pct}%`}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      )}

      {/* Selected Topic Side Drawer / Bottom Card */}
      {selectedTopic && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-6 animate-in slide-in-from-bottom duration-200">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                Selected Topic
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs font-mono text-slate-500">
                {selectedTopic.estimated_study_minutes} min suggested study time
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {selectedTopic.title}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {selectedTopic.description}
            </p>
            <div className="flex flex-wrap gap-1 pt-1">
              {selectedTopic.concepts.map((c, i) => (
                <span
                  key={i}
                  className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium"
                >
                  #{c}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onStudyTopic(`Explain ${selectedTopic.title} step by step`)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-indigo-500" />
              <span>Ask AI Tutor</span>
            </button>
            <button
              onClick={() => onQuizTopic(selectedTopic.id)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm transition-colors cursor-pointer"
            >
              <BrainCircuit className="w-4 h-4" />
              <span>Launch Quiz on This</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
