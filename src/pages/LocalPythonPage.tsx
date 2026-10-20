import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, Loader2, Sparkles, Upload, X } from 'lucide-react';
import { ContentUnit, Topic } from '../types';
import { useAppStore } from '../store/useStore';

interface LocalPythonStatus {
  available: boolean;
  python?: string;
  dependencies?: Record<string, boolean>;
  error?: string;
}

interface LocalPythonResult {
  topics: Topic[];
  units: ContentUnit[];
  totalTopics: number;
  totalUnits: number;
  warnings: string[];
  processor: string;
}

const supportedExtensions = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff', '.gif',
  '.docx', '.pptx', '.xlsx', '.xlsm', '.csv', '.txt', '.md',
  '.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.mp4', '.mov', '.webm', '.mkv', '.avi',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isTopic(value: unknown): value is Topic {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    isStringArray(value.subtopics) &&
    isStringArray(value.concepts) &&
    typeof value.estimated_study_minutes === 'number' &&
    isStringArray(value.prerequisite_ids) &&
    typeof value.unit_count === 'number';
}

function isContentUnit(value: unknown): value is ContentUnit {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.summary === 'string' &&
    typeof value.full_text_excerpt === 'string' &&
    typeof value.topic_id === 'string' &&
    typeof value.topic_name === 'string' &&
    typeof value.subtopic === 'string' &&
    isStringArray(value.concept_tags) &&
    ['easy', 'medium', 'hard'].includes(String(value.difficulty)) &&
    typeof value.source_file === 'string' &&
    typeof value.source_location === 'string' &&
    ['pdf', 'slide', 'text', 'image', 'video'].includes(String(value.source_type));
}

async function readResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error('The local Python processor returned an unreadable response. Check the server log and retry.');
  }
}

