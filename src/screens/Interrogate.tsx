import { useEffect, useRef, useState } from 'react';
import { useKase, useCS } from '../lib/caseContext';
import { availableDocs, caseStore, emptyChat, type Turn } from '../store';
import { interrogate } from '../api';
import { Portrait } from '../lib/portrait';
import { assetUrl } from '../api';
import { go, useRoute } from '../lib/router';

const TECH_LABEL: Record<string, string> = { open: 'open question', closed: 'closed question', leading: 'leading question', coercive: 'pressure' };
const TECH_HELP: Record<string, string> = {
  open: 'Open questions draw out more detail and commit the witness to an account.',
  closed: 'Closed questions check specific facts.',
  leading: 'Leading questions put words in the witness\'s mouth. Answers to them are weak evidence.',
  coercive: 'Threats and accusations make people defensive, and can make innocent people say false things.',
};

function Craft() {
  return (
    <details className="craft">
      <summary>Interview craft</summary>
      <ul>
        <li><strong>Let them commit first.</strong> Ask about the topic before you show the record. A lie told on record and then contradicted is <em>locked in</em>; show the record too early and the witness adapts their story. (Strategic Use of Evidence, Hartwig and Granhag)</li>
        <li><strong>Open questions</strong> ("Tell me about...", "Walk me through...") get fuller accounts. (Cognitive interview; the PEACE model used in England and Wales)</li>
        <li><strong>Pressure produces compliance, not truth.</strong> Push an innocent witness hard enough and they will say what you want. Those admissions are worthless. (Kassin and Gudjonsson on false confessions)</li>
        <li>A lie is not a confession. Innocent people lie too, usually to hide something embarrassing.</li>
      </ul>
    </details>
  );
}

