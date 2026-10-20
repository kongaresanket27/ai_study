/**
 * StudyPilot - Full-Stack Server Entry Point
 * Mounts Express API endpoints with server-side @google/genai SDK
 * and integrates Vite dev server middlewares.
 */

import express from 'express';
import multer from 'multer';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { PDFParse } from 'pdf-parse';
import { FileState, GoogleGenAI } from '@google/genai';
import { OfficeParser, type OfficeContentNode } from 'officeparser';
import { registerLocalAuthRoutes } from './server/localAuth';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

const localPythonProcessorPath = path.join(__dirname, 'python', 'local_processor.py');
const localPythonSupportedExtensions = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff', '.gif',
  '.docx', '.pptx', '.xlsx', '.xlsm', '.csv', '.txt', '.md',
  '.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.mp4', '.mov', '.webm', '.mkv', '.avi',
]);

function runLocalPythonProcessor(args: string[], input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const pythonCommand = process.env.STUDYPILOT_PYTHON || 'python';
    const child = spawn(pythonCommand, [localPythonProcessorPath, ...args], {
      cwd: __dirname,
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('Local Python processing timed out. Try fewer files or shorter audio/video.'));
    }, 30 * 60 * 1000);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(new Error(`Could not start the local Python processor. Install Python 3 and the project requirements. ${error.message}`));
    });
    child.once('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(stderr.trim() || `The local Python processor exited with code ${code ?? 'unknown'}.`));
        return;
      }
      resolve(stdout);
    });
    child.stdin.end(input);
  });
}

app.use(express.json({ limit: '50mb' }));
registerLocalAuthRoutes(app);

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'material';
}

function inferTopicTitle(fileName: string): string {
  const base = fileName.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');
  return base.trim() || 'Uploaded Study Material';
}

function toSentenceCase(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Study material section';
  return cleaned.length > 160 ? `${cleaned.slice(0, 157).trim()}...` : cleaned;
}

function getConceptTags(text: string): string[] {
  const candidates = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 4 && !['about', 'these', 'study', 'chapter', 'lecture', 'material'].includes(token));

  const unique = Array.from(new Set(candidates)).slice(0, 5);
  return unique.length > 0 ? unique : ['core concept', 'study material'];
}

async function extractTextFromUploadedFile(file: Express.Multer.File): Promise<string> {
  if (!file.buffer || file.buffer.length === 0) return '';

  const lowerName = file.originalname.toLowerCase();

  if (lowerName.endsWith('.pdf')) {
    const parser = new PDFParse({ data: new Uint8Array(file.buffer) });
    try {
      const data = await parser.getText();
      return (data.text || '').trim();
    } finally {
      await parser.destroy();
    }
  }

  return file.buffer.toString('utf8');
}

async function createUnitsFromPresentation(file: Express.Multer.File) {
  const topicTitle = inferTopicTitle(file.originalname);
  const topicId = `uploaded-topic-${slugify(topicTitle)}-${randomUUID()}`;
  const presentation = await OfficeParser.parseOffice(new Uint8Array(file.buffer));
  const slides = presentation.content.filter((node) => node.type === 'slide');
  const getNodeText = (node: OfficeContentNode): string => {
    if (node.text?.trim()) return node.text.trim();
    return node.children?.map(getNodeText).filter(Boolean).join('\n') || '';
  };
  const units = slides.flatMap((slide, index) => {
    const excerpt = getNodeText(slide).replace(/\s+/g, ' ').trim();
    if (!excerpt) return [];

    const boundedExcerpt = excerpt.length > 1800 ? `${excerpt.slice(0, 1800).trim()}...` : excerpt;
    const slideNumber = slide.metadata?.slideNumber || index + 1;
    return [{
      id: `uploaded-unit-${randomUUID()}`,
      title: `${topicTitle} • Slide ${slideNumber}`,
      summary: toSentenceCase(boundedExcerpt),
      full_text_excerpt: boundedExcerpt,
      topic_id: topicId,
      topic_name: topicTitle,
      subtopic: 'Presentation slides',
      concept_tags: getConceptTags(boundedExcerpt),
      difficulty: 'medium' as const,
      source_type: 'slide' as const,
      source_file: file.originalname,
      source_location: `Slide ${slideNumber}`,
    }];
  });

  const topic = {
    id: topicId,
    title: topicTitle,
    description: `Uploaded PowerPoint presentation from ${file.originalname}. Extracted slide text is available for tutoring and revision.`,
    subtopics: ['Presentation slides'],
    concepts: getConceptTags(units.map((unit) => unit.full_text_excerpt).join(' ')),
    estimated_study_minutes: Math.max(15, Math.min(120, units.length * 5)),
    prerequisite_ids: [],
    unit_count: units.length,
  };

  return { topic, units };
}

