import type { CaseData, CaseDocument } from '../../shared/types';

export interface DocContext {
  kase: CaseData;
  asset: (file: string) => string;
  scanned: string[];
  seals: string[];
  scan: (qrId: string) => void;
  breakSeal: (docId: string) => void;
  openDoc: (id: string) => void;
}

export interface DocProps { doc: CaseDocument; ctx: DocContext }

/** Paper style family used by the desk thumbnail and the reader. */
export type PaperStyle = 'typed' | 'carbon' | 'note' | 'news' | 'screen' | 'lab' | 'ledger' | 'photo' | 'plan' | 'envelope' | 'sheet' | 'sticker';