export default function Interrogate() {
  const kase = useKase();
  const route = useRoute();
  const st = useCS((s) => s);
  const suspectId = route.param && kase.suspects.some((s) => s.id === route.param) ? route.param : null;

  if (!suspectId) {
    return (
      <div className="interrogate-pick">
        <div className="screen-head"><h1>Reconstruction room</h1><p>Choose who to question. Show them documents you have read. Lies you break are stamped and copied to your notes.</p></div>
        <ul className="suspect-grid">
          {kase.suspects.map((s) => {
            const chat = st.chats[s.id];
            return (
              <li key={s.id}>
                <button type="button" className="suspect-card" onClick={() => go(kase.id, 'interrogate', s.id)}>
                  {s.portraitAsset ? <img src={assetUrl(kase.id, s.portraitAsset)} alt="" /> : <Portrait spec={s.portrait} label="" size={110} />}
                  <span className="sc-name">{s.name}</span>
                  <span className="sc-role">{s.role}</span>
                  {chat && <span className="sc-meta">{chat.turns.filter((t) => t.role === 'player').length} questions . {chat.caught.length} caught{chat.confessed ? ' . CONFESSED' : ''}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
  return <Room key={suspectId} suspectId={suspectId} />;
}

function Room({ suspectId }: { suspectId: string }) {
  const kase = useKase();
  const st = useCS((s) => s);
  const suspect = kase.suspects.find((s) => s.id === suspectId)!;
  const chat = st.chats[suspectId] ?? emptyChat();
  const [input, setInput] = useState('');
  const [exhibit, setExhibit] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const readDocs = availableDocs(kase, st).filter((d) => st.read[d.id]);
  const chips = st.mode === 'detective' ? [] : suspect.questions.filter((q) => !q.unlockedBy || st.read[q.unlockedBy]);
  const asked = new Set(chat.turns.filter((t) => t.role === 'player').map((t) => t.text));

  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [chat.turns.length, live]);

  const send = async (text: string, shown: string | null, retryOf?: number) => {
    const msg = text.trim();
    if ((!msg && !shown) || busy) return;
    const store = caseStore(kase.id).getState();
    let history = (store.chats[suspectId] ?? emptyChat()).turns.filter((t) => !t.error);
    if (retryOf !== undefined) {
      // drop the failed exchange, keep everything before it
      store.updateChat(suspectId, (c) => ({ ...c, turns: c.turns.slice(0, retryOf) }));
      history = history.slice(0, history.length - 1);
    }
    const playerTurn: Turn = { role: 'player', text: msg || '(places a document on the table)', shownDocumentId: shown ?? undefined, at: Date.now() };
    store.updateChat(suspectId, (c) => ({ ...c, turns: [...c.turns, playerTurn] }));
    setInput(''); setExhibit(null); setBusy(true); setLive('');
    let acc = '';
    await interrogate(
      { caseId: kase.id, suspectId, history: history.map(({ role, text, shownDocumentId }) => ({ role, text, shownDocumentId })), playerMessage: playerTurn.text, shownDocumentId: shown ?? undefined },
      {
        onText: (t) => { acc += t; setLive(acc); },
        onDone: (d) => {
          const s = caseStore(kase.id).getState();
          s.updateChat(suspectId, (c) => ({
            ...c,
            turns: [
              ...c.turns.slice(0, -1), { ...c.turns[c.turns.length - 1], technique: d.technique },
              { role: 'suspect', text: acc.trim(), caught: d.newlyCaught.map((n) => n.id), quality: Object.fromEntries(d.newlyCaught.map((n) => [n.id, n.quality])), unreliable: d.unreliable, at: Date.now() },
            ],
            caught: d.caughtLieIds, mood: d.mood, confessed: c.confessed || d.confessed,
          }));
          for (const n of d.newlyCaught) s.addCard({ kind: 'caught', title: `CAUGHT${n.quality === 'locked' ? ' (LOCKED IN)' : ''}: ${suspect.name}`, text: n.card, suspectId });
          if (d.unreliable) s.addCard({ kind: 'warning', title: `UNRELIABLE: ${suspect.name}`, text: `${suspect.name} gave an admission under pressure. Admissions obtained by threats are not evidence, and innocent people make them.`, suspectId });
          if (d.confessed) s.addCard({ kind: 'caught', title: `CONFESSION: ${suspect.name}`, text: `${suspect.name} confessed in the reconstruction room. Read the transcript in your notes.`, suspectId });
        },
        onError: (text) => {
          caseStore(kase.id).getState().updateChat(suspectId, (c) => ({ ...c, turns: [...c.turns, { role: 'suspect', text, error: true, at: Date.now() }] }));
        },
      },
    );
    setLive(''); setBusy(false);
  };

  return (
    <div className="room">
      <aside className="room-side">
        <button type="button" className="btn small ghost-light" onClick={() => go(kase.id, 'interrogate')}>← All witnesses</button>
        <div className="room-photo">
          {suspect.portraitAsset ? <img src={assetUrl(kase.id, suspect.portraitAsset)} alt={`Portrait of ${suspect.name}`} /> : <Portrait spec={suspect.portrait} label={`Portrait of ${suspect.name}`} size={150} />}
        </div>
        <h1 className="room-name">{suspect.name}</h1>
        <p className="room-role">{suspect.role}, {suspect.age}</p>
        <p className="mood" aria-live="polite">Mood: <strong>{busy ? '...' : chat.mood}</strong></p>
        <p className="room-stats">{chat.caught.length} lie{chat.caught.length === 1 ? '' : 's'} caught{chat.confessed ? ' . confession recorded' : ''}</p>
        <Craft />
      </aside>
      <section className="record" aria-label={`Interview record, ${suspect.name}`}>
        <div className="record-head">INTERVIEW RECORD . {kase.title.toUpperCase()} . WITNESS: {suspect.name.toUpperCase()}</div>
        <div className="record-log" ref={logRef} aria-live="polite" aria-busy={busy}>
          <p className="line a opening"><span className="who">A.</span> {suspect.openingLine}</p>
          {chat.turns.map((t, i) => (
            <div key={i} className={`line ${t.role === 'player' ? 'q' : 'a'} ${t.error ? 'err' : ''}`}>
              <span className="who">{t.role === 'player' ? 'Q.' : 'A.'}</span>{' '}
              {t.shownDocumentId && <span className="exhibit-tag">Exhibit shown: {kase.documents.find((d) => d.id === t.shownDocumentId)?.title}</span>}
              <span className="said">{t.text}</span>
              {t.role === 'player' && t.technique && <span className={`tech tech-${t.technique}`} title={TECH_HELP[t.technique]}>{TECH_LABEL[t.technique]}</span>}
              {t.caught?.length ? <span className="caught-stamp">CAUGHT{t.caught.some((id) => t.quality?.[id] === 'locked') ? <small>LOCKED IN</small> : <small>ADAPTED</small>}</span> : null}
              {t.unreliable && <span className="caught-stamp warn">UNRELIABLE<small>OBTAINED UNDER PRESSURE</small></span>}
              {t.error && i === chat.turns.length - 1 && !busy && (
                <button type="button" className="btn small" onClick={() => { const p = chat.turns[i - 1]; send(p.text, p.shownDocumentId ?? null, i - 1); }}>Retry the question</button>
              )}
            </div>
          ))}
          {busy && <p className="line a typing"><span className="who">A.</span> {live}<span className="caret" aria-hidden="true">▍</span></p>}
          {chat.confessed && <p className="confession-banner">CONFESSION RECORDED</p>}
        </div>
        {chips.length > 0 && (
          <div className="chips" aria-label="Suggested questions">
            {chips.map((q) => (
              <button key={q.id} type="button" className={`chip ${asked.has(q.text) ? 'asked' : ''}`} disabled={busy} onClick={() => send(q.text, exhibit)}>{q.text}</button>
            ))}
          </div>
        )}
        {exhibit && (
          <div className="exhibit-attached">Exhibit: <strong>{kase.documents.find((d) => d.id === exhibit)?.title}</strong>
            <button type="button" className="btn small" onClick={() => setExhibit(null)} aria-label="Remove exhibit">✕</button></div>
        )}
        <form className="ask" onSubmit={(e) => { e.preventDefault(); send(input, exhibit); }}>
          <label htmlFor="ask-input" className="sr-only">Your question</label>
          <textarea id="ask-input" value={input} maxLength={800} rows={2} placeholder={`Ask ${suspect.name.split(' ').slice(-1)[0]} anything...`} disabled={busy}
            onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input, exhibit); } }} />
          <div className="ask-actions">
            <button type="button" className="btn" onClick={() => setPicking(!picking)} aria-expanded={picking} disabled={busy}>📎 Show document</button>
            <button type="submit" className="btn primary" disabled={busy || (!input.trim() && !exhibit)}>{busy ? 'Listening...' : 'Ask'}</button>
          </div>
        </form>
        {picking && (
          <div className="doc-picker" role="listbox" aria-label="Choose a document to show">
            {readDocs.length === 0 && <p>Read some documents on the desk first.</p>}
            {readDocs.map((d) => (
              <button key={d.id} type="button" role="option" aria-selected={exhibit === d.id} className="picker-item" onClick={() => { setExhibit(d.id); setPicking(false); }}>{d.title}</button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
