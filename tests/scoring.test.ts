import { describe, it, expect } from 'vitest';
import { score, rankFor } from '../shared/scoring';

describe('scoring', () => {
  it('perfect run is 100 and Chief Inspector', () => {
    const s = score({ culpritCorrect: true, howCorrect: true, whyCorrect: true, proofCorrect: 3, hintsUsed: 0, wrongCharges: 0 });
    expect(s.total).toBe(100);
    expect(s.rank).toBe('Chief Inspector');
  });
  it('caps hint and wrong-charge penalties', () => {
    const s = score({ culpritCorrect: true, howCorrect: true, whyCorrect: true, proofCorrect: 3, hintsUsed: 20, wrongCharges: 9 });
    expect(s.hintPenalty).toBe(10);
    expect(s.wrongPenalty).toBe(15);
    expect(s.total).toBe(75);
    expect(s.rank).toBe('Inspector');
  });
  it('ranks by thresholds', () => {
    expect(rankFor(90)).toBe('Chief Inspector');
    expect(rankFor(89)).toBe('Inspector');
    expect(rankFor(75)).toBe('Inspector');
    expect(rankFor(55)).toBe('Sergeant');
    expect(rankFor(54)).toBe('Cadet');
  });
  it('never goes below zero and clamps proof at 3', () => {
    expect(score({ culpritCorrect: false, howCorrect: false, whyCorrect: false, proofCorrect: 0, hintsUsed: 5, wrongCharges: 3 }).total).toBe(0);
    expect(score({ culpritCorrect: true, howCorrect: false, whyCorrect: false, proofCorrect: 7, hintsUsed: 0, wrongCharges: 0 }).proof).toBe(30);
  });
});