function getMimeType(file: Express.Multer.File): string {
  const extension = path.extname(file.originalname).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
    '.pdf': 'application/pdf',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  };

  return mimeTypes[extension] || file.mimetype || 'application/octet-stream';
}

async function uploadGeminiFile(file: Express.Multer.File) {
  if (!ai) {
    throw new Error('Multimodal image/video processing requires GEMINI_API_KEY on the server.');
  }

  const mimeType = getMimeType(file);
  let uploaded = await ai.files.upload({
    file: new Blob([new Uint8Array(file.buffer)], { type: mimeType }),
    config: { mimeType, displayName: file.originalname },
  });

  if (!uploaded.name) {
    throw new Error(`Gemini did not return a file ID for ${file.originalname}.`);
  }
  const uploadedName = uploaded.name;

  for (let attempt = 0; uploaded.state === FileState.PROCESSING && attempt < 90; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    uploaded = await ai.files.get({ name: uploadedName });
  }

  if (uploaded.state !== FileState.ACTIVE || !uploaded.uri) {
    const detail = uploaded.error?.message || `File processing ended in state ${uploaded.state || 'unknown'}.`;
    await ai.files.delete({ name: uploadedName }).catch((error) => {
      console.warn(`Could not delete failed Gemini upload ${uploadedName}:`, error);
    });
    throw new Error(`Could not prepare ${file.originalname} for multimodal analysis. ${detail}`);
  }

  return uploaded;
}

function parseGeminiJson<T>(text: string | undefined, fileName: string): T {
  const cleaned = (text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  if (!cleaned) {
    throw new Error(`Gemini returned no analysis for ${fileName}.`);
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`Gemini returned invalid structured analysis for ${fileName}.`);
  }
}

function isTransientGeminiError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const details = typeof error === 'object' && error !== null
    ? error as { status?: unknown; code?: unknown }
    : {};
  const status = Number(details.status ?? details.code);
  return [429, 500, 502, 503, 504].includes(status) ||
    /\b(?:429|500|502|503|504)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|temporarily unavailable/i.test(message);
}

async function generateWithTransientRetry<T>(
  client: GoogleGenAI,
  generate: (client: GoogleGenAI) => Promise<T>
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await generate(client);
    } catch (error) {
      if (!isTransientGeminiError(error) || attempt >= 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
}

function formatTimestamp(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
    : `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

interface VideoSegment {
  start_seconds?: number;
  transcript?: string;
  visual_description?: string;
  concepts?: string[];
}

interface VideoAnalysis {
  segments?: VideoSegment[];
}

function parseYouTubeVideoUrl(value: unknown): { videoId: string; url: string } {
  if (typeof value !== 'string' || value.length > 2048) {
    throw new Error('Each video source must be a valid YouTube URL.');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error('Enter a valid YouTube video URL.');
  }

  const supportedHosts = new Set([
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'youtu.be',
    'youtube-nocookie.com',
    'www.youtube-nocookie.com',
  ]);
  if (parsedUrl.protocol !== 'https:' || !supportedHosts.has(parsedUrl.hostname.toLowerCase()) ||
      parsedUrl.username || parsedUrl.password) {
    throw new Error('Only HTTPS links to YouTube videos are supported.');
  }

  const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
  const videoId = parsedUrl.hostname.toLowerCase() === 'youtu.be'
    ? pathParts[0]
    : pathParts[0] === 'watch'
      ? parsedUrl.searchParams.get('v') || undefined
      : ['shorts', 'embed', 'live', 'v'].includes(pathParts[0] || '')
        ? pathParts[1]
        : undefined;

  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    throw new Error('Enter a YouTube video URL with a valid video ID.');
  }

  return {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

async function analyzeVisualFile(file: Express.Multer.File) {
  const uploaded = await uploadGeminiFile(file);
  if (!ai || !uploaded.uri || !uploaded.name) {
    throw new Error(`Could not analyze ${file.originalname}: the multimodal service did not provide a file URI.`);
  }
  const uploadedName = uploaded.name;

  const isVideo = getMimeType(file).startsWith('video/');
  const isPdf = getMimeType(file) === 'application/pdf';
  const prompt = isVideo
    ? `Analyze the lecture video "${file.originalname}". Transcribe the spoken educational content and split it into short, meaningful consecutive segments. For each segment, include its start time in seconds, a faithful transcript, a concise description of relevant on-screen teaching/diagrams when present, and 1-5 concepts. Return only JSON: {"segments":[{"start_seconds":0,"transcript":"...","visual_description":"...","concepts":["..."]}]}. Do not invent words or timestamps. Use an empty visual_description when none is relevant.`
    : isPdf
      ? `Inspect "${file.originalname}" for instructional figures, diagrams, charts, and equations presented visually. Do not repeat ordinary running text. Return only JSON: {"figures":[{"page":1,"caption":"...","description":"Explain the visible diagram/chart/equation and its educational meaning.","visible_text":"Important labels or equation text, if readable","concepts":["..."]}]}. Use the actual one-based PDF page number. If no relevant figures are present, return {"figures":[]}.`
      : `Analyze the educational image "${file.originalname}". Describe the diagram/figure and its meaning using only visible evidence. Transcribe important labels or equations. Return only JSON: {"figures":[{"page":null,"caption":"Short figure title","description":"Clear explanation of what the image communicates.","visible_text":"Important visible labels or equation text","concepts":["..."]}]}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { fileData: { fileUri: uploaded.uri, mimeType: uploaded.mimeType || getMimeType(file) } },
        ],
      }],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });
    return parseGeminiJson<{ figures?: Array<{ page?: number | null; caption?: string; description?: string; visible_text?: string; concepts?: string[] }>; segments?: VideoSegment[] }>(response.text, file.originalname);
  } finally {
    await ai.files.delete({ name: uploadedName }).catch((error) => {
      console.warn(`Could not delete temporary Gemini upload ${uploadedName}:`, error);
    });
  }
}

