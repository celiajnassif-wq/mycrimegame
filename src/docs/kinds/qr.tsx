import { useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import type { DocProps } from '../types';
import { sfx } from '../../lib/sound';

export default function QR({ doc, ctx }: DocProps) {
  const b = doc.body;
  const done = ctx.scanned.includes(doc.id);
  const [scanning, setScanning] = useState(false);
  const cells = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(b.payload);
    q.make();
    const n = q.getModuleCount();
    const rects: string[] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) rects.push(`M${c} ${r}h1v1h-1z`);
    return { n, d: rects.join('') };
  }, [b.payload]);
  const target = ctx.kase.documents.find((d) => d.id === b.unlocks);
  const scan = () => { setScanning(true); setTimeout(() => { setScanning(false); sfx.beep(); ctx.scan(doc.id); }, 900); };
  return (
    <div className="qr-doc">
      <p className="qr-label">{b.label}</p>
      <button type="button" className={`qr-code ${scanning ? 'scanning' : ''}`} onClick={scan} disabled={scanning} aria-label={done ? 'Scan the code again' : 'Scan the QR code'}>
        <svg viewBox={`-2 -2 ${cells.n + 4} ${cells.n + 4}`} width="180" height="180" shapeRendering="crispEdges" aria-hidden="true">
          <rect x="-2" y="-2" width={cells.n + 4} height={cells.n + 4} fill="#fff" />
          <path d={cells.d} fill="#111" />
        </svg>
        <span className="scanline" aria-hidden="true" />
      </button>
      <p className="qr-caption">{scanning ? 'Scanning...' : b.caption}</p>
      {done && target && (
        <div className="qr-result" role="status">
          <span className="stamp green">RECORD RETRIEVED</span>
          <button type="button" className="btn" onClick={() => ctx.openDoc(target.id)}>Open: {target.title}</button>
        </div>
      )}
    </div>
  );
}
