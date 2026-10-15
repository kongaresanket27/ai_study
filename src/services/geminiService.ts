import { Citation, Question, QuizSubmission, ContentUnit } from '../types';

export interface ChatResponsePayload {
  answer: string;
  citations: Citation[];
  isOutsideMaterial: boolean;
  outsideKnowledgeContent?: string;
  suggestedFollowUps: string[];
  learnerAdaptationNote: string;
}

async function readApiError(response: Response): Promise<string> {
  const payload: unknown = await response.json().catch(() => ({}));
  const messageFrom = (value: unknown): string | undefined => {
    if (typeof value === 'string') {
      try {
        return messageFrom(JSON.parse(value));
      } catch {
        return value;
      }
    }
    if (typeof value !== 'object' || value === null) return undefined;
    const record = value as Record<string, unknown>;
    return messageFrom(record.error) ?? messageFrom(record.message);
  };
  return messageFrom(payload) ?? `Request failed (${response.status}).`;
}

export async function askGroundedTutor(
  question: string,
  citations: Citation[],
  mode: string,
  learnerMasteryLevel: string,
  isOutsideCourseMaterial: boolean
): Promise<ChatResponsePayload> {
  if (isOutsideCourseMaterial || citations.length === 0) {
    return {
      answer: 'I could not find this in your uploaded study materials. Upload a relevant source and ask again.',
      citations: [],
      isOutsideMaterial: true,
      suggestedFollowUps: [],
      learnerAdaptationNote: '',
    };
  }

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: question, citations, mode, learnerMasteryLevel }),
  });
  if (!response.ok) throw new Error(await readApiError(response));
  const payload = await response.json();
  if (!payload || typeof payload.answer !== 'string' || !Array.isArray(payload.citations)) {
    throw new Error('The tutor returned an invalid response. Please try again.');
  }
  return payload;
}

export async function generateAdaptiveQuestions(
  topicIds: string[],
  count: number,
  difficulty: 'easy' | 'medium' | 'hard' | 'adaptive',
  pastQuestionIds: Set<string>,
  sourceUnits: ContentUnit[] = []
): Promise<Question[]> {
  const relevantSourceUnits = sourceUnits.filter((unit) => !topicIds.length || topicIds.includes(unit.topic_id));
  if (!relevantSourceUnits.length) {
    throw new Error('Upload study materials for the selected topics before generating a quiz.');
  }

  const response = await fetch('/api/generate-quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topicIds,
      count,
      difficulty,
      pastQuestionIds: Array.from(pastQuestionIds),
      sourceUnits: relevantSourceUnits,
    }),
  });
  if (!response.ok) throw new Error(await readApiError(response));
  const data = await response.json();
  if (!Array.isArray(data.questions) || data.questions.length !== count) {
    throw new Error('The quiz response was incomplete or invalid. Please retry.');
  }
  const sourceById = new Map(relevantSourceUnits.map((unit) => [unit.id, unit]));
  const questions = data.questions as Question[];
  const invalidQuestion = questions.find((question) => {
    const source = sourceById.get(question.unit_id);
    return !source || question.source_file !== source.source_file ||
      question.source_location !== source.source_location || question.source_type !== source.source_type ||
      question.source_title !== source.title || question.source_excerpt !== source.full_text_excerpt;
  });
  if (invalidQuestion) {
    throw new Error('The quiz response contained a question without a valid uploaded-source citation. Please retry.');
  }
  return questions;
}

export async function gradeOpenEndedAnswer(
  question: Question,
  userAnswer: string
): Promise<{ isCorrect: boolean; partialScore: number; feedback: string }> {
  const response = await fetch('/api/grade-answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, userAnswer }),
  });
  if (!response.ok) throw new Error(await readApiError(response));
  return response.json();
}

export type { QuizSubmission };
