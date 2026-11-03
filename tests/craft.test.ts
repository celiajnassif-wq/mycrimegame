import { describe, it, expect } from 'vitest';
import { classifyQuestion, computeState, doneEvent, reconcileFlags, PRESSURE_LIMIT } from '../shared/interrogation';
import { loadCase } from '../server/caseStore';
import type { ChatTurn } from '../shared/types';

const { s } = loadCase('karalis')!;
const aris = s.suspects.aris, laila = s.suspects.laila;
const p = (text: string, shownDocumentId?: string): ChatTurn[] => [{ role: 'player', text, shownDocumentId }, { role: 'suspect', text: '...' }];

describe('question technique', () => {
  it('classifies like an interview trainer', () => {
    expect(classifyQuestion('Tell me about that evening.')).toBe('open');
    expect(classifyQuestion('Walk me through what happened after six.')).toBe('open');
    expect(classifyQuestion('What time did you leave?')).toBe('closed');
    expect(classifyQuestion("You were at the office, weren't you?")).toBe('leading');
    expect(classifyQuestion('Admit it, you killed him!')).toBe('coercive');
    expect(classifyQuestion('Stop lying or you will hang.')).toBe('coercive');
  });
});

describe('strategic use of evidence', () => {
  it('a lie told on record and then contradicted is locked in', () => {
    const st = computeState(aris, p('Where were you on the evening of 10 January?'), 'Explain this.', 'club-register', true);
    expect(st.newlyCaught).toEqual(['aris-club']);
    expect(st.quality['aris-club']).toBe('locked');
  });
  it('evidence shown before the witness commits only catches an adapted lie', () => {
    const st = computeState(aris, [], 'Explain this.', 'club-register', true);
    expect(st.quality['aris-club']).toBe('adapted');
  });
  it('both kinds still count toward the culprit breaking', () => {
    const h = [...p('x', 'club-register'), ...p('y', 'charcoal-daybook'), ...p('z', 'pharmacy-register')];
    expect(computeState(aris, h, 'w', 'tox-2024', true).canConfess).toBe(true);
  });
});

describe('pressure', () => {
  const threat = 'Admit it, you killed him or you will hang.';
  it('an innocent witness pushed past the limit gives an unreliable admission, never a confession', () => {
    const h = Array.from({ length: PRESSURE_LIMIT - 1 }, () => p(threat)).flat();
    const st = computeState(laila, h, threat, undefined, false);
    expect(st.coerced).toBe(true);
    const done = doneEvent(laila, st, reconcileFlags({ confessed: true }, st, 'x'));
    expect(done.unreliable).toBe(true);
    expect(done.confessed).toBe(false);
  });
  it('the culprit is never "coerced" into a confession', () => {
    const h = Array.from({ length: 5 }, () => p(threat)).flat();
    const st = computeState(aris, h, threat, undefined, true);
    expect(st.coerced).toBe(false);
    expect(st.canConfess).toBe(false);
    expect(st.pressure).toBe(6);
  });
});
