import { describe, it, expect } from 'vitest';
import { computeState, isPointed, reconcileFlags, StateStripper, compressHistory, STATE_MARKER } from '../shared/interrogation';
import { loadCase } from '../server/caseStore';
import type { ChatTurn } from '../shared/types';

const { s } = loadCase('karalis')!;
const aris = s.suspects.aris;
const ferrante = s.suspects.ferrante;

describe('lie detection', () => {
  it('a shown document from caughtBy breaks the lie', () => {
    const st = computeState(aris, [], 'Look at this.', 'club-register');
    expect(st.newlyCaught).toEqual(['aris-club']);
  });
  it('an irrelevant document does not', () => {
    expect(computeState(aris, [], 'Look at this.', 'review-brief').newlyCaught).toEqual([]);
  });
  it('a pointed question breaks a lie without a document', () => {
    expect(isPointed('The watchman saw you arrive at 6.10 and leave angry at 6.40. Why lie about the visit time?', ferrante.lies[0])).toBe(true);
    expect(isPointed('What time did you visit?', ferrante.lies[0])).toBe(false);
  });
  it('replays history so earlier catches persist and are not repeated', () => {
    const history: ChatTurn[] = [{ role: 'player', text: 'x', shownDocumentId: 'club-register' }, { role: 'suspect', text: 'y' }];
    const st = computeState(aris, history, 'again', 'club-register');
    expect(st.caught).toEqual(['aris-club']);
    expect(st.newlyCaught).toEqual([]);
  });
  it('the culprit cannot confess before the breakdown conditions', () => {
    const history: ChatTurn[] = [
      { role: 'player', text: 'a', shownDocumentId: 'club-register' }, { role: 'suspect', text: '.' },
      { role: 'player', text: 'b', shownDocumentId: 'charcoal-daybook' }, { role: 'suspect', text: '.' },
    ];
    expect(computeState(aris, history, 'c', 'pharmacy-register').canConfess).toBe(false); // 3 lies, no key doc
    expect(computeState(aris, history, 'c', 'tox-2024').canConfess).toBe(false); // key doc, only 2 lies
    const more = [...history, { role: 'player' as const, text: 'c', shownDocumentId: 'pharmacy-register' }, { role: 'suspect' as const, text: '.' }];
    expect(computeState(aris, more, 'd', 'tox-2024').canConfess).toBe(true);
  });
  it('innocent suspects can never confess', () => {
    const st = computeState(ferrante, [], 'x', 'watchman-notebook');
    expect(reconcileFlags({ confessed: true, caughtLieIds: ['aris-club'] }, st, 'calm')).toEqual({ caughtLieIds: ['ferrante-time'], mood: 'calm', confessed: false });
  });
  it('model claims are overridden by the server state', () => {
    const st = computeState(aris, [], 'hello');
    const r = reconcileFlags({ caughtLieIds: ['aris-club', 'aris-car'], confessed: true, mood: 'furious' }, st, 'calm');
    expect(r).toEqual({ caughtLieIds: [], mood: 'furious', confessed: false });
  });
});

describe('state stripper', () => {
  it('never leaks the state block, even split across chunks', () => {
    const full = `I was at the club, my friend.\n${STATE_MARKER}\n{"caughtLieIds":[],"mood":"smug","confessed":false}`;
    for (const size of [1, 3, 7, 50]) {
      const st = new StateStripper();
      let out = '';
      for (let i = 0; i < full.length; i += size) out += st.push(full.slice(i, i + size));
      out += st.flush();
      expect(out.trim()).toBe('I was at the club, my friend.');
      expect(st.parse()).toEqual({ caughtLieIds: [], mood: 'smug', confessed: false });
    }
  });
  it('strips a bare JSON tail when the marker is missing', () => {
    const st = new StateStripper();
    let out = st.push('No.\n{"caughtLieIds": [], "mood": "cold", "confessed": false}');
    out += st.flush();
    expect(out.trim()).toBe('No.');
  });
});

describe('history compression', () => {
  it('keeps recent turns and summarises old ones', () => {
    const h: ChatTurn[] = Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? 'suspect' : 'player', text: `turn ${i}. more text` }));
    const { summary, recent } = compressHistory(h);
    expect(recent.length).toBeLessThanOrEqual(16);
    expect(recent[0].role).toBe('player');
    expect(summary).toContain('turn 0');
  });
});
