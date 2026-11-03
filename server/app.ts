import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listCaseIds, loadCase, safeId, CASES_DIR } from './caseStore';
import { staticSystemPrompt, turnNote } from './prompt';
import { mockReply } from './mock';
import { streamReply } from './ai';
import { allow } from './rateLimit';
import { computeState, compressHistory, reconcileFlags, doneEvent, StateStripper, MAX_MESSAGE_CHARS, MAX_HISTORY_TURNS } from '../shared/interrogation';
import { judgeAccusation } from '../shared/accuse';
import type { AccuseRequest, ChatTurn, InterrogateRequest } from '../shared/types';

export const app = new Hono();
const mockMode = () => process.env.MOCK_AI === '1' || !process.env.ANTHROPIC_API_KEY;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

app.get('/api/health', (c) => c.json({ ok: true, ai: mockMode() ? 'mock' : 'live' }));

app.get('/api/cases', (c) => c.json(listCaseIds().map((id) => {
  const k = loadCase(id)!.c;
  return { id, title: k.title, subtitle: k.subtitle, place: k.place, date: k.date };
})));

// Public case data only. secret.json is never sent here.
app.get('/api/cases/:id', (c) => {
  const k = loadCase(c.req.param('id'));
  return k ? c.json(k.c) : c.json({ error: 'not found' }, 404);
});

