// Scripted replies for MOCK_AI=1. Uses secret.json data so any case works offline.
import type { CaseData, SecretData, SecretSuspect } from '../shared/types';
import type { InterviewState } from '../shared/interrogation';

export function mockReply(c: CaseData, s: SecretData, suspectId: string, sec: SecretSuspect, state: InterviewState,
  message: string, turnIndex: number, shownTitle: string | null): { text: string; mood: string } {
  if (s.culprit === suspectId && state.canConfess) {
    return { text: `(long silence, then very quietly) Enough. You have it all, so you may as well have it from me. ${sec.confession}`, mood: 'broken' };
  }
  if (state.coerced) {
    return { text: sec.falseAdmission ?? '(worn down) If you say so. Write whatever you like.', mood: 'crushed' };
  }
  if (state.technique === 'coercive' && !state.newlyCaught.length) {
    return { text: sec.shutdown ?? '(folds their arms) I have nothing more to say to you.', mood: 'hostile' };
  }
  if (state.newlyCaught.length) {
    const lie = sec.lies.find((l) => l.id === state.newlyCaught[0])!;
    const opener = shownTitle ? `(looks at the document for a long moment) ` : '(a pause) ';
    const locked = state.quality[lie.id] === 'locked';
    const base = lie.spoken ?? `${opener}${lie.reaction}`;
    return { text: locked ? `(a long silence; the answer given a few minutes ago hangs in the air) ${base}` : base, mood: s.culprit === suspectId ? 'rattled' : 'ashamed' };
  }
  const m = message.toLowerCase();
  const topic = sec.mock.topics.find((t) => t.keywords.some((k) => m.includes(k.toLowerCase())));
  if (topic) return { text: topic.reply, mood: state.caught.length ? 'wary' : sec.mock.mood };
  if (shownTitle) return { text: `(glances at the ${shownTitle.toLowerCase()}) I do not see what this has to do with me.`, mood: sec.mock.mood };
  void c;
  return { text: sec.mock.fallback[turnIndex % sec.mock.fallback.length], mood: state.caught.length ? 'wary' : sec.mock.mood };
}
