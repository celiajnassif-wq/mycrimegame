// Static prototype build only (vite --mode demo aliases ./api to this file).
// Everything runs in the browser with scripted replies. This bundles secret.json, so it is
// a preview, not cheat-proof. The real game keeps the truth on the server.
import type { AccuseRequest, AccuseResponse, CaseData, ChatTurn, SecretData } from '../shared/types';
import type { StreamHandlers } from './api';
import { computeState, reconcileFlags, doneEvent, MAX_MESSAGE_CHARS } from '../shared/interrogation';
import { judgeAccusation } from '../shared/accuse';
import { mockReply } from '../server/mock';

export type { StreamHandlers };

const caseFiles = import.meta.glob('../cases/*/case.json', { eager: true, import: 'default' }) as Record<string, CaseData>;
const secretFiles = import.meta.glob('../cases/*/secret.json', { eager: true, import: 'default' }) as Record<string, SecretData>;
const svgFiles = import.meta.glob('../cases/*/assets/*.svg', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
// photographs (png, jpg, webp) arrive as data URIs
const rasterFiles = import.meta.glob('../cases/*/assets/*.{png,jpg,jpeg,webp}', { eager: true, query: '?inline', import: 'default' }) as Record<string, string>;

const byId = (files: Record<string, unknown>, id: string, name: string) => files[`../cases/${id}/${name}`];
const getCase = (id: string) => byId(caseFiles, id, 'case.json') as CaseData | undefined;
const getSecret = (id: string) => byId(secretFiles, id, 'secret.json') as SecretData | undefined;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const dataUris = new Map<string, string>();
export const assetUrl = (caseId: string, file: string) => {
  const key = `../cases/${caseId}/assets/${file}`;
  if (rasterFiles[key]) return rasterFiles[key];
  if (!dataUris.has(key)) {
    const svg = svgFiles[key] ?? '<svg xmlns="http://www.w3.org/2000/svg"/>';
    dataUris.set(key, `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`);
  }
  return dataUris.get(key)!;
};

export async function fetchCases() {
  return Object.values(caseFiles).map((k) => ({ id: k.id, title: k.title, subtitle: k.subtitle, place: k.place, date: k.date }));
}

export async function fetchCase(id: string): Promise<CaseData> {
  const k = getCase(id);
  if (!k) throw new Error('Case not found');
  return k;
}

export async function interrogate(
  body: { caseId: string; suspectId: string; history: ChatTurn[]; playerMessage: string; shownDocumentId?: string },
  h: StreamHandlers,
): Promise<void> {
  const kase = getCase(body.caseId);
  const secret = getSecret(body.caseId);
  const sec = secret?.suspects[body.suspectId];
  if (!kase || !secret || !sec) { h.onError('(nobody answers) Unknown witness.'); return; }
  const msg = body.playerMessage.slice(0, MAX_MESSAGE_CHARS).trim();
  const shown = body.shownDocumentId && kase.documents.some((d) => d.id === body.shownDocumentId) ? body.shownDocumentId : undefined;
  const state = computeState(sec, body.history, msg || '(shows a document)', shown, secret.culprit === body.suspectId);
  const shownTitle = shown ? kase.documents.find((d) => d.id === shown)!.title : null;
  const turnIndex = body.history.filter((t) => t.role === 'player').length;
  const r = mockReply(kase, secret, body.suspectId, sec, state, msg, turnIndex, shownTitle);
  await sleep(350);
  for (const w of r.text.split(/(?<= )/)) { h.onText(w); await sleep(18); }
  const flags = reconcileFlags(null, state, r.mood);
  h.onDone(doneEvent(sec, state, flags));
}

export async function accuse(b: AccuseRequest): Promise<AccuseResponse> {
  const kase = getCase(b.caseId), secret = getSecret(b.caseId);
  if (!kase || !secret) throw new Error('Unknown case');
  const res = judgeAccusation(kase, secret, b);
  if ('error' in res) throw new Error(res.error);
  return res;
}

export async function giveUp(caseId: string): Promise<{ memo: string[]; culprit: string }> {
  const s = getSecret(caseId)!;
  return { memo: s.solutionMemo, culprit: s.culprit };
}
