/**
 * StudyPilot - Core Data Types & Interfaces
 * Fully typed schemas for Multimodal Ingestion, BKT Learner Model,
 * Adaptive Quizzes, and Source-Grounded Tutoring.
 */

export type SourceType = 'pdf' | 'slide' | 'text' | 'image' | 'video' | 'youtube';

export interface ContentUnit {
  id: string;
  title: string;
  summary: string;
  full_text_excerpt: string;
  topic_id: string;
  topic_name: string;
  subtopic: string;
  concept_tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  source_type: SourceType;
  source_file: string;
  source_location: string; // e.g. "Page 114", "Slide 14", "18:35"
  video_timestamp_seconds?: number;
  youtube_video_id?: string;
  is_figure?: boolean;
  figure_image_url?: string;
  figure_caption?: string;
  relevance_score?: number; // assigned during retrieval
}

export interface Topic {
  id: string;
  title: string;
  description: string;
  subtopics: string[];
  concepts: string[];
  estimated_study_minutes: number;
  prerequisite_ids: string[];
  unit_count: number;
}

export interface PrerequisiteEdge {
  fromTopicId: string;
  toTopicId: string;
  relationship: 'strictly_requires' | 'recommends' | 'builds_upon';
  concept: string;
}

export interface Course {
  id: string;
  title: string;
  code: string;
  institution: string;
  description: string;
  thumbnail_url?: string;
  topics: Topic[];
  content_units: ContentUnit[];
  prerequisites: PrerequisiteEdge[];
  exam_date: string;
  target_weekly_hours: number;
}

// BKT (Bayesian Knowledge Tracing) Parameters & State
export interface BKTParameters {
  p_init: number;  // Prior probability of knowing concept (default: 0.25)
  p_learn: number; // Probability of transitioning from unlearned to learned (default: 0.18)
  p_guess: number; // Probability of guessing correctly while unlearned (default: 0.20)
  p_slip: number;  // Probability of slipping/incorrect answer while learned (default: 0.10)
}

export interface TopicMasteryState {
  topic_id: string;
  mastery: number; // 0.0 to 1.0 (displayed as 0% to 100%)
  confidence_interval: number;
  attempts_count: number;
  correct_count: number;
  last_practiced_timestamp: number;
  stability_days: number; // Ebbinghaus memory stability
  retrievability: number; // current forgetting curve retrievability (0 to 1)
  review_due_timestamp: number;
  status: 'critical' | 'needs_review' | 'progressing' | 'mastered';
}

export interface LearnerProfile {
  student_name: string;
  avatar_url: string;
  current_streak_days: number;
  last_active_date: string;
  weekly_goal_hours: number;
  completed_hours_this_week: number;
  total_quizzes_taken: number;
  total_questions_answered: number;
  diagnostic_completed: boolean;
  onboarding_answers?: {
    goal: string;
    target_score: string;
    weekly_hours: number;
    confidence_ratings: Record<string, number>;
  };
}

export interface MasteryHistoryPoint {
  date: string;
  overall_mastery: number;
  [topicId: string]: string | number; // dynamic per topic
}

// Quiz & Assessment Types
export type QuestionType = 'mcq' | 'short_answer' | 'numerical';

export interface QuestionMisconception {
  option_index: number;
  misconception_label: string;
  explanation: string;
  cited_source_location: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[];
  correct_answer: string;
  worked_solution: string;
  topic_id: string;
  topic_name: string;
  concept_tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  source_location: string;
  source_file: string;
  source_type: SourceType;
  source_title: string;
  source_excerpt: string;
  unit_id: string;
  verification_notes?: string;
  misconceptions?: QuestionMisconception[];
}

export interface QuizSubmission {
  id: string;
  quiz_title: string;
  timestamp: number;
  time_spent_seconds: number;
  score_percentage: number;
  total_questions: number;
  correct_questions: number;
  topic_ids: string[];
  answers: {
    question_id: string;
    user_answer: string;
    is_correct: boolean;
    partial_score?: number;
    feedback: string;
    identified_misconception?: string;
  }[];
  topic_accuracies: Record<string, { correct: number; total: number; percentage: number }>;
  mastery_deltas: Record<string, { before: number; after: number }>;
  weak_topics: string[];
  key_misconceptions: string[];
}

// Tutor Chat Types
export type TutorMode = 'explain' | 'eli5' | 'step_by_step' | 'socratic' | 'quiz_me';

export interface Citation {
  id: number;
  unit_id: string;
  source_title: string;
  source_file: string;
  source_location: string;
  source_type: SourceType;
  excerpt: string;
  figure_image_url?: string;
  video_timestamp_seconds?: number;
  youtube_video_id?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  mode?: TutorMode;
  citations?: Citation[];
  is_outside_material?: boolean;
  outside_knowledge_content?: string;
  suggested_follow_ups?: string[];
  learner_adaptation_note?: string;
  audio_url?: string;
}
