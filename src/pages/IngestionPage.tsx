/**
 * StudyPilot - Multimodal Ingestion Pipeline
 * Ingests uploaded lecture videos, PDFs, text notes, and images
 * with a multi-stage animated extraction pipeline and structured topic DAG construction.
 */

import React, { useState } from 'react';
import {
  UploadCloud,
  FileText,
  Presentation,
  Video,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Loader2,
  Layers,
  X,
} from 'lucide-react';
import { useAppStore } from '../store/useStore';

interface IngestionPageProps {
  store: ReturnType<typeof useAppStore>;
  onExploreKnowledgeBase: () => void;
}

export const IngestionPage: React.FC<IngestionPageProps> = ({
  store,
  onExploreKnowledgeBase,
}) => {
  const { addIngestedContent, course } = store;

  const [files, setFiles] = useState<Array<{ name: string; size: string; type: string; file?: File }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [extractionLog, setExtractionLog] = useState<string[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [ingestionStats, setIngestionStats] = useState({ totalTopics: 0, totalUnits: 0, sourceFiles: 0, multimediaUnits: 0 });

  const pipelineSteps = [
    'Uploading files and checking supported formats',
    'Extracting PDF, PPTX, and text content; analyzing images',
    'Transcribing video and aligning transcript timestamps',
    'Adding source-linked units to Courses',
  ];

  const handleStartIngestion = async () => {
    const actualFiles = files.filter((file) => file.file);
    if (!actualFiles.length) {
      setExtractionLog(['Please add at least one supported file before starting ingestion.']);
      return;
    }

    setIsProcessing(true);
    setIsCompleted(false);
    setCurrentStepIndex(0);
    setIngestionStats({ totalTopics: 0, totalUnits: 0, sourceFiles: actualFiles.length, multimediaUnits: 0 });
    setExtractionLog([
      `Uploading ${actualFiles.length} study material file(s) to ${course.title}...`,
      'Files are processed in parallel, up to 3 at a time. Processing time varies by file size and video duration.',
    ]);

    try {
      const formData = new FormData();
      actualFiles.forEach(({ file }) => {
        if (file) formData.append('files', file);
      });

      setCurrentStepIndex(1);
      setExtractionLog((prev) => [...prev, 'Extracting text and analyzing media in parallel (maximum 3 files at once)...']);

      const response = await fetch('/api/upload-materials', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Upload ingestion failed.');
      }

      setCurrentStepIndex(2);
      setExtractionLog((prev) => [
        ...prev,
        data.message,
        ...(data.warnings || []),
      ]);

      if (data.topics?.length && data.units?.length) {
        addIngestedContent(data.units, data.topics);
      }

      setCurrentStepIndex(3);
      setIngestionStats({
        totalTopics: data.totalTopics || 0,
        totalUnits: data.totalUnits || 0,
        sourceFiles: actualFiles.length,
        multimediaUnits: data.multimediaUnits || 0,
      });
      setExtractionLog((prev) => [
        ...prev,
        'Ingestion complete: Courses now includes the new uploaded material.',
      ]);

      setTimeout(() => {
        setIsProcessing(false);
        setIsCompleted(true);
        setExtractionLog((prev) => [
          ...prev,
          `Ready for grounded tutoring and quiz generation using ${data.totalUnits} uploaded source units.`,
        ]);
      }, 800);
    } catch (error: any) {
      console.error('Ingestion failed:', error);
      setIsProcessing(false);
      setIsCompleted(false);
      setExtractionLog((prev) => [
        ...prev,
        `Error: ${error.message || 'Unknown upload error'}`,
      ]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const addFiles = (incoming: File[]) => {
    const newFiles = incoming.map((file) => ({
      name: file.name,
      size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      type: file.type.startsWith('video/')
        ? 'video'
        : file.type.startsWith('image/')
          ? 'image'
          : file.name.toLowerCase().endsWith('.pdf')
            ? 'pdf'
            : file.name.toLowerCase().endsWith('.pptx')
              ? 'slide'
              : 'text',
      file,
    }));
    setFiles((previous) => [...previous, ...newFiles]);
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200/50 dark:border-indigo-800/50">
            Zero-Preprocessing Pipeline
          </span>
          <span className="text-xs text-slate-400">·</span>
          <span className="text-xs text-slate-500">
            Multimodal Extraction
          </span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
          Multimodal Course Material Ingestion
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Upload PDFs, PowerPoint presentations (.pptx), text or Markdown notes, images, or lecture videos. PowerPoint slide text is extracted with slide citations.
        </p>
      </div>

      {!isProcessing && !isCompleted && (
        <div className="space-y-6">
          {/* Drag & Drop Zone */}
          <label
            onDragOver={(event) => { event.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragOver(false);
              addFiles(Array.from(event.dataTransfer.files));
            }}
            className={`block p-8 border-2 border-dashed rounded-3xl bg-white dark:bg-slate-900/60 text-center cursor-pointer transition-colors group focus-within:ring-2 focus-within:ring-indigo-500 ${
              isDragOver
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40'
                : 'border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500'
            }`}
          >
            <input
              type="file"
              multiple
              accept=".pdf,.pptx,.txt,.md,.mp4,.mov,.webm,.png,.jpg,.jpeg,.webp"
              onChange={handleFileUpload}
              className="sr-only"
              aria-label="Choose study material files"
            />
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
              <UploadCloud className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Drag & Drop course files here, or browse
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Supports PDF, PPTX, TXT/Markdown, PNG/JPEG/WebP images, and MP4/MOV/WebM videos (maximum 25 MB per file). Legacy .ppt files must be saved as .pptx first.
            </p>
          </label>

          {/* Queued Files List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Queued Materials for Ingestion ({files.length} items)
            </h3>
            <div className="space-y-2">
              {files.map((file, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3 truncate">
                    {file.type === 'video' ? (
                      <Video className="w-4 h-4 text-rose-500 shrink-0" />
                    ) : file.type === 'image' || file.type === 'slide' ? (
                      <Presentation className="w-4 h-4 text-indigo-500 shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                    )}
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {file.name}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 shrink-0">
                    {file.size}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiles((previous) => previous.filter((_, fileIndex) => fileIndex !== idx))}
                    aria-label={`Remove ${file.name} from upload queue`}
                    className="ml-2 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Start Pipeline CTA */}
          <button
            onClick={handleStartIngestion}
            disabled={files.length === 0}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Start Multimodal Extraction Pipeline</span>
          </button>
        </div>
      )}

      {/* Live Processing Pipeline */}
      {isProcessing && (
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg space-y-6 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Multimodal Extraction in Progress
              </h3>
            </div>
            <span className="text-xs font-mono text-indigo-500 font-bold">
              Step {currentStepIndex + 1} of {pipelineSteps.length}
            </span>
          </div>

          {/* Stepper Visualization */}
          <div className="space-y-3">
            {pipelineSteps.map((step, idx) => {
              const isPast = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;

              return (
                <div key={idx} className="flex items-center gap-3 text-xs">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 transition-colors ${
                      isPast
                        ? 'bg-emerald-500 text-white'
                        : isCurrent
                        ? 'bg-indigo-600 text-white animate-pulse'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isPast ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                  </div>
                  <span
                    className={`font-medium ${
                      isCurrent
                        ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                        : isPast
                        ? 'text-slate-800 dark:text-slate-200'
                        : 'text-slate-400'
                    }`}
                  >
                    {step}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Live Extraction Stream Log */}
          <div aria-live="polite" className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-cyan-400 space-y-1 max-h-40 overflow-y-auto">
            {extractionLog.map((log, i) => (
              <p key={i}>&gt; {log}</p>
            ))}
          </div>
        </div>
      )}

      {/* Celebratory Completion Summary Card */}
      {isCompleted && (
        <div className="p-8 rounded-3xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-500/30 shadow-xl space-y-6 animate-in zoom-in-95">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">
                Multimodal Ingestion Successful!
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Uploaded materials have been processed and added to Courses.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <p className="text-2xl font-black text-white tabular-nums">{ingestionStats.totalTopics}</p>
              <p className="text-[11px] text-slate-400 font-semibold uppercase mt-1">Topics Indexed</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <p className="text-2xl font-black text-cyan-400 tabular-nums">{ingestionStats.totalUnits}</p>
              <p className="text-[11px] text-slate-400 font-semibold uppercase mt-1">Content Units</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <p className="text-2xl font-black text-emerald-400 tabular-nums">{ingestionStats.sourceFiles}</p>
              <p className="text-[11px] text-slate-400 font-semibold uppercase mt-1">Files Processed</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <p className="text-2xl font-black text-indigo-400 tabular-nums">{ingestionStats.multimediaUnits}</p>
              <p className="text-[11px] text-slate-400 font-semibold uppercase mt-1">Image/Video Units</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onExploreKnowledgeBase}
              className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>Explore Courses</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
