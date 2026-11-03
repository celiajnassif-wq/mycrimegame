import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AccuseResponse, CaseData, CaseDocument, CatchQuality, ChatTurn, Technique } from '../shared/types';

export interface Turn extends ChatTurn { caught?: string[]; quality?: Record<string, CatchQuality>; technique?: Technique; unreliable?: boolean; error?: boolean; at: number }
export interface Chat { turns: Turn[]; caught: string[]; mood: string; confessed: boolean }
export interface NoteCard { id: string; kind: 'note' | 'caught' | 'warning'; title: string; text: string; docId?: string; suspectId?: string; at: number }
export type HighlightColor = 'yellow' | 'pink' | 'green' | 'blue';
export interface DocHighlight { id: string; docId: string; start: number; end: number; text: string; color: HighlightColor; note: string; at: number }
export type BoardMark = 'C' | 'I' | 'N';
export type GameMode = 'standard' | 'detective';
export interface FiledCharge { who: string; how: string; why: string; proof: string[] }
export type Result = (Extract<AccuseResponse, { outcome: 'solved' }> & { charge?: FiledCharge; at?: number }) | { outcome: 'gaveup'; memo: string[]; culprit: string };

export interface CaseState {
  opened: boolean;
  read: Record<string, number>;
  scanned: string[];
  seals: string[];
  positions: Record<string, { x: number; y: number }>;
  pinned: string[];
  notes: string;
  cards: NoteCard[];
  chats: Record<string, Chat>;
  hints: string[];
  wrongCharges: number;
  refusals: { who: string; text: string }[];
  result: Result | null;
  zoom: number;
  highlights: DocHighlight[];
  mode: GameMode;
  board: Record<string, Record<string, BoardMark>>;
  boardRows: string[];
  open: () => void;
  setMode: (m: GameMode) => void;
  setMark: (docId: string, hyp: string, mark: BoardMark | null) => void;
  setBoardRows: (rows: string[]) => void;
  markRead: (id: string) => void;
  scan: (id: string) => void;
  breakSeal: (id: string) => void;
  move: (id: string, x: number, y: number) => void;
  tidy: () => void;
  togglePin: (ids: string[], on: boolean) => void;
  setNotes: (t: string) => void;
  addCard: (c: Omit<NoteCard, 'id' | 'at'>) => void;
  removeCard: (id: string) => void;
  updateChat: (suspectId: string, fn: (c: Chat) => Chat) => void;
  revealHint: (id: string) => void;
  addRefusal: (who: string, text: string) => void;
  setResult: (r: Result) => void;
  setZoom: (z: number) => void;
  addHighlight: (h: Omit<DocHighlight, 'id' | 'at'>) => string;
  updateHighlight: (id: string, patch: Partial<Pick<DocHighlight, 'note' | 'color'>>) => void;
  removeHighlight: (id: string) => void;
  updateCard: (id: string, text: string) => void;
  reset: () => void;
}

const initial = {
  opened: false, read: {}, scanned: [], seals: [], positions: {}, pinned: [], notes: '', cards: [],
  chats: {}, hints: [], wrongCharges: 0, refusals: [], result: null, zoom: 1, highlights: [] as DocHighlight[], mode: 'standard' as GameMode, board: {} as Record<string, Record<string, BoardMark>>, boardRows: [] as string[],
};

export const emptyChat = (mood = 'composed'): Chat => ({ turns: [], caught: [], mood, confessed: false });

const stores = new Map<string, UseBoundStore<StoreApi<CaseState>>>();

