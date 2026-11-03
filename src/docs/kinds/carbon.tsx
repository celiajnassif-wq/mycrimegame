import type { DocProps } from '../types';
export default function Carbon({ doc }: DocProps) {
  const b = doc.body;
  return (
    <div className="typed carbon-text">
      {b.heading && <div className="letterhead">{b.heading}</div>}
      {doc.date && <div className="ref">{doc.date}</div>}
      {b.lines.map((l: string, i: number) => <p key={i}>{l}</p>)}
      {b.signature && <div className="signature">{b.signature}</div>}
    </div>
  );
}
