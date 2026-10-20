/**
 * StudyPilot - Source Viewer Drawer
 * Reusable slide-over drawer triggered by clicking any citation chip [1], [2]
 * in Tutor Chat, Quiz feedback, Courses, or Misconceptions report.
 * Highlights exact excerpts and displays figure details or transcript timestamps.
 */

import React, { useState } from 'react';
import {
  X,
  FileText,
  Presentation,
  Video,
  ExternalLink,
  Copy,
  Check,
  Maximize2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Citation } from '../../types';

interface SourceViewerDrawerProps {
  citation: Citation | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SourceViewerDrawer: React.FC<SourceViewerDrawerProps> = ({
  citation,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [isFigureExpanded, setIsFigureExpanded] = useState(false);

  if (!isOpen || !citation) return null;

  const handleCopyCitation = () => {
    const text = `[Source Citation] ${citation.source_title} - ${citation.source_file} (${citation.source_location})\nExcerpt: "${citation.excerpt}"`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getSourceIcon = () => {
    switch (citation.source_type) {
      case 'video':
      case 'youtube':
        return <Video className="w-4 h-4 text-rose-500" />;
      case 'slide':
      case 'image':
        return <Presentation className="w-4 h-4 text-amber-500" />;
      case 'text':
        return <FileText className="w-4 h-4 text-emerald-500" />;
      case 'pdf':
      default:
        return <FileText className="w-4 h-4 text-indigo-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      />

      {/* Drawer Surface */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
              {getSourceIcon()}
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">Citation [{citation.id}]</span>
                <span>·</span>
                <span>{citation.source_type.toUpperCase()}</span>
                <span>·</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{citation.source_location}</span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-xs sm:max-w-sm">
                {citation.source_title}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* File Provenance Pill */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-2 truncate">
              {getSourceIcon()}
              <span className="font-mono text-slate-700 dark:text-slate-300 truncate">
                {citation.source_file}
              </span>
            </div>
            <span className="shrink-0 font-medium px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50">
              {citation.source_location}
            </span>
          </div>

          {/* Timestamped transcript citation */}
          {(citation.source_type === 'video' || citation.source_type === 'youtube') && (
            <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/20 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
                <Clock className="w-4 h-4" />
                <span>Transcript timestamp: {citation.source_location}</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                {citation.source_type === 'youtube'
                  ? 'This citation points to the matching segment in the public YouTube video.'
                  : 'This citation points to the transcript segment in the uploaded video. The original video is not retained for playback.'}
              </p>
              {citation.youtube_video_id && (
                <a
                  href={`https://www.youtube.com/watch?v=${citation.youtube_video_id}&t=${Math.floor(citation.video_timestamp_seconds || 0)}s`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 hover:underline dark:text-rose-300"
                >
                  Watch video at this timestamp
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          )}

          {/* Figure / Diagram Preview if present */}
          {citation.figure_image_url && citation.source_type !== 'video' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  Extracted Diagram / Slide Figure
                </span>
                <button
                  onClick={() => setIsFigureExpanded(!isFigureExpanded)}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 text-[11px]"
                >
                  <Maximize2 className="w-3 h-3" />
                  {isFigureExpanded ? 'Collapse' : 'Expand'}
                </button>
              </div>
              <div
                className={`rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 transition-all ${
                  isFigureExpanded ? 'max-h-[500px]' : 'max-h-60'
                }`}
              >
                <img
                  src={citation.figure_image_url}
                  alt={citation.source_title}
                  className="w-full h-full object-contain bg-slate-900"
                />
              </div>
            </div>
          )}

          {/* Exact Text Excerpt */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Source Excerpt
            </h4>
            <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 text-sm leading-relaxed text-slate-800 dark:text-slate-200 relative">
              <span className="text-amber-500 font-serif font-bold text-lg select-none mr-1">“</span>
              {citation.excerpt}
              <span className="text-amber-500 font-serif font-bold text-lg select-none ml-1">”</span>
            </div>
          </div>

          {/* Source details */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5 text-slate-600 dark:text-slate-400">
            <div className="flex justify-between">
              <span>Source:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Uploaded material</span>
            </div>
            <div className="flex justify-between">
              <span>Origin File:</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">{citation.source_file}</span>
            </div>
            <div className="flex justify-between">
              <span>Location:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{citation.source_location}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-950/50">
          <button
            onClick={handleCopyCitation}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied to Clipboard' : 'Copy Citation'}</span>
          </button>
          <button
            onClick={onClose}
            className="py-2 px-4 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
