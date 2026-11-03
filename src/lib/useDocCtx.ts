import { useMemo } from 'react';
import type { DocContext } from '../docs/types';
import { assetUrl } from '../api';
import { useKase, useCS } from './caseContext';
import { useUI } from '../store';

export function useDocCtx(): DocContext {
  const kase = useKase();
  const scanned = useCS((s) => s.scanned);
  const seals = useCS((s) => s.seals);
  const scan = useCS((s) => s.scan);
  const breakSeal = useCS((s) => s.breakSeal);
  const setOpenDoc = useUI((u) => u.setOpenDoc);
  const setToast = useUI((u) => u.setToast);
  return useMemo(() => ({
    kase, scanned, seals,
    asset: (f: string) => assetUrl(kase.id, f),
    scan: (id: string) => {
      const first = !scanned.includes(id);
      scan(id);
      const t = kase.documents.find((d) => d.unlockedBy?.qr === id);
      if (first && t) setToast(`New record on the desk: ${t.title}`);
    },
    breakSeal: (id: string) => {
      breakSeal(id);
      const t = kase.documents.filter((d) => d.unlockedBy?.seal === id);
      if (t.length) setToast(`New record on the desk: ${t.map((d) => d.title).join(', ')}`);
    },
    openDoc: (id: string) => setOpenDoc(id),
  }), [kase, scanned, seals, scan, breakSeal, setOpenDoc, setToast]);
}
