import type { DocProps } from '../types';
import { Translatable } from '../Translatable';
export default function Handwritten({ doc }: DocProps) {
  const b = doc.body;
  return (
    <div className="handwritten">
      {b.writer && <div className="writer">{b.writer}</div>}
      <Translatable lang={b.lang} dir={b.dir} original={b.original} translation={b.translation} />
      {b.note && <p className="archive-note">{b.note}</p>}
    </div>
  );
}