/** One persisted store per case, saved under its own localStorage key. */
export function caseStore(caseId: string) {
  let s = stores.get(caseId);
  if (s) return s;
  s = create<CaseState>()(persist((set) => ({
    ...initial,
    open: () => set({ opened: true }),
    markRead: (id) => set((st) => (st.read[id] ? st : { read: { ...st.read, [id]: Date.now() } })),
    scan: (id) => set((st) => (st.scanned.includes(id) ? st : { scanned: [...st.scanned, id] })),
    breakSeal: (id) => set((st) => (st.seals.includes(id) ? st : { seals: [...st.seals, id] })),
    move: (id, x, y) => set((st) => ({ positions: { ...st.positions, [id]: { x, y } } })),
    tidy: () => set({ positions: {} }),
    togglePin: (ids, on) => set((st) => ({ pinned: on ? [...new Set([...st.pinned, ...ids])] : st.pinned.filter((p) => !ids.includes(p)) })),
    setNotes: (notes) => set({ notes }),
    addCard: (c) => set((st) => ({ cards: [...st.cards, { ...c, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: Date.now() }] })),
    removeCard: (id) => set((st) => ({ cards: st.cards.filter((c) => c.id !== id) })),
    updateChat: (sid, fn) => set((st) => ({ chats: { ...st.chats, [sid]: fn(st.chats[sid] ?? emptyChat()) } })),
    revealHint: (id) => set((st) => (st.hints.includes(id) ? st : { hints: [...st.hints, id] })),
    addRefusal: (who, text) => set((st) => ({ refusals: [...st.refusals, { who, text }], wrongCharges: st.wrongCharges + 1 })),
    setResult: (result) => set({ result }),
    setZoom: (zoom) => set({ zoom: Math.min(1.6, Math.max(0.8, zoom)) }),
    addHighlight: (h) => {
      const id = `hl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      set((st) => ({ highlights: [...st.highlights, { ...h, id, at: Date.now() }] }));
      return id;
    },
    updateHighlight: (id, patch) => set((st) => ({ highlights: st.highlights.map((h) => (h.id === id ? { ...h, ...patch } : h)) })),
    removeHighlight: (id) => set((st) => ({ highlights: st.highlights.filter((h) => h.id !== id) })),
    updateCard: (id, text) => set((st) => ({ cards: st.cards.map((c) => (c.id === id ? { ...c, text } : c)) })),
    setMode: (mode) => set({ mode }),
    setMark: (docId, hyp, mark) => set((st) => {
      const row = { ...(st.board[docId] ?? {}) };
      if (mark) row[hyp] = mark; else delete row[hyp];
      return { board: { ...st.board, [docId]: row } };
    }),
    setBoardRows: (boardRows) => set({ boardRows }),
    reset: () => set({ ...initial }),
  }), {
    name: `dossiers:case:${caseId}`,
    version: 1,
    storage: createJSONStorage(() => {
      try { localStorage.setItem('dossiers:probe', '1'); return localStorage; } catch { /* blocked */ }
      try { sessionStorage.setItem('dossiers:probe', '1'); return sessionStorage; } catch { /* blocked */ }
      const mem = new Map<string, string>();
      return { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); }, removeItem: (k: string) => { mem.delete(k); } };
    }),
  }));
  stores.set(caseId, s);
  return s;
}

/** Transient UI state (not persisted). */
export const useUI = create<{
  openDoc: string | null; setOpenDoc: (id: string | null) => void;
  focusHighlight: string | null; showHighlight: (docId: string, highlightId: string) => void; clearFocus: () => void;
  toast: string | null; setToast: (t: string | null) => void;
}>((set) => ({
  openDoc: null, setOpenDoc: (openDoc) => set({ openDoc }),
  focusHighlight: null,
  showHighlight: (docId, highlightId) => set({ openDoc: docId, focusHighlight: highlightId }),
  clearFocus: () => set({ focusHighlight: null }),
  toast: null, setToast: (toast) => set({ toast }),
}));

export function isAvailable(d: CaseDocument, st: Pick<CaseState, 'scanned' | 'seals' | 'read'>): boolean {
  if (!d.hidden) return true;
  const u = d.unlockedBy;
  if (!u) return false;
  return Boolean((u.qr && st.scanned.includes(u.qr)) || (u.seal && st.seals.includes(u.seal)) || (u.read && st.read[u.read]));
}

export function availableDocs(c: CaseData, st: Pick<CaseState, 'scanned' | 'seals' | 'read'>) {
  return c.documents.filter((d) => isAvailable(d, st));
}
