/**
 * Bayesian Knowledge Tracing (BKT) Engine for StudyPilot
 * 
 * Implements the standard Corbett & Anderson (1995) 4-parameter BKT model
 * to maintain per-topic and per-concept probabilistic mastery estimates.
 * 
 * Formal Parameters:
 *  - P(L0): Prior probability student already knows the topic before instruction.
 *  - P(T) : Probability of transitioning from unlearned to learned state per opportunity.
 *  - P(G) : Probability of a correct response despite NOT knowing the skill (Guess).
 *  - P(S) : Probability of an incorrect response despite knowing the skill (Slip).
 */

import { BKTParameters, TopicMasteryState } from '../types';

export const DEFAULT_BKT_PARAMS: BKTParameters = {
  p_init: 0.25,  // P(L0)
  p_learn: 0.18, // P(T)
  p_guess: 0.20, // P(G)
  p_slip: 0.10,  // P(S)
};

/**
 * Calculates updated mastery P(L_t+1) given an observation (correct/incorrect answer).
 * 
 * Step 1: Posterior probability calculation P(L_t | Obs) using Bayes' theorem:
 *  If Correct:
 *    P(L_t | Correct) = [P(L_t) * (1 - P(S))] / [P(L_t) * (1 - P(S)) + (1 - P(L_t)) * P(G)]
 *  If Incorrect:
 *    P(L_t | Incorrect) = [P(L_t) * P(S)] / [P(L_t) * P(S) + (1 - P(L_t)) * (1 - P(G))]
 * 
 * Step 2: Learning update:
 *    P(L_{t+1}) = P(L_t | Obs) + (1 - P(L_t | Obs)) * P(T)
 */
export function updateBKT(
  currentMastery: number,
  isCorrect: boolean,
  params: BKTParameters = DEFAULT_BKT_PARAMS
): { newMastery: number; delta: number; posterior: number } {
  const pL = Math.min(0.99, Math.max(0.01, currentMastery));
  const { p_learn, p_guess, p_slip } = params;

  let posterior: number;

  if (isCorrect) {
    const pObsGivenKnow = 1 - p_slip;
    const pObsGivenNotKnow = p_guess;
    const numerator = pL * pObsGivenKnow;
    const denominator = numerator + (1 - pL) * pObsGivenNotKnow;
    posterior = numerator / denominator;
  } else {
    const pObsGivenKnow = p_slip;
    const pObsGivenNotKnow = 1 - p_guess;
    const numerator = pL * pObsGivenKnow;
    const denominator = numerator + (1 - pL) * pObsGivenNotKnow;
    posterior = numerator / denominator;
  }

  // Next step transition incorporating learning rate P(T)
  const newMastery = posterior + (1 - posterior) * p_learn;
  const clampedMastery = Math.min(0.98, Math.max(0.05, newMastery));
  const delta = clampedMastery - currentMastery;

  return {
    newMastery: Number(clampedMastery.toFixed(4)),
    delta: Number(delta.toFixed(4)),
    posterior: Number(posterior.toFixed(4)),
  };
}

/**
 * Update mastery lightly based on conversational signals:
 * - Asking for ELI5 or beginner help nudges mastery slightly downward (-0.03)
 * - Engaging with advanced Socratic reasoning nudges mastery upward (+0.02)
 */
export function applyConversationalNudge(
  currentMastery: number,
  signal: 'asked_basic_help' | 'struggled_prerequisite' | 'deep_understanding' | 'solved_socratic_step'
): number {
  let delta = 0;
  switch (signal) {
    case 'asked_basic_help':
      delta = -0.025;
      break;
    case 'struggled_prerequisite':
      delta = -0.04;
      break;
    case 'deep_understanding':
      delta = +0.035;
      break;
    case 'solved_socratic_step':
      delta = +0.02;
      break;
  }
  const updated = Math.min(0.98, Math.max(0.05, currentMastery + delta));
  return Number(updated.toFixed(4));
}

/**
 * Determines the category status based on numerical mastery (0.0 to 1.0)
 */
export function getMasteryStatus(mastery: number): 'critical' | 'needs_review' | 'progressing' | 'mastered' {
  if (mastery < 0.40) return 'critical';
  if (mastery < 0.70) return 'needs_review';
  if (mastery < 0.85) return 'progressing';
  return 'mastered';
}

/**
 * Calculates student confidence interval based on attempt count.
 */
export function calculateConfidenceInterval(attemptsCount: number): number {
  // As attempts grow, variance collapses
  return Number(Math.max(0.04, 0.4 / Math.sqrt(Math.max(1, attemptsCount))).toFixed(3));
}

/**
 * Initializes a new topic mastery state for a student
 */
export function initializeTopicMastery(
  topicId: string,
  initialPrior: number = DEFAULT_BKT_PARAMS.p_init
): TopicMasteryState {
  const now = Date.now();
  return {
    topic_id: topicId,
    mastery: initialPrior,
    confidence_interval: 0.35,
    attempts_count: 0,
    correct_count: 0,
    last_practiced_timestamp: now,
    stability_days: 1.5,
    retrievability: 1.0,
    review_due_timestamp: now + 1.5 * 24 * 3600 * 1000,
    status: getMasteryStatus(initialPrior),
  };
}
