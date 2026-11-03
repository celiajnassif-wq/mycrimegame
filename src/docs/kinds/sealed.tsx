import { useState } from 'react';
import type { DocProps } from '../types';
import { Translatable } from '../Translatable';
import { sfx } from '../../lib/sound';

export default function Sealed({ doc, ctx }: DocProps) {
  const b = doc.body;
  const broken = ctx.seals.includes(doc.id);
  const [cracking, setCracking] = useState(false);
  const breakIt = () => { sfx.crack(); setCracking(true); setTimeout(() => ctx.breakSeal(doc.id), 700); };
  return (
    <div className="sealed-doc">
      <div className={`envelope ${broken ? 'open' : ''}`}>
        <div className="env-front">
          {b.envelope?.stamp && <div className="stamp red slanted">{b.envelope.stamp}</div>}
          {b.envelope?.postmark && <div className="postmark">{b.envelope.postmark}</div>}
          {b.envelope?.to && <div className="env-to hand hand-latin">{b.envelope.to}</div>}
          {b.envelope?.from && <div className="env-from">From: {b.envelope.from}</div>}
        </div>
        {!broken && (
          <button type="button" className={`wax ${cracking ? 'cracking' : ''}`} onClick={breakIt} disabled={cracking} aria-label="Break the wax seal">
            <span className="wax-initials">{b.seal}</span>
          </button>
        )}
        {!broken && <p className="seal-hint">{cracking ? 'The wax cracks...' : 'Sealed in 1952. Click the wax to break the seal.'}</p>}
      </div>
      {broken && (
        <div className="letter unfold">
          <Translatable lang={b.lang ?? 'en'} original={b.letter} translation={b.translation} />
          {b.note && <p className="archive-note">{b.note}</p>}
        </div>
      )}
    </div>
  );
}
