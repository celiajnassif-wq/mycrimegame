import type { DocProps } from '../types';
export default function Form({ doc, ctx }: DocProps) {
  const b = doc.body;
  const hl: number[] = b.highlight ?? [];
  return (
    <div className="form">
      <div className="letterhead">{b.heading}</div>
      {b.subheading && <div className="ref">{b.subheading}</div>}
      <div className="table-wrap" tabIndex={0} aria-label={`${doc.title} table`}>
        <table>
          <thead><tr>{b.columns.map((c: string) => <th key={c} scope="col">{c}</th>)}</tr></thead>
          <tbody>
            {b.rows.map((r: string[], i: number) => (
              <tr key={i} className={hl.includes(i) ? 'hl' : ''}>{r.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      {b.signatureSvg && <div className="sig-line"><span>Signed:</span><img className="sig-img" src={ctx.asset(b.signatureSvg)} alt="Signature initial on the receipt, a looped K" /></div>}
      {b.footer && <p className="footer">{b.footer}</p>}
    </div>
  );
}
