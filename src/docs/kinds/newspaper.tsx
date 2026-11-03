import type { DocProps } from '../types';
export default function Newspaper({ doc }: DocProps) {
  const b = doc.body;
  return (
    <div className="newspaper">
      <div className="masthead">{b.masthead}</div>
      {b.dateline && <div className="dateline">{b.dateline}</div>}
      <h3 className="headline">{b.headline}</h3>
      {b.subhead && <div className="subhead">{b.subhead}</div>}
      <div className="news-cols">{b.columns.map((c: string, i: number) => <p key={i}>{c}</p>)}</div>
      {b.also && <div className="also">{b.also}</div>}
    </div>
  );
}
