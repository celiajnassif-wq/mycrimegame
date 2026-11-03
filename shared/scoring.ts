import type { ScoreBreakdown } from './types';

export const POINTS = { culprit: 40, how: 15, why: 15, proofEach: 10, hint: 2, hintMax: 10, wrong: 5, wrongMax: 15 };

export function rankFor(total: number): string {
  if (total >= 90) return 'Chief Inspector';
  if (total >= 75) return 'Inspector';
  if (total >= 55) return 'Sergeant';
  return 'Cadet';
}

export function score(input: {
  culpritCorrect: boolean; howCorrect: boolean; whyCorrect: boolean;
  proofCorrect: number; hintsUsed: number; wrongCharges: number;
}): ScoreBreakdown {
  const culprit = input.culpritCorrect ? POINTS.culprit : 0;
  const how = input.howCorrect ? POINTS.how : 0;
  const why = input.whyCorrect ? POINTS.why : 0;
  const proof = Math.min(3, Math.max(0, input.proofCorrect)) * POINTS.proofEach;
  const hintPenalty = Math.min(POINTS.hintMax, Math.max(0, input.hintsUsed) * POINTS.hint);
  const wrongPenalty = Math.min(POINTS.wrongMax, Math.max(0, input.wrongCharges) * POINTS.wrong);
  const total = Math.max(0, culprit + how + why + proof - hintPenalty - wrongPenalty);
  return { culprit, how, why, proof, hintPenalty, wrongPenalty, total, rank: rankFor(total) };
}