async function analyzeYouTubeVideo(videoUrl: string): Promise<VideoAnalysis> {
  if (!ai) {
    throw new Error('YouTube video transcription requires GEMINI_API_KEY on the server.');
  }

  const prompt = 'Analyze this public educational YouTube video. Transcribe the spoken educational content and split it into short, meaningful consecutive segments. For each segment, include its start time in seconds, a faithful transcript, a concise description of relevant on-screen teaching/diagrams when present, and 1-5 concepts. Return only JSON: {"segments":[{"start_seconds":0,"transcript":"...","visual_description":"...","concepts":["..."]}]}. Do not invent words or timestamps. Use an empty visual_description when none is relevant.';
  const response = await generateWithTransientRetry(ai, (client) => client.interactions.create({
    model: 'gemini-3.8-flash',
    input: [
      { type: 'text', text: prompt },
      { type: 'video', uri: videoUrl },
    ],
  }));

  return parseGeminiJson<VideoAnalysis>(response.output_text, videoUrl);
}

function createVideoUnits(
  sourceFile: string,
  topic: { id: string; title: string },
  segments: VideoSegment[],
  sourceType: 'video' | 'youtube',
  youtubeVideoId?: string,
) {
  return segments.flatMap((segment) => {
    const transcript = segment.transcript?.trim();
    const startSeconds = Number(segment.start_seconds);
    if (!transcript || !Number.isFinite(startSeconds) || startSeconds < 0) return [];
    const visualDescription = segment.visual_description?.trim();
    const excerpt = [transcript, visualDescription && `Visual: ${visualDescription}`].filter(Boolean).join('\n');

    return [{
      id: `uploaded-video-${randomUUID()}`,
      title: `Lecture segment at ${formatTimestamp(startSeconds)}`,
      summary: toSentenceCase(excerpt),
      full_text_excerpt: excerpt,
      topic_id: topic.id,
      topic_name: topic.title,
      subtopic: 'Lecture transcript',
      concept_tags: segment.concepts?.length ? segment.concepts.slice(0, 5) : getConceptTags(excerpt),
      difficulty: 'medium' as const,
      source_type: sourceType,
      source_file: sourceFile,
      source_location: formatTimestamp(startSeconds),
      video_timestamp_seconds: startSeconds,
      ...(youtubeVideoId ? { youtube_video_id: youtubeVideoId } : {}),
    }];
  });
}

