import type { DocProps } from '../types';
export default function Ledger({ doc }: DocProps) {
  const b = doc.body;
  const hl: number[] = b.highlight ?? [];
  return (
    <div className="ledger">
      <div className="ledger-head">{b.heading}</div>
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
      {b.totals && <p className="totals">{b.totals}</p>}
    </div>
  );
}
