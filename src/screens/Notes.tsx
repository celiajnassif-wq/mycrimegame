import { useState } from 'react';
import { useKase, useCS } from '../lib/caseContext';
import { useUI, type DocHighlight, type NoteCard } from '../store';
import { COLORS } from '../lib/highlight';

type Mark = { kind: 'highlight'; h: DocHighlight } | { kind: 'note'; c: NoteCard };

function EditableNote({ value, onSave, label }: { value: string; onSave: (v: string) => void; label: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editing) {
    return (
      <div className="mark-note-row">
        {value ? <p className="mark-note">{value}</p> : null}
        <button type="button" className="linkish small-link" onClick={() => { setDraft(value); setEditing(true); }}>{value ? 'Edit note' : 'Add a note'}</button>
      </div>
    );
  }
  return (
    <div className="mark-edit">
      <label className="sr-only" htmlFor={`edit-${label}`}>Note</label>
      <textarea id={`edit-${label}`} rows={2} value={draft} autoFocus onChange={(e) => setDraft(e.target.value)} />
      <button type="button" className="btn small primary" onClick={() => { onSave(draft.trim()); setEditing(false); }}>Save</button>
      <button type="button" className="btn small" onClick={() => setEditing(false)}>Cancel</button>
    </div>
  );
}

function MarksSection() {
  const kase = useKase();
  const highlights = useCS((s) => s.highlights);
  const cards = useCS((s) => s.cards);
  const updateHighlight = useCS((s) => s.updateHighlight);
  const removeHighlight = useCS((s) => s.removeHighlight);
  const updateCard = useCS((s) => s.updateCard);
  const removeCard = useCS((s) => s.removeCard);
  const setOpenDoc = useUI((u) => u.setOpenDoc);
  const showHighlight = useUI((u) => u.showHighlight);
  const [q, setQ] = useState('');
  const [color, setColor] = useState<string>('all');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const marks: Mark[] = [
    ...highlights.map((h) => ({ kind: 'highlight' as const, h })),
    ...cards.filter((c) => c.kind === 'note' && c.docId).map((c) => ({ kind: 'note' as const, c })),
  ];
  const docIdOf = (m: Mark) => (m.kind === 'highlight' ? m.h.docId : m.c.docId!);
  const title = (id: string) => kase.documents.find((d) => d.id === id)?.title ?? id;
  const needle = q.trim().toLowerCase();
  const shown = marks.filter((m) => {
    if (color !== 'all' && (m.kind === 'note' ? color !== 'note' : m.h.color !== color)) return false;
    if (!needle) return true;
    const hay = m.kind === 'highlight' ? `${m.h.text} ${m.h.note} ${title(m.h.docId)}` : `${m.c.text} ${title(m.c.docId!)}`;
    return hay.toLowerCase().includes(needle);
  });
  // group by document, in desk order
  const order = kase.documents.map((d) => d.id);
  const groups = [...new Set(shown.map(docIdOf))].sort((a, b) => order.indexOf(a) - order.indexOf(b));

  return (
    <section className="marks" aria-labelledby="marks-title">
      <div className="marks-head">
        <h2 id="marks-title">Highlights and notes <span className="count">{marks.length}</span></h2>
        {marks.length > 0 && (
          <div className="marks-filters">
            <label htmlFor="marks-search" className="sr-only">Search highlights and notes</label>
            <input id="marks-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your highlights and notes" />
            <label htmlFor="marks-color" className="sr-only">Filter by colour</label>
            <select id="marks-color" value={color} onChange={(e) => setColor(e.target.value)}>
              <option value="all">All marks</option>
              {COLORS.map((c) => <option key={c.id} value={c.id}>{c.label} highlights</option>)}
              <option value="note">Whole-document notes</option>
            </select>
          </div>
        )}
      </div>
      {marks.length === 0 && <p className="empty light">Nothing yet. In any document, select text to highlight it or add a note. Everything you mark is collected here.</p>}
      {marks.length > 0 && shown.length === 0 && <p className="empty light">Nothing matches "{q}".</p>}
      {groups.map((docId) => (
        <div key={docId} className="mark-group">
          <h3><button type="button" className="mark-doc" onClick={() => setOpenDoc(docId)}>{title(docId)}</button></h3>
          <ul>
            {shown.filter((m) => docIdOf(m) === docId).map((m) => m.kind === 'highlight' ? (
              <li key={m.h.id} className={`mark-item c-${m.h.color}`}>
                <blockquote className="mark-quote-block">{m.h.text}</blockquote>
                <EditableNote label={m.h.id} value={m.h.note} onSave={(note) => updateHighlight(m.h.id, { note })} />
                <div className="mark-actions">
                  <button type="button" className="btn small" onClick={() => showHighlight(m.h.docId, m.h.id)}>Show in document</button>
                  <span className="swatches" role="group" aria-label="Change colour">
                    {COLORS.map((c) => <button key={c.id} type="button" className={`swatch mini c-${c.id} ${m.h.color === c.id ? 'on' : ''}`} aria-pressed={m.h.color === c.id} aria-label={c.label} onClick={() => updateHighlight(m.h.id, { color: c.id })} />)}
                  </span>
                  {confirmDel === m.h.id
                    ? <><button type="button" className="btn small primary" onClick={() => { removeHighlight(m.h.id); setConfirmDel(null); }}>Delete</button><button type="button" className="btn small" onClick={() => setConfirmDel(null)}>Keep</button></>
                    : <button type="button" className="linkish small-link" onClick={() => setConfirmDel(m.h.id)}>Delete</button>}
                </div>
              </li>
            ) : (
              <li key={m.c.id} className="mark-item c-note">
                <span className="mark-kind">Note on the whole document</span>
                <EditableNote label={m.c.id} value={m.c.text} onSave={(t) => (t ? updateCard(m.c.id, t) : removeCard(m.c.id))} />
                <div className="mark-actions">
                  <button type="button" className="btn small" onClick={() => setOpenDoc(m.c.docId!)}>Open document</button>
                  {confirmDel === m.c.id
                    ? <><button type="button" className="btn small primary" onClick={() => { removeCard(m.c.id); setConfirmDel(null); }}>Delete</button><button type="button" className="btn small" onClick={() => setConfirmDel(null)}>Keep</button></>
                    : <button type="button" className="linkish small-link" onClick={() => setConfirmDel(m.c.id)}>Delete</button>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

export default function Notes() {
  const kase = useKase();
  const notes = useCS((s) => s.notes);
  const setNotes = useCS((s) => s.setNotes);
  const cards = useCS((s) => s.cards);
  const chats = useCS((s) => s.chats);
  const caught = cards.filter((c) => c.kind === 'caught');
  return (
    <div className="notes-screen">
      <div className="screen-head"><h1>Notes</h1><p>Everything you highlight or note in a document is collected here. Your notepad saves as you write.</p></div>
      <MarksSection />
      <div className="notes-grid">
        <div className="notepad">
          <label htmlFor="notepad" className="notepad-label">Notepad</label>
          <textarea id="notepad" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Who had the chance? Who had the reason? What does the record say?" />
          <p className="autosave" aria-live="polite">{notes ? 'Saved' : ''}</p>
        </div>
        <div className="cards-col">
          <h2 className="col-title">Caught lies</h2>
          {caught.length === 0 && <p className="empty">None yet. Show a witness the record that contradicts them.</p>}
          {[...caught].reverse().map((c) => (
            <article key={c.id} className="note-card caught"><h3>{c.title}</h3><p>{c.text}</p></article>
          ))}
        </div>
      </div>
      <section className="transcripts" aria-labelledby="tr-h">
        <h2 id="tr-h">Interview transcripts</h2>
        {kase.suspects.filter((s) => chats[s.id]?.turns.length).length === 0 && <p className="empty light">No interviews yet.</p>}
        {kase.suspects.filter((s) => chats[s.id]?.turns.length).map((s) => (
          <details key={s.id} className="transcript">
            <summary>{s.name} ({chats[s.id].turns.filter((t) => t.role === 'player').length} questions, {chats[s.id].caught.length} caught)</summary>
            <div className="record-log static">
              {chats[s.id].turns.map((t, i) => (
                <p key={i} className={`line ${t.role === 'player' ? 'q' : 'a'}`}><span className="who">{t.role === 'player' ? 'Q.' : 'A.'}</span> {t.shownDocumentId && <em>[Exhibit: {kase.documents.find((d) => d.id === t.shownDocumentId)?.title}] </em>}{t.text}{t.caught?.length ? <span className="caught-stamp">CAUGHT</span> : null}</p>
              ))}
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}
