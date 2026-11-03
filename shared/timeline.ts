import type { TimelineFact } from './types';

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** End of a fact in minutes. Moments get a 1 minute width so they can overlap ranges. */
export function factRange(f: TimelineFact): [number, number] {
  const s = toMinutes(f.start);
  const e = f.end ? toMinutes(f.end) : s + 1;
  return [s, Math.max(e, s + 1)];
}

function overlaps(a: TimelineFact, b: TimelineFact): boolean {
  const [as, ae] = factRange(a);
  const [bs, be] = factRange(b);
  return as < be && bs < ae;
}

export interface Collision { statement: TimelineFact; record: TimelineFact; reason: string }

const RECORDISH = new Set(['record', 'absence', 'moment']);

/** Find pinned statements that collide with pinned records. */
export function findCollisions(facts: TimelineFact[]): Collision[] {
  const out: Collision[] = [];
  const statements = facts.filter((f) => f.kind === 'statement');
  const records = facts.filter((f) => RECORDISH.has(f.kind));
  for (const s of statements) {
    for (const r of records) {
      const explicit = s.conflictsWith?.includes(r.id) || r.conflictsWith?.includes(s.id);
      if (explicit) {
        out.push({ statement: s, record: r, reason: 'The record puts the visit at a different time.' });
        continue;
      }
      if (s.lane !== r.lane || !s.place || !r.place) continue;
      if (s.place !== r.place && overlaps(s, r)) {
        out.push({ statement: s, record: r, reason: `Claimed: ${s.place}. Recorded: ${r.place}, ${r.start}${r.end ? ' to ' + r.end : ''}.` });
      }
    }
  }
  return out;
}
