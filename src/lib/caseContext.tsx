import { createContext, useContext } from 'react';
import type { CaseData } from '../../shared/types';
import { caseStore, type CaseState } from '../store';

export const CaseCtx = createContext<CaseData | null>(null);

export function useKase(): CaseData {
  const k = useContext(CaseCtx);
  if (!k) throw new Error('no case');
  return k;
}

/** Select from the current case's persisted store. */
export function useCS<T>(sel: (s: CaseState) => T): T {
  const k = useKase();
  return caseStore(k.id)(sel);
}

export function useCaseApi(): CaseState {
  const k = useKase();
  return caseStore(k.id).getState();
}
