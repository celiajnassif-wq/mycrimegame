import { useRef, type PointerEvent } from 'react';
import type { CaseDocument } from '../../shared/types';
import { useKase, useCS } from '../lib/caseContext';
import { availableDocs, useUI } from '../store';
import { registry } from '../docs/registry';

function Card({ doc, read, isNew, pos, onMove, onOpen }: {
  doc: CaseDocument; read: boolean; isNew: boolean; pos?: { x: number; y: number };
  onMove: (x: number, y: number) => void; onOpen: () => void;
}) {
  const entry = registry[doc.kind];
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const el = useRef<HTMLButtonElement>(null);
  const down = (e: PointerEvent) => {
    if (e.pointerType === 'touch' || e.button !== 0) return; // touch: tap to open, page scrolls freely
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos?.x ?? 0, oy: pos?.y ?? 0, moved: false };
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) > 6) { d.moved = true; el.current?.setPointerCapture(e.pointerId); }
    if (d.moved && el.current) el.current.style.translate = `${d.ox + dx}px ${d.oy + dy}px`;
  };
  const up = (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) {
      const x = Math.max(-200, Math.min(200, d.ox + e.clientX - d.sx));
      const y = Math.max(-200, Math.min(300, d.oy + e.clientY - d.sy));
      onMove(x, y);
      (e.currentTarget as HTMLElement).dataset.dragged = '1';
    }
  };
  const click = (e: React.MouseEvent) => {
    const t = e.currentTarget as HTMLElement;
    if (t.dataset.dragged) { delete t.dataset.dragged; return; }
    onOpen();
  };
  return (
    <button ref={el} type="button" className={`doc-card paper-${entry.paper} ${read ? 'is-read' : ''}`} data-doc={doc.id}
      style={{ rotate: `${doc.rotate ?? 0}deg`, translate: pos ? `${pos.x}px ${pos.y}px` : undefined }}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onClick={click}
      aria-label={`${doc.title}. ${entry.label}${doc.date ? ', ' + doc.date : ''}${read ? '. Read.' : '. Unread.'}`}>
      <span className="card-kind" aria-hidden="true">{entry.icon} {entry.label}</span>
      <span className="card-title">{doc.title}</span>
      {doc.date && <span className="card-date">{doc.date}</span>}
      {read && <span className="read-stamp" aria-hidden="true">READ</span>}
      {isNew && !read && <span className="new-tab" aria-hidden="true">NEW</span>}
    </button>
  );
}

export default function Desk() {
  const kase = useKase();
  const st = useCS((s) => s);
  const setOpenDoc = useUI((u) => u.setOpenDoc);
  const docs = availableDocs(kase, st);
  const hiddenLeft = kase.documents.filter((d) => d.hidden).length - docs.filter((d) => d.hidden).length;
  return (
    <div className="desk">
      <div className="desk-toolbar">
        <p className="desk-help">Open a record to read it. Drag papers around with the mouse. {hiddenLeft > 0 && <span>Some records are still sealed or undigitised ({hiddenLeft}).</span>}</p>
        <button type="button" className="btn small" onClick={st.tidy}>Tidy the desk</button>
      </div>
      {kase.groups.map((g) => {
        const pile = docs.filter((d) => d.group === g.id);
        if (!pile.length) return null;
        const read = pile.filter((d) => st.read[d.id]).length;
        return (
          <section key={g.id} className="pile" aria-labelledby={`pile-${g.id}`}>
            <h2 id={`pile-${g.id}`} className="pile-label"><span>{g.label}</span> <small>{read}/{pile.length}</small></h2>
            <div className="pile-cards">
              {pile.map((d) => (
                <Card key={d.id} doc={d} read={!!st.read[d.id]} isNew={!!d.hidden} pos={st.positions[d.id]}
                  onMove={(x, y) => st.move(d.id, x, y)} onOpen={() => setOpenDoc(d.id)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