const MIME: Record<string, string> = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
app.get('/case-assets/:id/:file', (c) => {
  const { id, file } = c.req.param();
  if (!safeId(id) || !/^[a-zA-Z0-9_.-]+$/.test(file) || file.startsWith('.')) return c.text('bad', 400);
  const p = join(CASES_DIR, id, 'assets', file);
  const ext = file.split('.').pop() ?? '';
  if (!existsSync(p) || !MIME[ext]) return c.text('not found', 404);
  return c.body(readFileSync(p), 200, { 'Content-Type': MIME[ext], 'Cache-Control': 'public, max-age=3600', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" });
});

function sessionKey(c: { req: { header: (n: string) => string | undefined } }): string {
  const sid = c.req.header('x-session-id');
  if (sid && /^[a-zA-Z0-9-]{8,64}$/.test(sid)) return sid;
  return c.req.header('x-forwarded-for')?.split(',')[0].trim() ?? 'anon';
}

app.post('/api/interrogate', async (c) => {
  const limit = allow(sessionKey(c));
  if (!limit.ok) return c.json({ error: 'rate', retryAfter: limit.retryAfter, text: '(the duty sergeant raises a hand) Give the witness a few minutes, Inspector.' }, 429);
  let body: InterrogateRequest;
  try { body = await c.req.json(); } catch { return c.json({ error: 'bad json' }, 400); }
  const loaded = typeof body?.caseId === 'string' ? loadCase(body.caseId) : null;
  if (!loaded) return c.json({ error: 'unknown case' }, 404);
  const { c: kase, s: secret } = loaded;
  const pub = kase.suspects.find((x) => x.id === body.suspectId);
  const sec = secret.suspects[body.suspectId];
  if (!pub || !sec) return c.json({ error: 'unknown suspect' }, 404);
  const playerMessage = String(body.playerMessage ?? '').slice(0, MAX_MESSAGE_CHARS).trim();
  const shown = typeof body.shownDocumentId === 'string' && kase.documents.some((d) => d.id === body.shownDocumentId) ? body.shownDocumentId : undefined;
  if (!playerMessage && !shown) return c.json({ error: 'empty message' }, 400);
  const history: ChatTurn[] = (Array.isArray(body.history) ? body.history : [])
    .filter((t) => t && (t.role === 'player' || t.role === 'suspect') && typeof t.text === 'string')
    .slice(-MAX_HISTORY_TURNS)
    .map((t) => ({ role: t.role, text: t.text.slice(0, MAX_MESSAGE_CHARS * 2), shownDocumentId: typeof t.shownDocumentId === 'string' ? t.shownDocumentId : undefined }));
  if (history.length >= MAX_HISTORY_TURNS) return c.json({ error: 'too long', text: '(the witness is exhausted) That is enough for today. Read your notes, Inspector.' }, 413);

  const isCulprit = secret.culprit === pub.id;
  const state = computeState(sec, history, playerMessage || '(shows a document)', shown, isCulprit);
  const shownTitle = shown ? kase.documents.find((d) => d.id === shown)!.title : null;
  const fallbackMood = state.canConfess && isCulprit ? 'broken' : state.coerced ? 'crushed' : state.technique === 'coercive' ? 'hostile' : state.newlyCaught.length ? 'rattled' : sec.mock.mood;

  return streamSSE(c, async (stream) => {
    const send = (data: unknown) => stream.writeSSE({ data: JSON.stringify(data) });
    if (mockMode()) {
      const turnIndex = history.filter((t) => t.role === 'player').length;
      const r = mockReply(kase, secret, pub.id, sec, state, playerMessage, turnIndex, shownTitle);
      const delay = Number(process.env.MOCK_DELAY ?? 25);
      for (const w of r.text.split(/(?<= )/)) { await send({ type: 'text', text: w }); if (delay) await sleep(delay); }
      const flags = reconcileFlags(null, state, r.mood);
      await send(doneEvent(sec, state, flags));
      return;
    }
    const { summary, recent } = compressHistory(history);
    const messages: { role: 'user' | 'assistant'; content: string }[] = [];
    for (const t of recent) {
      const content = t.role === 'player' ? (t.shownDocumentId ? `[Shows document: ${kase.documents.find((d) => d.id === t.shownDocumentId)?.title ?? 'a document'}] ${t.text}` : t.text) : t.text;
      const role = t.role === 'player' ? 'user' : 'assistant';
      if (messages.length && messages[messages.length - 1].role === role) messages[messages.length - 1].content += `\n${content}`;
      else messages.push({ role, content });
    }
    if (messages[0]?.role === 'assistant') messages.shift();
    const userContent = shownTitle ? `[Shows document: ${shownTitle}] ${playerMessage}` : playerMessage;
    if (messages.length && messages[messages.length - 1].role === 'user') messages[messages.length - 1].content += `\n${userContent}`;
    else messages.push({ role: 'user', content: userContent });

    const stripper = new StateStripper();
    let visible = '';
    try {
      const stop = await streamReply({
        staticSystem: staticSystemPrompt(kase, secret, pub, sec, isCulprit),
        turnNote: turnNote(sec, state, shownTitle, isCulprit, summary),
        messages,
        onText: (t) => { const out = stripper.push(t); if (out) { visible += out; void send({ type: 'text', text: out }); } },
      });
      const rest = stripper.flush();
      if (rest) { visible += rest; await send({ type: 'text', text: rest }); }
      if (stop === 'refusal' || !visible.trim()) throw new Error(`empty or refused (${stop})`);
      const flags = reconcileFlags(stripper.parse(), state, fallbackMood);
      await send(doneEvent(sec, state, flags));
    } catch (err) {
      console.error('[interrogate] model error:', (err as Error).message);
      await send({ type: 'error', text: '(the witness asks for a glass of water and the interview pauses) Try the question again in a moment.' });
    }
  });
});

app.post('/api/accuse', async (c) => {
  let b: AccuseRequest;
  try { b = await c.req.json(); } catch { return c.json({ error: 'bad json' }, 400); }
  const loaded = typeof b?.caseId === 'string' ? loadCase(b.caseId) : null;
  if (!loaded) return c.json({ error: 'unknown case' }, 404);
  const res = judgeAccusation(loaded.c, loaded.s, b);
  return 'error' in res ? c.json(res, 400) : c.json(res);
});

app.post('/api/giveup', async (c) => {
  const { caseId } = await c.req.json().catch(() => ({ caseId: '' }));
  const loaded = typeof caseId === 'string' ? loadCase(caseId) : null;
  if (!loaded) return c.json({ error: 'unknown case' }, 404);
  return c.json({ memo: loaded.s.solutionMemo, culprit: loaded.s.culprit });
});
