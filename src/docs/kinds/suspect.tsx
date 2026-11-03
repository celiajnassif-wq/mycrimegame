import type { DocProps } from '../types';
import { Portrait } from '../../lib/portrait';
export default function SuspectSheet({ doc, ctx }: DocProps) {
  const s = ctx.kase.suspects.find((x) => x.id === doc.body.suspectId);
  if (!s) return <p>Missing suspect.</p>;
  return (
    <div className="suspect-sheet">
      <div className="sheet-head">PERSON OF INTEREST . {ctx.kase.title.toUpperCase()}</div>
      <div className="sheet-grid">
        <div className="sheet-photo">{s.portraitAsset ? <img src={ctx.asset(s.portraitAsset)} alt={`Portrait of ${s.name}`} /> : <Portrait spec={s.portrait} label={`Portrait of ${s.name}`} size={140} />}<span className="clip" aria-hidden="true" /></div>
        <dl className="sheet-facts">
          <dt>Name</dt><dd>{s.name}</dd>
          <dt>Age</dt><dd>{s.age}</dd>
          <dt>Role</dt><dd>{s.role}</dd>
          {s.address && <><dt>Address</dt><dd>{s.address}</dd></>}
        </dl>
      </div>
      <ul className="sheet-notes">{s.sheet.map((l, i) => <li key={i}>{l}</li>)}</ul>
    </div>
  );
}