export const LocalPythonPage: React.FC<{ store: ReturnType<typeof useAppStore> }> = ({ store }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [audioMode, setAudioMode] = useState<'metadata' | 'whisper'>('metadata');
  const [status, setStatus] = useState<LocalPythonStatus | null>(null);
  const [statusError, setStatusError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<LocalPythonResult | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/local-python/status')
      .then(async (response) => {
        const payload = await readResponse(response);
        if (!response.ok) {
          const message = isRecord(payload) && typeof payload.error === 'string'
            ? payload.error
            : 'The local Python processor is not available.';
          throw new Error(message);
        }
        if (!isRecord(payload) || payload.available !== true ||
            typeof payload.python !== 'string' || !isRecord(payload.dependencies)) {
          throw new Error('The Python processor returned incomplete status information.');
        }
        const dependencies = Object.fromEntries(
          Object.entries(payload.dependencies).filter((entry): entry is [string, boolean] =>
            typeof entry[1] === 'boolean',
          ),
        );
        if (isMounted) {
          setStatus({ available: true, python: payload.python, dependencies });
          setStatusError('');
        }
      })
      .catch((requestError: unknown) => {
        if (isMounted) {
          setStatus({ available: false });
          setStatusError(requestError instanceof Error ? requestError.message : 'Could not check Python availability.');
        }
      });

    return () => { isMounted = false; };
  }, []);

  const addFiles = (incoming: File[]) => {
    setError('');
    const invalidFile = incoming.find((file) => {
      const extension = `.${file.name.split('.').pop()?.toLowerCase() || ''}`;
      return !supportedExtensions.has(extension) || file.size > 25 * 1024 * 1024;
    });
    if (invalidFile) {
      setError(`${invalidFile.name} is unsupported or exceeds the 25 MB per-file limit.`);
      return;
    }
    if (files.length + incoming.length > 10) {
      setError('Choose no more than 10 files at a time.');
      return;
    }
    setFiles((previous) => [...previous, ...incoming]);
    setResult(null);
  };

  const handleProcess = async () => {
    if (!files.length || isProcessing) return;

    setIsProcessing(true);
    setError('');
    setResult(null);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      formData.append('audioMode', audioMode);

      const response = await fetch('/api/local-python/process', { method: 'POST', body: formData });
      const payload = await readResponse(response);
      if (!response.ok) {
        const message = isRecord(payload) && typeof payload.error === 'string'
          ? payload.error
          : `Local Python processing failed (${response.status}).`;
        throw new Error(message);
      }
      if (!isRecord(payload) || !Array.isArray(payload.topics) || !payload.topics.every(isTopic) ||
          !Array.isArray(payload.units) || !payload.units.every(isContentUnit) ||
          !Array.isArray(payload.warnings) || !isStringArray(payload.warnings) ||
          typeof payload.totalTopics !== 'number' || payload.totalTopics !== payload.topics.length ||
          typeof payload.totalUnits !== 'number' || payload.totalUnits !== payload.units.length ||
          typeof payload.processor !== 'string') {
        throw new Error('The Python processor returned invalid topic or source data.');
      }

      const processed: LocalPythonResult = {
        topics: payload.topics,
        units: payload.units,
        totalTopics: payload.totalTopics,
        totalUnits: payload.totalUnits,
        warnings: payload.warnings,
        processor: payload.processor,
      };
      if (processed.units.length && processed.topics.length) {
        store.addIngestedContent(processed.units, processed.topics);
      }
      setResult(processed);
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Local Python processing failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const missingDependencies = status?.dependencies
    ? Object.entries(status.dependencies).filter(([, available]) => !available).map(([name]) => name)
    : [];

  return (
    <div className="mx-auto max-w-4xl space-y-7 p-6 md:p-8">
      <header className="border-b border-slate-200/60 pb-5 dark:border-slate-800/60">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
          <span className="rounded-md border border-indigo-200/60 bg-indigo-50 px-2 py-1 dark:border-indigo-800 dark:bg-indigo-950/50">
            Offline processing
          </span>
          <span className="text-slate-400">Python Local Lab</span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Process files with Python</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
          Extract content locally from PDFs, images, Office files, spreadsheets, text, audio, and video.
          This workspace uses Python libraries and does not call Gemini or external AI APIs.
          Topic labels and summaries are generated extractively from your file content.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          {status?.available
            ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
            : <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />}
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {status?.available ? `Python ${status.python} is ready` : 'Checking local Python setup'}
            </h2>
            {statusError && <p role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">{statusError}</p>}
            {missingDependencies.length > 0 && (
              <p className="mt-1 text-xs leading-5 text-amber-700 dark:text-amber-300">
                Missing Python packages: {missingDependencies.join(', ')}. Install the dependencies from
                {' '}<code>python/requirements.txt</code> to enable all processing features.
              </p>
            )}
            {status?.available && missingDependencies.length === 0 && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                PDF, OCR, Office, spreadsheet, and local media libraries are installed.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Choose local files</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Up to 10 files, 25 MB each. Supports PDF, PNG/JPEG/WebP/TIFF, DOCX/PPTX, XLSX/CSV,
            TXT/Markdown, and common audio/video formats.
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff,.gif,.docx,.pptx,.xlsx,.xlsm,.csv,.txt,.md,.mp3,.wav,.m4a,.aac,.ogg,.flac,.mp4,.mov,.webm,.mkv,.avi"
          onChange={(event) => {
            if (event.target.files) addFiles(Array.from(event.target.files));
            event.target.value = '';
          }}
          aria-label="Choose files for Python processing"
          className="block w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 file:mr-4 file:border-0 file:bg-indigo-600 file:px-4 file:py-2.5 file:text-xs file:font-semibold file:text-white hover:file:bg-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
        />

        {files.length > 0 && (
          <ul className="space-y-2">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
                <FileText className="h-4 w-4 shrink-0 text-indigo-500" />
                <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-200">{file.name}</span>
                <span className="shrink-0 text-slate-400">{(file.size / (1024 * 1024)).toFixed(1)} MB</span>
                <button
                  type="button"
                  onClick={() => setFiles((previous) => previous.filter((_, fileIndex) => fileIndex !== index))}
                  aria-label={`Remove ${file.name}`}
                  className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <fieldset className="space-y-2">
          <legend className="text-xs font-bold text-slate-800 dark:text-slate-200">Audio and video</legend>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <input
              type="radio"
              name="python-audio-mode"
              value="metadata"
              checked={audioMode === 'metadata'}
              onChange={() => setAudioMode('metadata')}
              className="mt-0.5 accent-indigo-600"
            />
            <span>
              <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200">Metadata only</span>
              <span className="mt-0.5 block text-[11px] leading-5 text-slate-500 dark:text-slate-400">Read duration and media stream details locally.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <input
              type="radio"
              name="python-audio-mode"
              value="whisper"
              checked={audioMode === 'whisper'}
              onChange={() => setAudioMode('whisper')}
              className="mt-0.5 accent-indigo-600"
            />
            <span>
              <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200">Transcribe with local Whisper</span>
              <span className="mt-0.5 block text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                Runs on your computer. The first transcription downloads the small Whisper model; it does not send audio to an AI API.
              </span>
            </span>
          </label>
        </fieldset>

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleProcess()}
          disabled={!files.length || isProcessing || !status?.available}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-md transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {isProcessing ? 'Processing locally with Python…' : 'Process files locally'}
        </button>
      </section>

      {result && (
        <section aria-live="polite" className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Local Python processing complete</h2>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {result.totalTopics} topic(s) and {result.totalUnits} source section(s) added to Courses using {result.processor}.
          </p>
          {result.topics.map((topic) => (
            <article key={topic.id} className="rounded-xl border border-emerald-200/80 bg-white p-4 dark:border-emerald-900/50 dark:bg-slate-900">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{topic.title}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">{topic.description}</p>
              <p className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
                Concepts: {topic.concepts.slice(0, 8).join(', ')}
              </p>
            </article>
          ))}
          {result.warnings.map((warning, index) => (
            <p key={`${warning}-${index}`} className="text-xs text-amber-700 dark:text-amber-300">{warning}</p>
          ))}
        </section>
      )}
    </div>
  );
};
