// Deterministic interrogation rules. The model never decides game state; these functions do.
import type { CatchQuality, ChatTurn, Lie, SecretSuspect, Technique } from './types';

export const STATE_MARKER = '###STATE###';
export const MAX_MESSAGE_CHARS = 800;
export const MAX_HISTORY_TURNS = 200;
export const KEEP_RECENT_TURNS = 16;

function norm(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

/** A pointed question matches when every keyword group has at least one word present. */
export function isPointed(message: string, lie: Lie): boolean {
  if (!lie.pointed.length) return false;
  const m = norm(message);
  return lie.pointed.every((group) => group.some((w) => m.includes(norm(w))));
}

export function lieCaughtBy(lie: Lie, message: string, shownDocumentId?: string): boolean {
  if (shownDocumentId && lie.caughtBy.includes(shownDocumentId)) return true;
  return isPointed(message, lie);
}

export interface InterviewState {
  caught: string[];          // all lies caught, in order
  newlyCaught: string[];     // caught on the current turn
  quality: Record<string, CatchQuality>; // how each caught lie was broken
  shownDocs: string[];       // all documents ever shown, including this turn
  canConfess: boolean;
  confessedBefore: boolean;
  technique: Technique;      // this turn's question style
  pressure: number;          // coercive questions so far, including this turn
  coerced: boolean;          // an innocent pushed past breaking point this turn (unreliable admission)
}

export const PRESSURE_LIMIT = 3;

const COERCIVE = /\b(admit it|admit that|confess|you(?:'re| are) lying|liar|stop lying|you did it|you killed|murderer|hang(?:ed)?|gallows|prison|jail|rot in|we know you|i know you did|last chance|or else|tell the truth or)\b/i;
const LEADING = /^(isn'?t it|wasn'?t it|didn'?t you|weren'?t you|you were|you did|surely|so you)\b|\b(isn'?t it|didn'?t you|weren'?t you|wasn'?t it|right)\s*\?\s*$/i;
const OPEN = /^(tell me|describe|explain|walk me|talk me|take me|what happened|how did|how was|what did you see|what do you remember|in your own words|why did|what was)/i;

/** Classify a question the way interview trainers do (PEACE / cognitive interview vocabulary). */
export function classifyQuestion(message: string): Technique {
  const m = message.trim();
  if (COERCIVE.test(m)) return 'coercive';
  if (LEADING.test(m)) return 'leading';
  if (OPEN.test(m)) return 'open';
  return 'closed';
}

function norm2(s: string) { return s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, ''); }

/** Did this message touch the lie's topic? Asking about it makes the suspect commit to the lie. */
export function touchesTopic(message: string, lie: Lie): boolean {
  const words = lie.topic?.length ? lie.topic : lie.pointed[0] ?? [];
  const m = norm2(message);
  return words.some((w) => m.includes(norm2(w)));
}

/** Replay the whole player history plus the new turn against the secret rules. */
export function computeState(
  suspect: SecretSuspect,
  history: ChatTurn[],
  playerMessage: string,
  shownDocumentId?: string,
  isCulprit = Boolean(suspect.breakdown),
): InterviewState {
  const caught: string[] = [];
  const quality: Record<string, CatchQuality> = {};
  const committed = new Set<string>();
  const shown = new Set<string>();
  let confessedBefore = false;
  let pressure = 0;
  const apply = (msg: string, doc?: string) => {
    if (doc) shown.add(doc);
    if (classifyQuestion(msg) === 'coercive') pressure++;
    const fresh: string[] = [];
    for (const lie of suspect.lies) {
      if (caught.includes(lie.id)) continue;
      if (lieCaughtBy(lie, msg, doc)) {
        caught.push(lie.id);
        fresh.push(lie.id);
        quality[lie.id] = committed.has(lie.id) ? 'locked' : 'adapted';
      } else if (touchesTopic(msg, lie)) {
        committed.add(lie.id); // they told the lie on record; evidence shown later locks it in
      }
    }
    return fresh;
  };
  for (const t of history) {
    if (t.role === 'player') {
      apply(t.text, t.shownDocumentId);
      if (breakdownMet(suspect, caught, shown)) confessedBefore = true;
    }
  }
  const technique = classifyQuestion(playerMessage);
  const newlyCaught = apply(playerMessage, shownDocumentId);
  return {
    caught,
    newlyCaught,
    quality,
    shownDocs: [...shown],
    canConfess: breakdownMet(suspect, caught, shown),
    confessedBefore,
    technique,
    pressure,
    coerced: !isCulprit && technique === 'coercive' && pressure >= PRESSURE_LIMIT,
  };
}

export function breakdownMet(suspect: SecretSuspect, caught: string[], shown: Set<string>): boolean {
  if (!suspect.breakdown) return false;
  const { minLiesCaught, requiredShown } = suspect.breakdown;
  return caught.length >= minLiesCaught && requiredShown.some((d) => shown.has(d));
}

/** Validate model-reported flags against the server's own computation. */
export function reconcileFlags(
  modelFlags: { caughtLieIds?: unknown; mood?: unknown; confessed?: unknown } | null,
  state: InterviewState,
  fallbackMood: string,
): { caughtLieIds: string[]; mood: string; confessed: boolean } {
  const mood = typeof modelFlags?.mood === 'string' && modelFlags.mood.length <= 24
    ? modelFlags.mood.replace(/[^\p{L} -]/gu, '').trim() || fallbackMood
    : fallbackMood;
  return {
    caughtLieIds: state.caught, // server truth, regardless of what the model claimed
    mood,
    confessed: state.canConfess && (modelFlags?.confessed === true || modelFlags === null),
  };
}

/** Splits streamed text so the trailing state block never reaches the client. */
export class StateStripper {
  private buf = '';
  private done = false;
  tail = '';
  push(chunk: string): string {
    if (this.done) { this.tail += chunk; return ''; }
    this.buf += chunk;
    const idx = this.buf.indexOf(STATE_MARKER);
    if (idx >= 0) {
      const out = this.buf.slice(0, idx);
      this.tail = this.buf.slice(idx + STATE_MARKER.length);
      this.buf = '';
      this.done = true;
      return out;
    }
    // hold back enough characters to catch a marker split across chunks, plus a stray backtick fence
    // and hold everything from the first "{" (a state block without its marker) until flush decides
    const hold = STATE_MARKER.length + 8;
    const brace = this.buf.indexOf('{');
    const cut = Math.min(brace >= 0 ? brace : Infinity, this.buf.length - hold);
    if (cut <= 0) return '';
    const out = this.buf.slice(0, cut);
    this.buf = this.buf.slice(cut);
    return out;
  }
  flush(): string {
    if (this.done) return '';
    const out = this.buf;
    this.buf = '';
    // a JSON block without marker: strip a trailing {...} that looks like state
    const m = out.match(/\n?\s*(```(?:json)?\s*)?\{[^{}]*"caughtLieIds"[\s\S]*$/);
    if (m && m.index !== undefined) { this.tail = out.slice(m.index); return out.slice(0, m.index); }
    return out;
  }
  parse(): Record<string, unknown> | null {
    const m = this.tail.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch { return null; }
  }
}

/** Compress old turns into a short summary so the conversation stays bounded. */
export function compressHistory(history: ChatTurn[]): { summary: string | null; recent: ChatTurn[] } {
  const clipped = history.slice(-MAX_HISTORY_TURNS).map((t) => ({ ...t, text: t.text.slice(0, MAX_MESSAGE_CHARS) }));
  if (clipped.length <= KEEP_RECENT_TURNS) return { summary: null, recent: clipped };
  let cut = clipped.length - KEEP_RECENT_TURNS;
  if (clipped[cut]?.role === 'suspect') cut += 1; // keep the recent slice starting on a player turn
  const old = clipped.slice(0, cut);
  const lines: string[] = [];
  for (let i = 0; i < old.length; i++) {
    const t = old[i];
    const first = t.text.split(/(?<=[.?!])\s/)[0].slice(0, 140);
    lines.push(t.role === 'player'
      ? `Investigator asked: "${first}"${t.shownDocumentId ? ` (showed document ${t.shownDocumentId})` : ''}`
      : `You answered: "${first}"`);
  }
  return { summary: lines.join('\n'), recent: clipped.slice(cut) };
}

/** The final SSE event, built the same way by the server and the static prototype. */
export function doneEvent(
  sec: SecretSuspect, state: InterviewState, flags: { caughtLieIds: string[]; mood: string; confessed: boolean },
): import('./types').InterrogateDone {
  return {
    type: 'done',
    ...flags,
    confessed: flags.confessed && !state.coerced,
    newlyCaught: state.newlyCaught.map((id) => ({ id, card: sec.lies.find((l) => l.id === id)!.card, quality: state.quality[id] })),
    technique: state.technique,
    pressure: state.pressure,
    unreliable: state.coerced,
  };
}
