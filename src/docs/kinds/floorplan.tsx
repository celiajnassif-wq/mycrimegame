import type { DocProps } from '../types';
export default function FloorPlan({ doc, ctx }: DocProps) {
  const b = doc.body;
  return (
    <div className="floorplan">
      <img src={ctx.asset(b.svg)} alt={`Hand-drawn floor plan. ${b.caption ?? ''}`} />
      <ol className="legend">{b.legend.map((l: { n: number; label: string }) => <li key={l.n}><span className="num">{l.n}</span> {l.label}</li>)}</ol>
      {b.caption && <p className="caption">{b.caption}</p>}
    </div>
  );
}