function createVisualUnits(
  file: Express.Multer.File,
  topic: { id: string; title: string },
  analysis: Awaited<ReturnType<typeof analyzeVisualFile>>,
) {
  const mimeType = getMimeType(file);
  const sourceType = mimeType.startsWith('video/') ? 'video' : mimeType.startsWith('image/') ? 'image' : 'pdf';
  const fileName = file.originalname;
  const figures = (analysis.figures || []).map((figure, index) => {
    const caption = figure.caption?.trim() || `Figure ${index + 1}`;
    const description = figure.description?.trim() || '';
    const visibleText = figure.visible_text?.trim() || '';
    const excerpt = [description, visibleText && `Visible labels: ${visibleText}`]
      .filter(Boolean)
      .join('\n');
    const page = Number.isFinite(figure.page) && Number(figure.page) > 0 ? Number(figure.page) : undefined;

    return {
      id: `uploaded-figure-${randomUUID()}`,
      title: caption,
      summary: toSentenceCase(excerpt || caption),
      full_text_excerpt: excerpt || caption,
      topic_id: topic.id,
      topic_name: topic.title,
      subtopic: 'Visual explanations',
      concept_tags: figure.concepts?.length ? figure.concepts.slice(0, 5) : getConceptTags(`${caption} ${excerpt}`),
      difficulty: 'medium' as const,
      source_type: sourceType,
      source_file: fileName,
      source_location: page ? `Page ${page}` : 'Image',
      is_figure: true,
      figure_caption: caption,
    };
  });

  const segments = sourceType === 'video'
    ? createVideoUnits(fileName, topic, analysis.segments || [], 'video')
    : [];

  return [...figures, ...segments];
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  });

  await Promise.all(workers);
  return results;
}

function createUnitsFromText(fileName: string, text: string) {
  const normalized = text.replace(/\r/g, '').trim();
  if (!normalized) return { topic: null, units: [] };

  const topicTitle = inferTopicTitle(fileName);
  const topicId = `uploaded-topic-${slugify(topicTitle)}-${randomUUID()}`;
  const topic = {
    id: topicId,
    title: topicTitle,
    description: `Uploaded study material from ${fileName}. Extracted into a structured knowledge base for tutoring and revision.`,
    subtopics: ['Core concepts', 'Worked examples', 'Applications'],
    concepts: getConceptTags(normalized),
    estimated_study_minutes: 30,
    prerequisite_ids: [],
    unit_count: 0,
  };

  const blocks = normalized
    .split(/\n{2,}|\.(?=\s+[A-Z])|\b(?:Introduction|Overview|Summary|Key idea|Example|Definition|Conclusion)\s*[:\-]?\s*/)
    .map((block) => block.replace(/\s+/g, ' ').trim())
    .filter((block) => block.length > 120);

  const units = (blocks.length > 0 ? blocks : [normalized]).map((block, index) => {
    const excerpt = block.length > 1800 ? `${block.slice(0, 1800).trim()}...` : block;
    return {
      id: `uploaded-unit-${randomUUID()}`,
      title: `${topicTitle} • Section ${index + 1}`,
      summary: toSentenceCase(excerpt),
      full_text_excerpt: excerpt,
      topic_id: topicId,
      topic_name: topicTitle,
      subtopic: index % 2 === 0 ? 'Core concepts' : 'Worked examples',
      concept_tags: getConceptTags(excerpt),
      difficulty: (index % 3 === 0 ? 'hard' : index % 2 === 0 ? 'medium' : 'easy') as 'easy' | 'medium' | 'hard',
      source_type: fileName.toLowerCase().endsWith('.pdf')
        ? 'pdf'
        : /\.(txt|md)$/i.test(fileName)
          ? 'text'
          : 'slide',
      source_file: fileName,
      source_location: `Section ${index + 1}`,
      video_timestamp_seconds: undefined,
    };
  });

  topic.unit_count = units.length;

  return { topic, units };
}

// Shared server-side Gemini client with required User-Agent
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err) {
    console.error('Failed to initialize GoogleGenAI client:', err);
  }
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/local-python/status', async (_req, res) => {
  try {
    const output = await runLocalPythonProcessor(['--check'], '');
    const status = JSON.parse(output) as { python: string; dependencies: Record<string, boolean> };
    res.json({ available: true, ...status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not check the local Python processor.';
    res.status(503).json({ available: false, error: message });
  }
});

