import type { DocProps } from '../types';
export default function Typed({ doc }: DocProps) {
  const b = doc.body;
  return (
    <div className="typed">
      {b.letterhead && <div className="letterhead">{b.letterhead}</div>}
      {b.ref && <div className="ref">{b.ref}{doc.date ? `, ${doc.date}` : ''}</div>}
      {b.lines.map((l: string, i: number) => <p key={i}>{l}</p>)}
      {b.signature && <div className="signature">{b.signature}</div>}
      {b.stamp && <div className="stamp red">{b.stamp}</div>}
    </div>
  );
}
