import type { DocProps } from '../types';
export default function Handwriting({ doc, ctx }: DocProps) {
  const b = doc.body;
  return (
    <div className="hw-compare">
      <div className="letterhead">{b.heading}</div>
      {b.rows.map((row: { label: string; cells: { svg?: string; caption: string }[] }) => (
        <section key={row.label} className="hw-row" aria-label={row.label}>
          <h4>{row.label}</h4>
          <div className="hw-cells">
            {row.cells.map((cell, i) => (
              <figure key={i} className="hw-cell">
                <div className="hw-col-label">{b.columns[i]}</div>
                {cell.svg && <img src={ctx.asset(cell.svg)} alt={`${row.label}: ${b.columns[i]}. ${cell.caption}`} />}
                <figcaption>{cell.caption}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
      <div className="conclusion">{b.conclusion.map((c: string, i: number) => <p key={i}>{c}</p>)}</div>
      {b.signed && <div className="signature">{b.signed}</div>}
    </div>
  );
}
