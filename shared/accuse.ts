// Judges a charge against the secret truth. Used by the server and by the static prototype build.
import type { AccuseRequest, AccuseResponse, CaseData, SecretData } from './types';
import { score } from './scoring';

export function judgeAccusation(kase: CaseData, s: SecretData, b: AccuseRequest): AccuseResponse | { error: string } {
  if (!kase.suspects.some((x) => x.id === b.who)) return { error: 'unknown suspect' };
  const proof = Array.isArray(b.proof) ? [...new Set(b.proof.filter((p) => typeof p === 'string'))] : [];
  if (proof.length !== kase.accusation.proofCount) return { error: `pick exactly ${kase.accusation.proofCount} documents` };
  if (b.who !== s.culprit) {
    const e = s.eliminations[b.who];
    return { outcome: 'refused', text: e.refusal, clearedBy: e.documents };
  }
  const correctProof = proof.filter((p) => s.proofDocuments.includes(p));
  return {
    outcome: 'solved',
    score: score({
      culpritCorrect: true, howCorrect: b.how === s.answers.how, whyCorrect: b.why === s.answers.why,
      proofCorrect: correctProof.length, hintsUsed: Number(b.hintsUsed) || 0, wrongCharges: Number(b.wrongCharges) || 0,
    }),
    correct: { how: b.how === s.answers.how, why: b.why === s.answers.why, proof: correctProof },
    epilogue: s.epilogue,
    memo: s.solutionMemo,
  };
}
