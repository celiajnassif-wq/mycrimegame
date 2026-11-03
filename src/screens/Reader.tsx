import { useCallback, useEffect, useRef, useState } from 'react';
import { useKase, useCS } from '../lib/caseContext';
import { useDocCtx } from '../lib/useDocCtx';
import { DocumentView, registry } from '../docs/registry';
import { isAvailable, useUI, type DocHighlight, type HighlightColor } from '../store';
import { COLORS, anchorToRange, rangeToAnchor, supportsPainting } from '../lib/highlight';

type Anchor = { start: number; end: number; text: string };

export default function Reader({ docId, onClose }: { docId: string; onClose: () => void }) {
  const kase = useKase();
  const ctx = useDocCtx();
  const doc = kase.documents.find((d) => d.id === docId);
  const st = useCS((s) => s);
  const setToast = useUI((u) => u.setToast);
  const focusHighlight = useUI((u) => u.focusHighlight);
  const clearFocus = useUI((u) => u.clearFocus);
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState<Anchor | null>(null);
  const [hlNoting, setHlNoting] = useState<{ color: HighlightColor } | null>(null);
  const [hlNote, setHlNote] = useState('');
  const pendingRef = useRef<Anchor | null>(null);
  const hlNotingRef = useRef(false);
  const clearTimer = useRef<number | undefined>(undefined);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const article = useRef<HTMLElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLElement>(null);
  const prevFocus = useRef<Element | null>(null);
  const docHighlights = st.highlights.filter((h) => h.docId === docId);
  const docNotes = st.cards.filter((c) => c.kind === 'note' && c.docId === docId);

  useEffect(() => { if (doc && isAvailable(doc, st)) st.markRead(doc.id); }, [docId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    prevFocus.current = document.activeElement;
    closeRef.current?.focus();
    document.body.classList.add('no-scroll');
    return () => { document.body.classList.remove('no-scroll'); (prevFocus.current as HTMLElement | null)?.focus?.(); };
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (pendingRef.current || hlNotingRef.current) { cancelSelection(); return; }
        onClose();
      }
      if (e.key === 'Tab' && dialog.current) {
        const f = dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  // Watch the text selection inside the document.
  useEffect(() => {
    const onSel = () => {
      if (hlNotingRef.current) return;
      const sel = window.getSelection();
      const art = article.current;
      const range = sel && sel.rangeCount && !sel.isCollapsed ? sel.getRangeAt(0) : null;
      const anchor = range && art && art.contains(range.commonAncestorContainer) ? rangeToAnchor(art, range) : null;
      if (anchor) {
        window.clearTimeout(clearTimer.current);
        pendingRef.current = anchor;
        setPending(anchor);
      } else if (pendingRef.current) {
        // short grace period so a tap on the bar still lands after a touch clears the selection
        window.clearTimeout(clearTimer.current);
        clearTimer.current = window.setTimeout(() => { pendingRef.current = null; setPending(null); }, 400);
      }
    };
    document.addEventListener('selectionchange', onSel);
    return () => { document.removeEventListener('selectionchange', onSel); window.clearTimeout(clearTimer.current); };
  }, []);

  const cancelSelection = () => {
    window.getSelection()?.removeAllRanges();
    pendingRef.current = null; hlNotingRef.current = false;
    setPending(null); setHlNoting(null); setHlNote('');
  };

  const saveHighlight = (color: HighlightColor, withNote: string) => {
    const a = pendingRef.current;
    if (!a) return;
    st.addHighlight({ docId, start: a.start, end: a.end, text: a.text, color, note: withNote.trim() });
    cancelSelection();
    setToast(withNote.trim() ? 'Highlight and note saved to Notes' : 'Highlighted. Find it under Notes');
  };

  // Paint highlights with the CSS Custom Highlight API, and repaint when the document changes.
  const paint = useCallback(() => {
    const art = article.current;
    if (!art || !supportsPainting()) return;
    const groups: Record<string, Range[]> = {};
    for (const h of docHighlights) {
      const r = anchorToRange(art, h);
      if (r) (groups[h.color] ??= []).push(r);
    }
    for (const c of COLORS) CSS.highlights.set(`hl-${c.id}`, new Highlight(...(groups[c.id] ?? [])));
  }, [docHighlights]);
  useEffect(() => {
    paint();
    const art = article.current;
    if (!art) return;
    const mo = new MutationObserver(() => paint());
    mo.observe(art, { subtree: true, childList: true, characterData: true });
    return () => mo.disconnect();
  }, [paint]);
  useEffect(() => () => { if (supportsPainting()) { for (const c of COLORS) CSS.highlights.delete(`hl-${c.id}`); CSS.highlights.delete('hl-flash'); } }, []);

  const jumpTo = useCallback((h: DocHighlight) => {
    const art = article.current, sc = scroller.current;
    const r = art ? anchorToRange(art, h) : null;
    if (!r || !sc) { setToast('That passage is hidden right now. If it is in a translation or a sealed letter, open that first.'); return; }
    const rect = r.getBoundingClientRect(), box = sc.getBoundingClientRect();
    sc.scrollBy({ top: rect.top - box.top - box.height / 3, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    if (supportsPainting()) {
      CSS.highlights.set('hl-flash', new Highlight(r));
      window.setTimeout(() => CSS.highlights.delete('hl-flash'), 1800);
    }
  }, [setToast]);

  // Arriving from the Notes screen with a highlight to show.
  useEffect(() => {
    if (!focusHighlight) return;
    const h = st.highlights.find((x) => x.id === focusHighlight && x.docId === docId);
    clearFocus();
    if (h) requestAnimationFrame(() => requestAnimationFrame(() => jumpTo(h)));
  }, [focusHighlight, docId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!doc || !isAvailable(doc, st)) return null;
  const entry = registry[doc.kind];
  const facts = kase.timeline.facts.filter((f) => f.source === doc.id).sort((a, b) => a.start.localeCompare(b.start));
  const pinnedHere = facts.filter((f) => st.pinned.includes(f.id));
  const saveNote = () => {
    if (!note.trim()) return;
    st.addCard({ kind: 'note', title: doc.title, text: note.trim(), docId: doc.id });
    setNote(''); setNoting(false); setToast('Note saved to Notes');
  };
  const keep = (e: React.SyntheticEvent) => e.preventDefault(); // keep the text selection when pressing bar buttons
  const marks = docHighlights.length + docNotes.length;

  return (
    <div className="reader-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="reader" role="dialog" aria-modal="true" aria-labelledby="reader-title" ref={dialog}>
        <div className="reader-bar">
          <h2 id="reader-title" className="reader-title"><span aria-hidden="true">{entry.icon}</span> {doc.title}</h2>
          <div className="reader-tools">
            <button type="button" className="btn small" onClick={() => st.setZoom(st.zoom - 0.1)} aria-label="Smaller text">A-</button>
            <button type="button" className="btn small" onClick={() => st.setZoom(st.zoom + 0.1)} aria-label="Larger text">A+</button>
            <button type="button" className="btn small" onClick={() => setNoting(!noting)} aria-expanded={noting}>Add note</button>
            {marks > 0 && <button type="button" className="btn small" onClick={() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Marks ({marks})</button>}
            <button type="button" className="btn small close" ref={closeRef} onClick={onClose} aria-label="Close document (Esc)">✕ <span className="hide-narrow">Esc</span></button>
          </div>
        </div>
        {noting && (
          <div className="note-pop">
            <label htmlFor="reader-note" className="sr-only">Note about this document</label>
            <textarea id="reader-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="A note on the whole document. To note a passage, select its text instead." rows={2} autoFocus />
            <button type="button" className="btn small primary" onClick={saveNote}>Save note</button>
          </div>
        )}
        <div className="reader-scroll" ref={scroller}>
          <article ref={article} className={`paper paper-${entry.paper} doc-${doc.kind}`} style={{ ['--zoom' as string]: st.zoom }}>
            <DocumentView doc={doc} ctx={ctx} />
          </article>
          <p className="hl-tip no-hl">Tip: select any text in the document to highlight it or add a note.</p>
          {marks > 0 && (
            <section className="doc-marks no-hl" ref={listRef} aria-labelledby="marks-h">
              <h3 id="marks-h">Your marks on this document</h3>
              <ul>
                {docHighlights.map((h) => (
                  <li key={h.id} className={`mark-item c-${h.color}`}>
                    <button type="button" className="linkish mark-quote" onClick={() => jumpTo(h)}>"{h.text.length > 160 ? h.text.slice(0, 160) + '...' : h.text}"</button>
                    {h.note && <p className="mark-note">{h.note}</p>}
                    <button type="button" className="linkish small-link" onClick={() => st.removeHighlight(h.id)}>Remove</button>
                  </li>
                ))}
                {docNotes.map((c) => (
                  <li key={c.id} className="mark-item c-note"><p className="mark-note">{c.text}</p><span className="mark-kind">Note on the whole document</span></li>
                ))}
              </ul>
            </section>
          )}
        </div>
        {pending && (
          <div className="select-bar no-hl" role="toolbar" aria-label="Highlight the selected text" onMouseDown={keep} onPointerDown={hlNoting ? undefined : keep}>
            {!hlNoting ? (
              <>
                <span className="select-quote">"{pending.text.length > 60 ? pending.text.slice(0, 60) + '...' : pending.text}"</span>
                <div className="select-actions">
                  {COLORS.map((c) => (
                    <button key={c.id} type="button" className={`swatch c-${c.id}`} aria-label={`Highlight in ${c.label.toLowerCase()}`} title={`${c.label} highlight`} onClick={() => saveHighlight(c.id, '')} />
                  ))}
                  <button type="button" className="btn small" onClick={() => { hlNotingRef.current = true; setHlNoting({ color: 'yellow' }); }}>Highlight + note</button>
                  <button type="button" className="btn small ghost-light" onClick={cancelSelection} aria-label="Cancel">✕</button>
                </div>
              </>
            ) : (
              <div className="select-note">
                <label htmlFor="hl-note" className="sr-only">Note for the highlighted passage</label>
                <textarea id="hl-note" rows={2} value={hlNote} autoFocus onChange={(e) => setHlNote(e.target.value)} placeholder={`Note on "${pending.text.slice(0, 40)}${pending.text.length > 40 ? '...' : ''}"`} />
                <div className="select-actions">
                  {COLORS.map((c) => (
                    <button key={c.id} type="button" className={`swatch c-${c.id} ${hlNoting.color === c.id ? 'on' : ''}`} aria-pressed={hlNoting.color === c.id} aria-label={`${c.label} highlight`} onClick={() => setHlNoting({ color: c.id })} />
                  ))}
                  <button type="button" className="btn small primary" onClick={() => saveHighlight(hlNoting.color, hlNote)}>Save</button>
                  <button type="button" className="btn small ghost-light" onClick={cancelSelection}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
        {facts.length > 0 && !pending && (
          <div className="pin-bar" aria-label="Pin to timeline">
            <span className="pin-label">📌 Pin to timeline</span>
            <div className="pin-facts">
              {facts.map((f) => {
                const on = st.pinned.includes(f.id);
                return (
                  <button key={f.id} type="button" className={`pin-chip kind-${f.kind} ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => st.togglePin([f.id], !on)}>
                    {on ? '✓ ' : '+ '}{f.start}{f.end ? `-${f.end}` : ''} {f.label}
                  </button>
                );
              })}
            </div>
            {pinnedHere.length < facts.length && <button type="button" className="btn small primary" onClick={() => { st.togglePin(facts.map((f) => f.id), true); setToast(`${facts.length} pinned to the timeline`); }}>Pin all</button>}
          </div>
        )}
      </div>
    </div>
  );
}
