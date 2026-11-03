import { describe, it, expect } from 'vitest';
import { findCollisions } from '../shared/timeline';
import type { TimelineFact } from '../shared/types';
import kase from '../cases/karalis/case.json';

const f = (p: Partial<TimelineFact> & { id: string }): TimelineFact => ({ lane: 'a', kind: 'record', start: '20:00', label: p.id, source: 'x', ...p });

describe('timeline collisions', () => {
  it('flags a statement overlapping a record at another place', () => {
    const c = findCollisions([f({ id: 's', kind: 'statement', start: '19:00', end: '23:00', place: 'Club' }), f({ id: 'r', start: '20:05', end: '20:55', place: 'Office' })]);
    expect(c).toHaveLength(1);
  });
  it('ignores same place, other lanes and non-overlap', () => {
    expect(findCollisions([f({ id: 's', kind: 'statement', start: '19:00', end: '23:00', place: 'Club' }), f({ id: 'r', start: '20:00', end: '21:00', place: 'Club' })])).toHaveLength(0);
    expect(findCollisions([f({ id: 's', kind: 'statement', start: '19:00', end: '23:00', place: 'Club' }), f({ id: 'r', lane: 'b', start: '20:00', end: '21:00', place: 'Office' })])).toHaveLength(0);
    expect(findCollisions([f({ id: 's', kind: 'statement', start: '17:00', end: '17:30', place: 'Home' }), f({ id: 'r', start: '18:00', end: '19:00', place: 'Office' })])).toHaveLength(0);
  });
  it('honours explicit conflictsWith', () => {
    expect(findCollisions([f({ id: 's', kind: 'statement', start: '17:00', end: '17:30', place: 'Office', conflictsWith: ['r'] }), f({ id: 'r', start: '18:10', end: '18:40', place: 'Office' })])).toHaveLength(1);
  });
  it('Karalis: every suspect statement collides with some record when all facts are pinned', () => {
    const all = kase.timeline.facts as TimelineFact[];
    const col = findCollisions(all);
    for (const id of ['a-claim-club', 'f-claim-visit', 'l-claim-home']) expect(col.some((c) => c.statement.id === id)).toBe(true);
  });
});
