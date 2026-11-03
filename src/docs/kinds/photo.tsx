import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { DocProps } from '../types';

const ZOOM = 3.2;

export default function Photo({ doc, ctx }: DocProps) {
  const b = doc.body;
  const src = ctx.asset(b.svg);
  const frame = useRef<HTMLDivElement>(null);
  const [lens, setLens] = useState<{ x: number; y: number } | null>(null);
  const [back, setBack] = useState(false);
  const dragging = useRef(false);

  const place = (clientX: number, clientY: number) => {
    const r = frame.current!.getBoundingClientRect();
    setLens({ x: Math.min(1, Math.max(0, (clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (clientY - r.top) / r.height)) });
  };
  const down = (e: PointerEvent) => { if (!lens) return; dragging.current = true; (e.target as Element).setPointerCapture?.(e.pointerId); place(e.clientX, e.clientY); };
  const move = (e: PointerEvent) => { if (dragging.current) place(e.clientX, e.clientY); };
  const up = () => { dragging.current = false; };
  const key = (e: KeyboardEvent) => {
    if (!lens) return;
    const d = 0.03;
    const m: Record<string, [number, number]> = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] };
    if (m[e.key]) { e.preventDefault(); setLens({ x: Math.min(1, Math.max(0, lens.x + m[e.key][0])), y: Math.min(1, Math.max(0, lens.y + m[e.key][1])) }); }
  };
  const w = frame.current?.clientWidth ?? 400;
  const h = frame.current?.clientHeight ?? 300;
  const L = Math.round(Math.min(150, w * 0.42));

  return (
    <div className="photo-doc">
      <div className="polaroid">
        {!back ? (
          <div ref={frame} className={`photo-frame ${lens ? 'lens-on' : ''}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
            tabIndex={lens ? 0 : -1} onKeyDown={key} aria-label={lens ? 'Photograph with magnifier. Use arrow keys to move the glass.' : undefined}>
            <img src={src} alt={b.caption} draggable={false} className="sepia" />
            <div className="grain" aria-hidden="true" />
            {b.tags.map((t: { n: number; x: number; y: number; label: string }) => (
              <span key={t.n} className="evtag" style={{ left: `${t.x}%`, top: `${t.y}%` }} title={t.label} aria-hidden="true">{t.n}</span>
            ))}
            {lens && (
              <div className="lens" data-testid="magnifier" style={{
                width: L, height: L, left: `calc(${lens.x * 100}% - ${L / 2}px)`, top: `calc(${lens.y * 100}% - ${L / 2}px)`,
                backgroundImage: `url(${src})`, backgroundSize: `${w * ZOOM}px ${h * ZOOM}px`,
                backgroundPosition: `${-(lens.x * w * ZOOM - L / 2)}px ${-(lens.y * h * ZOOM - L / 2)}px`,
              }} aria-hidden="true" />
            )}
          </div>
        ) : (
          <div className="photo-back"><p>{b.back ?? 'No inscription.'}</p></div>
        )}
        <div className="polaroid-caption">{b.caption}</div>
      </div>
      <div className="photo-tools">
        <button type="button" className="btn small" aria-pressed={!!lens} disabled={back} onClick={() => setLens(lens ? null : { x: 0.5, y: 0.5 })}>
          {lens ? 'Put the magnifier down' : '🔍 Magnifier'}
        </button>
        {b.back && <button type="button" className="btn small" onClick={() => { setBack(!back); setLens(null); }}>{back ? 'Turn to the front' : 'Turn over'}</button>}
      </div>
      <ol className="evidence-list">{b.tags.map((t: { n: number; label: string }) => <li key={t.n}><span className="evtag inline">{t.n}</span> {t.label}</li>)}</ol>
    </div>
  );
}
