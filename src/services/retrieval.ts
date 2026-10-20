/**
 * StudyPilot - Source Grounding & Retrieval Service
 * 
 * Retrieves the most relevant course content units for a query,
 * builds structured context packages with strict citation indices [1], [2],
 * and detects out-of-domain queries to enforce source-grounded refusal.
 */

import { ContentUnit, Citation } from '../types';

export interface RetrievalResult {
  relevantUnits: ContentUnit[];
  citations: Citation[];
  topRelevanceScore: number;
  isOutsideCourseMaterial: boolean;
  retrievalSummary: string;
}

// Normalized tokenization
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2);
}

/**
 * Ranks content units based on BM25-style keyword matching and concept tag overlap.
 */
export function retrieveContextUnits(
  query: string,
  units: ContentUnit[],
  maxUnits: number = 4
): RetrievalResult {
  const queryTokens = tokenize(query);
  
  if (queryTokens.length === 0 || units.length === 0) {
    return {
      relevantUnits: [],
      citations: [],
      topRelevanceScore: 0,
      isOutsideCourseMaterial: true,
      retrievalSummary: 'Empty query or knowledge base.',
    };
  }

  // Score each unit
  const scoredUnits = units.map(unit => {
    let score = 0;
    const titleTokens = tokenize(unit.title);
    const summaryTokens = tokenize(unit.summary);
    const bodyTokens = tokenize(unit.full_text_excerpt);
    const conceptTokens = unit.concept_tags.flatMap(t => tokenize(t));
    const subtopicTokens = tokenize(unit.subtopic);

    for (const token of queryTokens) {
      // Exact concept tag matches receive highest weight
      if (conceptTokens.includes(token)) score += 6.0;
      // Title matches
      if (titleTokens.includes(token)) score += 4.5;
      // Subtopic matches
      if (subtopicTokens.includes(token)) score += 3.0;
      // Summary matches
      if (summaryTokens.includes(token)) score += 2.0;
      // Excerpt matches
      if (bodyTokens.includes(token)) score += 1.0;
    }

    // Normalized by length to prevent bias towards long texts
    const effectiveScore = score / Math.log2(bodyTokens.length + 8);

    return {
      unit: { ...unit, relevance_score: Number(effectiveScore.toFixed(3)) },
      score: effectiveScore,
    };
  });

  // Sort descending
  scoredUnits.sort((a, b) => b.score - a.score);

  const topScored = scoredUnits.slice(0, maxUnits).filter(s => s.score > 0.4);
  const topRelevanceScore = topScored.length > 0 ? topScored[0].score : 0;

  // Strict out-of-domain threshold: if even the top unit score is below 0.75,
  // the query is likely asking about something not covered in the course syllabus!
  const isOutsideCourseMaterial = topRelevanceScore < 0.75 || topScored.length === 0;

  const relevantUnits = topScored.map(s => s.unit);

  // Generate numbered citations
  const citations: Citation[] = relevantUnits.map((u, idx) => ({
    id: idx + 1,
    unit_id: u.id,
    source_title: u.title,
    source_file: u.source_file,
    source_location: u.source_location,
    source_type: u.source_type,
    excerpt: u.full_text_excerpt,
    figure_image_url: u.figure_image_url,
    video_timestamp_seconds: u.video_timestamp_seconds,
    youtube_video_id: u.youtube_video_id,
  }));

  const retrievalSummary = isOutsideCourseMaterial
    ? 'No matching course units found with sufficient confidence.'
    : `Retrieved ${relevantUnits.length} source-cited units (Top score: ${topRelevanceScore.toFixed(2)})`;

  return {
    relevantUnits,
    citations,
    topRelevanceScore,
    isOutsideCourseMaterial,
    retrievalSummary,
  };
}

/**
 * Builds grounded system prompt instructing Gemini to strictly cite sources.
 */
export function buildGroundedSystemPrompt(
  citations: Citation[],
  mode: string = 'explain',
  learnerMasteryLevel: string = 'Intermediate'
): string {
  const sourcesFormatted = citations
    .map(c => `[Source ${c.id}] (File: ${c.source_file}, Location: ${c.source_location})\nTitle: ${c.source_title}\nExcerpt:\n"${c.excerpt}"`)
    .join('\n\n');

  let modeInstruction = '';
  switch (mode) {
    case 'eli5':
      modeInstruction = 'Explain in simple, intuitive terms suitable for a beginner without heavy jargon, but stay rigorously grounded.';
      break;
    case 'step_by_step':
      modeInstruction = 'Break down the explanation into clear numbered steps with logical progression.';
      break;
    case 'socratic':
      modeInstruction = 'Act as a Socratic tutor: do not give the entire answer away at once. Ask guiding questions based on the sources to help the student derive the concept.';
      break;
    case 'quiz_me':
      modeInstruction = 'Give a brief 2-sentence summary from the source, followed by 1 quick check question to test the student on this specific excerpt.';
      break;
    default:
      modeInstruction = 'Provide a comprehensive, clear academic explanation with mathematical and conceptual rigor.';
  }

  return `You are StudyPilot, an expert academic tutor.
Your core operating principle is SOURCE GROUNDING:
1. Base your answer EXCLUSIVELY on the provided course excerpts below.
2. Whenever you state a fact, principle, or formula, IMMEDIATELY append an inline bracket citation chip like [1] or [2] referring to the source number.
3. Do not invent facts or extrapolate beyond what is supported.
4. Adapt your tone to the student's mastery level: "${learnerMasteryLevel}".
5. Tutor Mode: ${modeInstruction}

COURSE EXCERPTS:
${sourcesFormatted}`;
}