app.post('/api/local-python/process', upload.array('files', 10), async (req, res) => {
  let temporaryDirectory: string | undefined;
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) {
      return res.status(400).json({ error: 'Choose at least one file for local Python processing.' });
    }
    if (files.length > 10) {
      return res.status(400).json({ error: 'Process no more than 10 files at a time.' });
    }
    const audioMode = req.body.audioMode;
    if (audioMode !== 'metadata' && audioMode !== 'whisper') {
      return res.status(400).json({ error: 'Choose metadata-only or local Whisper audio/video processing.' });
    }

    for (const file of files) {
      const extension = path.extname(file.originalname).toLowerCase();
      if (!localPythonSupportedExtensions.has(extension)) {
        return res.status(400).json({
          error: `Unsupported file type for ${file.originalname}. Choose PDF, image, Office, CSV, text, audio, or video files.`,
        });
      }
    }

    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'studypilot-python-'));
    const manifest = await Promise.all(files.map(async (file, index) => {
      const extension = path.extname(file.originalname).toLowerCase();
      const storedName = `material-${index}${extension}`;
      const filePath = path.join(temporaryDirectory as string, storedName);
      await writeFile(filePath, file.buffer, { flag: 'wx' });
      return { name: path.basename(file.originalname.replace(/\\/g, '/')), path: filePath };
    }));

    const output = await runLocalPythonProcessor([], JSON.stringify({ files: manifest, audioMode }));
    let result: unknown;
    try {
      result = JSON.parse(output);
    } catch {
      throw new Error('The Python processor returned an invalid result. Check the local processor installation and retry.');
    }
    if (typeof result !== 'object' || result === null ||
        !Array.isArray((result as { topics?: unknown }).topics) ||
        !Array.isArray((result as { units?: unknown }).units)) {
      throw new Error('The Python processor returned an incomplete result.');
    }
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Local Python processing failed.';
    console.error('Local Python processing failed:', error);
    res.status(500).json({ error: message });
  } finally {
    if (temporaryDirectory) {
      try {
        await rm(temporaryDirectory, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Could not clean up temporary local Python files in ${temporaryDirectory}:`, error);
      }
    }
  }
});

app.post('/api/upload-materials', upload.array('files', 10), async (req, res) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    let videoUrls: Array<{ videoId: string; url: string }>;
    try {
      const requestedUrls = req.body.videoUrls === undefined ? [] : JSON.parse(req.body.videoUrls);
      if (!Array.isArray(requestedUrls)) {
        throw new Error('Video URLs must be submitted as a list.');
      }
      videoUrls = requestedUrls.map(parseYouTubeVideoUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Video URLs must be submitted as a valid list.';
      return res.status(400).json({ error: message });
    }

    if (files.length + videoUrls.length > 10) {
      return res.status(400).json({ error: 'Add no more than 10 files and video URLs per ingestion.' });
    }
    if (!files.length && !videoUrls.length) {
      return res.status(400).json({ error: 'Add at least one file or public YouTube video URL.' });
    }

    const multimodalFiles = files.filter((file) => {
      const mimeType = getMimeType(file);
      return mimeType.startsWith('image/') || mimeType.startsWith('video/');
    });
    if ((multimodalFiles.length > 0 || videoUrls.length > 0) && !ai) {
      return res.status(503).json({
        error: 'Image analysis and video transcription require GEMINI_API_KEY. Add a valid key to the server .env file and restart the app.',
      });
    }

    for (const file of files) {
      const mimeType = getMimeType(file);
      const extension = path.extname(file.originalname).toLowerCase();
      if (extension === '.ppt') {
        return res.status(400).json({
          error: `Legacy PowerPoint files (.ppt) are not supported. Save ${file.originalname} as a .pptx file and upload it again.`,
        });
      }
      const isPresentation = extension === '.pptx';
      if (!mimeType.startsWith('image/') && !mimeType.startsWith('video/') && mimeType !== 'application/pdf' &&
          !['text/plain', 'text/markdown'].includes(mimeType) && !isPresentation) {
        return res.status(400).json({
          error: `Unsupported file type for ${file.originalname}. Upload a PDF, PPTX, text/Markdown file, image, or video.`,
        });
      }
    }

    const fileResults = await mapWithConcurrency(files, 3, async (file) => {
      const fileTopics: any[] = [];
      const fileUnits: any[] = [];
      const fileWarnings: string[] = [];
      let topic: { id: string; title: string } | null = null;

      try {
        const mimeType = getMimeType(file);
        if (path.extname(file.originalname).toLowerCase() === '.pptx') {
          const parsed = await createUnitsFromPresentation(file);
          if (parsed.units.length) {
            topic = parsed.topic;
            fileTopics.push(parsed.topic);
            fileUnits.push(...parsed.units);
          } else {
            fileWarnings.push(`No readable slide text was extracted from ${file.originalname}.`);
          }
        } else if (mimeType === 'application/pdf' || mimeType === 'text/plain' || mimeType === 'text/markdown') {
          const text = await extractTextFromUploadedFile(file);
          const parsed = createUnitsFromText(file.originalname, text);
          if (parsed.topic && parsed.units.length) {
            topic = parsed.topic;
            fileTopics.push(parsed.topic);
            fileUnits.push(...parsed.units);
          }
        }

        const shouldAnalyzeVisually = mimeType.startsWith('image/') || mimeType.startsWith('video/') || mimeType === 'application/pdf';
        if (shouldAnalyzeVisually && ai) {
          const analysis = await analyzeVisualFile(file);
          if (!topic) {
            const title = inferTopicTitle(file.originalname);
            topic = {
              id: `uploaded-topic-${slugify(title)}-${randomUUID()}`,
              title,
            };
            fileTopics.push({
              ...topic,
              description: `Multimodal study material from ${file.originalname}.`,
              subtopics: mimeType.startsWith('video/') ? ['Lecture transcript', 'Visual explanations'] : ['Visual explanations'],
              concepts: [],
              estimated_study_minutes: 30,
              prerequisite_ids: [],
              unit_count: 0,
            });
          }

          const visualUnits = createVisualUnits(file, topic, analysis);
          if (visualUnits.length > 0) {
            fileUnits.push(...visualUnits);
            const topicRecord = fileTopics.find((item) => item.id === topic?.id);
            if (topicRecord) {
              topicRecord.unit_count += visualUnits.length;
              topicRecord.concepts = Array.from(new Set([
                ...topicRecord.concepts,
                ...visualUnits.flatMap((unit) => unit.concept_tags),
              ])).slice(0, 12);
            }
          } else if (mimeType.startsWith('video/')) {
            fileWarnings.push(`No timestamped speech segments were detected in ${file.originalname}.`);
          }
        } else if (mimeType === 'application/pdf' && !ai) {
          fileWarnings.push(`Diagram/figure analysis was skipped for ${file.originalname}; configure GEMINI_API_KEY to enable it.`);
        }

        if (!fileUnits.length) {
          fileWarnings.push(`No readable text or media content was extracted from ${file.originalname}.`);
        }

        return { topics: fileTopics, units: fileUnits, warnings: fileWarnings };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown processing error';
        console.error(`Failed to process uploaded file ${file.originalname}:`, error);
        return { topics: [], units: [], warnings: [`Could not process ${file.originalname}: ${message}`] };
      }
    });

    const videoResults = await mapWithConcurrency(videoUrls, 3, async ({ videoId, url }) => {
      const topicTitle = `YouTube video ${videoId}`;
      const topic = {
        id: `uploaded-topic-youtube-${videoId}-${randomUUID()}`,
        title: topicTitle,
      };

      try {
        const analysis = await analyzeYouTubeVideo(url);
        const units = createVideoUnits(url, topic, analysis.segments || [], 'youtube', videoId);
        if (!units.length) {
          return {
            topics: [],
            units: [],
            warnings: [`No timestamped speech segments were detected in ${url}.`],
          };
        }
        return {
          topics: [{
            ...topic,
            description: `Timestamped transcript from the public YouTube video ${url}.`,
            subtopics: ['Lecture transcript'],
            concepts: Array.from(new Set(units.flatMap((unit) => unit.concept_tags))).slice(0, 12),
            estimated_study_minutes: Math.max(15, Math.min(120, units.length * 5)),
            prerequisite_ids: [],
            unit_count: units.length,
          }],
          units,
          warnings: [],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown processing error';
        console.error(`Failed to process YouTube video ${url}:`, error);
        return { topics: [], units: [], warnings: [`Could not process ${url}: ${message}`] };
      }
    });

    const results = [...fileResults, ...videoResults];
    const topics = results.flatMap((result) => result.topics);
    const units = results.flatMap((result) => result.units);
    const warnings = results.flatMap((result) => result.warnings);

    if (!units.length) {
      return res.status(422).json({
        error: 'No readable text, figures, or transcript segments were found in the uploaded files.',
        warnings,
      });
    }

    res.json({
      message: `Processed ${files.length + videoUrls.length} source(s) with up to 3 running concurrently; extracted ${units.length} source-grounded content unit(s).`,
      topics,
      units,
      totalUnits: units.length,
      totalTopics: topics.length,
      multimediaUnits: units.filter((unit) => unit.is_figure || typeof unit.video_timestamp_seconds === 'number').length,
      uploadedFiles: files.map((file) => file.originalname),
      processedVideoUrls: videoUrls.map(({ url }) => url),
      warnings,
    });
  } catch (err: any) {
    console.error('Upload Error:', err);
    res.status(500).json({ error: err.message || 'Failed to process uploaded materials.' });
  }
});

// Grounded Tutor Chat Endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, citations, mode, learnerMasteryLevel } = req.body;

    if (!ai) {
      return res.status(503).json({ error: 'GEMINI_API_KEY not configured on server' });
    }

    const validCitations = Array.isArray(citations) ? citations.filter((citation: any) =>
      citation && typeof citation.unit_id === 'string' && typeof citation.excerpt === 'string' &&
      typeof citation.source_file === 'string' && typeof citation.source_location === 'string'
    ) : [];
    if (!message || !validCitations.length) {
      return res.status(400).json({ error: 'A tutor response requires uploaded source excerpts. Upload relevant material and try again.' });
    }
    const citationsText = validCitations
      .map((c: any, i: number) => `[Source ${i + 1}] (${c.source_file}, ${c.source_location})\nTitle: ${c.source_title}\nExcerpt: "${c.excerpt}"`)
      .join('\n\n');

    let modePrompt = 'Provide an authoritative, source-grounded academic explanation with step-by-step logic.';
    if (mode === 'eli5') modePrompt = 'Explain in simple everyday intuitive terms without heavy jargon.';
    if (mode === 'step_by_step') modePrompt = 'Explain in numbered sequential logical steps.';
    if (mode === 'socratic') modePrompt = 'Ask guiding questions to help the student derive the answer from the excerpts.';

    const systemInstruction = `You are StudyPilot, an elite university tutor.
CRITICAL GROUNDING RULES:
1. Base your answer EXCLUSIVELY on the provided course sources below.
2. Every claim must have an inline bracket citation like [1] or [2] matching the source index.
3. If the sources do NOT contain enough information to answer, state clearly that it is not covered in the course syllabus.
4. Adapt to the student's mastery level: ${learnerMasteryLevel}.
5. Style: ${modePrompt}`;

    const prompt = `Course Sources:\n${citationsText}\n\nStudent Question: "${message}"`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.2, // low temperature for high grounding fidelity
      },
    });

    const answerText = response.text?.trim() || '';
    if (!answerText) {
      return res.status(502).json({ error: 'The tutor did not return an answer. Please try again.' });
    }
    const citedSourceNumbers = [...answerText.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1]));
    if (!citedSourceNumbers.length || citedSourceNumbers.some((sourceNumber) => sourceNumber < 1 || sourceNumber > validCitations.length)) {
      return res.status(502).json({ error: 'The tutor returned an answer with invalid source citations. Please try again.' });
    }

    res.json({
      answer: answerText,
      citations: validCitations,
      isOutsideMaterial: false,
      suggestedFollowUps: [
        'How does this connect to previous topics?',
        'Can you show a mathematical edge case?',
        'Quiz me on this concept',
      ],
      learnerAdaptationNote: `Adapted for ${learnerMasteryLevel} mastery.`,
    });
  } catch (err: any) {
    console.error('Chat API Error:', err);
    res.status(500).json({ error: err.message || 'Error processing chat request' });
  }
});

// Adaptive Quiz Generation Endpoint
app.post('/api/generate-quiz', async (req, res) => {
  try {
    const { topicIds, count, difficulty, pastQuestionIds, sourceUnits } = req.body;
    if (!ai) {
      return res.status(503).json({ error: 'GEMINI_API_KEY not configured on server' });
    }
    const parsedSourceUnits = Array.isArray(sourceUnits) ? sourceUnits : [];
    if (parsedSourceUnits.length === 0) {
      return res.status(400).json({ error: 'Upload study materials before generating a quiz.' });
    }
    const safeCount = Math.min(20, Math.max(1, Number(count) || 3));
    const unitById = new Map<string, any>(parsedSourceUnits.filter((unit: any) =>
      unit && typeof unit.id === 'string' && typeof unit.full_text_excerpt === 'string' && unit.full_text_excerpt.trim() &&
      typeof unit.title === 'string' && typeof unit.source_file === 'string' &&
      typeof unit.source_location === 'string' && typeof unit.source_type === 'string' && typeof unit.topic_id === 'string'
    ).map((unit: any) => [unit.id, unit]));
    if (unitById.size === 0) {
      return res.status(400).json({ error: 'No readable uploaded source units were supplied for quiz generation.' });
    }

    const systemInstruction = `Create exactly ${safeCount} multiple-choice questions using only the supplied source excerpts. Every correct answer and explanation must be directly supported by its cited excerpt. Do not use outside knowledge. Do not invent sources or citations. Return only a JSON array with objects matching:
[
  {
    "id": "unique-id",
    "type": "mcq",
    "question": "Question",
    "options": ["A", "B", "C", "D"],
    "correct_answer": "0",
    "worked_solution": "Explanation grounded in excerpt",
    "unit_id": "one of the supplied source unit IDs",
    "difficulty": "easy, medium, or hard"
  }
]`;

    const response = await generateWithTransientRetry(ai, (client) => client.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: JSON.stringify({
        topics: topicIds || [],
        requestedDifficulty: difficulty || 'medium',
        excludeQuestions: pastQuestionIds || [],
        sources: parsedSourceUnits.map((unit: any) => ({
          id: unit.id,
          topic: unit.topic_name,
          title: unit.title,
          source: unit.source_file,
          location: unit.source_location,
          excerpt: unit.full_text_excerpt,
        })),
      }),
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    }));

    const parsed = parseGeminiJson<any[]>(response.text, 'quiz');
    const questions = parsed.flatMap((item: any) => {
      const unit = unitById.get(item.unit_id);
      const answerIndex = Number(item.correct_answer);
      if (!unit || typeof item.question !== 'string' || !Array.isArray(item.options) ||
          item.options.length < 2 || !Number.isInteger(answerIndex) ||
          answerIndex < 0 || answerIndex >= item.options.length ||
          typeof item.worked_solution !== 'string') return [];
      return [{
        ...item,
        topic_id: unit.topic_id,
        topic_name: unit.topic_name,
        concept_tags: unit.concept_tags,
        difficulty: ['easy', 'medium', 'hard'].includes(item.difficulty) ? item.difficulty : difficulty || 'medium',
        source_location: unit.source_location,
        source_file: unit.source_file,
        source_type: unit.source_type,
        source_title: unit.title,
        source_excerpt: unit.full_text_excerpt,
        unit_id: unit.id,
      }];
    }).slice(0, safeCount);
    const uniqueQuestionIds = new Set(questions.map((question: any) => question.id));
    if (questions.length !== safeCount || uniqueQuestionIds.size !== questions.length) {
      return res.status(502).json({ error: 'The generated quiz was incomplete or included invalid source citations. Please retry.' });
    }
    res.json({ questions });
  } catch (err: any) {
    console.error('Quiz Generation Error:', err);
    if (isTransientGeminiError(err)) {
      return res.status(503).json({ error: 'Quiz generation is temporarily busy. Please try again in a moment.' });
    }
    res.status(500).json({ error: err.message || 'Error generating quiz' });
  }
});

// Answer Grading Endpoint
app.post('/api/grade-answer', async (req, res) => {
  try {
    if (!ai) {
      return res.status(503).json({ error: 'GEMINI_API_KEY not configured' });
    }

    const body = req.body;
    if (typeof body !== 'object' || body === null ||
        typeof body.question !== 'object' || body.question === null ||
        typeof body.question.question !== 'string' || !body.question.question.trim() ||
        typeof body.question.worked_solution !== 'string' || !body.question.worked_solution.trim() ||
        typeof body.userAnswer !== 'string' || !body.userAnswer.trim()) {
      return res.status(400).json({
        error: 'A question, worked solution, and non-empty student answer are required for grading.',
      });
    }
    const { question, userAnswer } = body;

    const prompt = `Question: "${question.question}"
Correct Answer / Worked Solution: "${question.worked_solution}"
Student Answer: "${userAnswer}"

Grade the student answer on a scale from 0.0 to 1.0 (with partial credit). Return JSON:
{
  "isCorrect": boolean,
  "partialScore": number,
  "feedback": "constructive 1-2 sentence explanation"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const result = JSON.parse(response.text || '{}');
    res.json(result);
  } catch (err: any) {
    console.error('Grading Error:', err);
    res.status(500).json({ error: err.message || 'Error grading answer' });
  }
});

// Setup Vite or Static File Serving
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`StudyPilot full-stack server running on http://localhost:${PORT}`);
  });
}

startServer();
