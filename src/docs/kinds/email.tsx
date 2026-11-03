import type { DocProps } from '../types';
export default function Email({ doc }: DocProps) {
  const b = doc.body;
  return (
    <div className="email">
      <div className="email-bar"><span aria-hidden="true">●●●</span> Mail</div>
      <dl className="email-meta">
        <dt>From</dt><dd>{b.from}</dd>
        <dt>To</dt><dd>{b.to}</dd>
        {b.date && <><dt>Date</dt><dd>{b.date}</dd></>}
        <dt>Subject</dt><dd><strong>{b.subject}</strong></dd>
      </dl>
      <div className="email-body">{b.lines.map((l: string, i: number) => <p key={i}>{l}</p>)}</div>
      {b.attachments && <div className="email-att">{b.attachments.map((a: string) => <span key={a} className="att">📎 {a}</span>)}</div>}
    </div>
  );
}
