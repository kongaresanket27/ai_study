/**
 * Spaced Repetition & Forgetting Curve Engine for StudyPilot
 * 
 * Based on the Ebbinghaus forgetting curve and modern SM-2 / FSRS memory stability dynamics.
 * Models retrievability decay over time and computes optimal review intervals.
 * 
 * Formula:
 *   R(t) = exp(-t / S)
 *   where:
 *     t = elapsed time in days since last active retrieval
 *     S = memory stability (half-life factor, grows with successful reviews)
 *     R(t) = probability of successful recall (retrievability)
 */

import { TopicMasteryState } from '../types';

export const TARGET_RETRIEVABILITY = 0.85; // Target threshold before prompting review

/**
 * Computes current retrievability R(t) given elapsed time since last practice.
 */
export function calculateRetrievability(
  lastPracticedTimestamp: number,
  stabilityDays: number,
  currentTimestamp: number = Date.now()
): number {
  const elapsedMillis = Math.max(0, currentTimestamp - lastPracticedTimestamp);
  const elapsedDays = elapsedMillis / (1000 * 60 * 60 * 24);
  const safeStability = Math.max(0.5, stabilityDays);
  
  const retrievability = Math.exp(-elapsedDays / safeStability);
  return Number(Math.max(0.01, Math.min(1.0, retrievability)).toFixed(4));
}

/**
 * Computes the new memory stability after a review session.
 * If student succeeded, stability expands; if failed, stability contracts.
 */
export function updateStabilityAfterReview(
  currentStabilityDays: number,
  isCorrect: boolean,
  mastery: number
): number {
  if (isCorrect) {
    // Multiplier scales between 1.6x and 2.4x depending on mastery level
    const multiplier = 1.6 + 0.8 * mastery;
    const newStability = currentStabilityDays * multiplier;
    return Number(Math.min(90, Math.max(1.0, newStability)).toFixed(2));
  } else {
    // Lapse penalty: memory stability resets to foundational level
    const penalized = Math.max(1.0, currentStabilityDays * 0.4);
    return Number(penalized.toFixed(2));
  }
}

/**
 * Calculates timestamp when review will become due (retrievability drops below TARGET_RETRIEVABILITY).
 * R(t) = TARGET_RETRIEVABILITY => exp(-t / S) = 0.85 => -t / S = ln(0.85) => t = -S * ln(0.85)
 */
export function calculateReviewDueTimestamp(
  lastPracticedTimestamp: number,
  stabilityDays: number
): number {
  const daysUntilDue = -stabilityDays * Math.log(TARGET_RETRIEVABILITY);
  const millisUntilDue = daysUntilDue * 24 * 60 * 60 * 1000;
  return lastPracticedTimestamp + millisUntilDue;
}

export interface ReviewScheduleBlock {
  date: string; // YYYY-MM-DD
  dayLabel: string;
  topicId: string;
  topicTitle: string;
  reason: 'overdue_review' | 'weak_mastery' | 'exam_prep' | 'maintenance';
  urgency: 'high' | 'medium' | 'routine';
  estimatedMinutes: number;
}

/**
 * Generates an adaptive day-by-day study calendar leading up to the target exam date.
 */
export function generateStudySchedule(
  topicStates: TopicMasteryState[],
  topicsLookup: Record<string, { title: string; estimated_study_minutes: number }>,
  examDateStr: string,
  targetWeeklyHours: number = 8
): ReviewScheduleBlock[] {
  if (topicStates.length === 0) return [];

  const schedule: ReviewScheduleBlock[] = [];
  const now = new Date();
  const examDate = examDateStr ? new Date(examDateStr) : null;
  const hasUpcomingExam = examDate !== null &&
    !Number.isNaN(examDate.getTime()) &&
    examDate.getTime() > now.getTime();
  const daysUntilExam = hasUpcomingExam
    ? Math.ceil((examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : 7;
  const totalDays = Math.max(7, Math.min(30, daysUntilExam));
  
  // Sort topics: prioritize low mastery and overdue retrievability
  const sortedTopics = [...topicStates].sort((a, b) => {
    // Score based on (1 - mastery) * 0.6 + (1 - retrievability) * 0.4
    const scoreA = (1 - a.mastery) * 0.6 + (1 - a.retrievability) * 0.4;
    const scoreB = (1 - b.mastery) * 0.6 + (1 - b.retrievability) * 0.4;
    return scoreB - scoreA;
  });

  const safeWeeklyHours = Number.isFinite(targetWeeklyHours) && targetWeeklyHours > 0
    ? targetWeeklyHours
    : 8;
  const dailyMinutesTarget = Math.max(15, Math.round((safeWeeklyHours * 60) / 7));

  for (let day = 0; day < totalDays; day++) {
    const blockDate = new Date(now.getTime() + day * 24 * 60 * 60 * 1000);
    const dateStr = blockDate.toISOString().split('T')[0];
    const dayLabel = blockDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    // Pick top 1-2 topics for this day
    const topicIndex = day % sortedTopics.length;
    const currentTopicState = sortedTopics[topicIndex];
    const topicInfo = topicsLookup[currentTopicState.topic_id] || { title: 'Topic Review', estimated_study_minutes: 45 };

    let reason: ReviewScheduleBlock['reason'] = 'maintenance';
    let urgency: ReviewScheduleBlock['urgency'] = 'routine';

    if (currentTopicState.mastery < 0.45) {
      reason = 'weak_mastery';
      urgency = 'high';
    } else if (currentTopicState.retrievability < 0.70) {
      reason = 'overdue_review';
      urgency = 'high';
    } else if (hasUpcomingExam && day >= totalDays - 3) {
      reason = 'exam_prep';
      urgency = 'high';
    } else if (currentTopicState.retrievability < 0.85) {
      reason = 'overdue_review';
      urgency = 'medium';
    }

    schedule.push({
      date: dateStr,
      dayLabel,
      topicId: currentTopicState.topic_id,
      topicTitle: topicInfo.title,
      reason,
      urgency,
      estimatedMinutes: Math.min(dailyMinutesTarget, Math.max(15, topicInfo.estimated_study_minutes)),
    });
  }

  return schedule;
}
