import type { AccuseRequest, AccuseResponse, CaseData, ChatTurn, InterrogateDone } from '../shared/types';

function sessionId(): string {
  try {
    let id = localStorage.getItem('dossiers:session');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('dossiers:session', id); }
    return id;
  } catch { return 'anonymous-session'; }
}

export async function fetchCases(): Promise<{ id: string; title: string; subtitle: string; place: string; date: string }[]> {
  const r = await fetch('/api/cases');
  return r.json();
}

export async function fetchCase(id: string): Promise<CaseData> {
  const r = await fetch(`/api/cases/${encodeURIComponent(id)}`);
  if (!r.ok) throw new Error('Case not found');
  return r.json();
}

export const assetUrl = (caseId: string, file: string) => `/case-assets/${caseId}/${file}`;

export interface StreamHandlers {
  onText: (t: string) => void;
  onDone: (d: InterrogateDone) => void;
  onError: (text: string) => void;
}

/** POST + server-sent events, read manually because EventSource cannot POST. */
export async function interrogate(
  body: { caseId: string; suspectId: string; history: ChatTurn[]; playerMessage: string; shownDocumentId?: string },
  h: StreamHandlers,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch('/api/interrogate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-session-id': sessionId() },
      body: JSON.stringify(body),
    });
  } catch {
    h.onError('(the line to the interview room is down) Try again in a moment.');
    return;
  }
  if (!res.ok || !res.body) {
    const j = await res.json().catch(() => ({}));
    h.onError(j.text ?? '(the witness asks for a glass of water) Try again in a moment.');
    return;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let finished = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const line = chunk.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      try {
        const ev = JSON.parse(line.slice(5).trim());
        if (ev.type === 'text') h.onText(ev.text);
        else if (ev.type === 'done') { finished = true; h.onDone(ev); }
        else if (ev.type === 'error') { finished = true; h.onError(ev.text); }
      } catch { /* ignore malformed frame */ }
    }
  }
  if (!finished) h.onError('(the witness asks for a glass of water) Try again in a moment.');
}

export async function accuse(body: AccuseRequest): Promise<AccuseResponse> {
  const r = await fetch('/api/accuse', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? 'Could not file the charge');
  return j;
}

export async function giveUp(caseId: string): Promise<{ memo: string[]; culprit: string }> {
  const r = await fetch('/api/giveup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ caseId }) });
  return r.json();
}
