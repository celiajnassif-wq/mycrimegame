import type { DocProps } from '../types';
export default function Lab({ doc }: DocProps) {
  const b = doc.body;
  return (
    <div className="lab">
      <div className="lab-head"><div className="lab-name">{b.lab}</div>{b.ref && <div className="ref">{b.ref}</div>}</div>
      <div className="table-wrap" tabIndex={0} aria-label={`${doc.title} results`}>
        <table>
          <thead><tr><th scope="col">Test</th><th scope="col">Result</th><th scope="col">Reference</th><th scope="col">Flag</th></tr></thead>
          <tbody>
            {b.rows.map((r: { test: string; result: string; ref: string; flag: string }, i: number) => (
              <tr key={i} className={r.flag ? 'flagged' : ''}><td>{r.test}</td><td><strong>{r.result}</strong></td><td>{r.ref}</td><td className="flag">{r.flag}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {b.conclusion && <div className="conclusion">{b.conclusion.map((c: string, i: number) => <p key={i}>{c}</p>)}</div>}
      {b.signed && <div className="signature">{b.signed}</div>}
    </div>
  );
}
