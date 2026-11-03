import { useEffect, useState } from 'react';

export type Screen = 'intro' | 'desk' | 'timeline' | 'interrogate' | 'board' | 'notes' | 'hints' | 'accuse';
export interface Route { caseId: string | null; screen: Screen; param?: string }

// The static prototype holds one case and uses plain hashes (#desk, #interrogate-aris).
export const DEMO = import.meta.env.MODE === 'demo';
const DEMO_CASE = (import.meta.env.VITE_DEMO_CASE as string | undefined) ?? 'karalis';

export function parse(hash: string): Route {
  if (DEMO) {
    const name = hash.replace(/^#/, '');
    if (!name) return { caseId: DEMO_CASE, screen: 'intro' };
    const [screen, ...rest] = name.split('-');
    return { caseId: DEMO_CASE, screen: screen as Screen, param: rest.join('-') || undefined };
  }
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] !== 'case' || !parts[1]) return { caseId: null, screen: 'intro' };
  return { caseId: parts[1], screen: (parts[2] as Screen) ?? 'intro', param: parts[3] };
}

export function hrefFor(caseId: string | null, screen: Screen = 'intro', param?: string): string {
  if (DEMO) return screen === 'intro' && !param ? '#' : `#${screen}${param ? '-' + param : ''}`;
  return caseId ? `#/case/${caseId}/${screen}${param ? '/' + param : ''}` : '#/';
}

export function go(caseId: string | null, screen: Screen = 'intro', param?: string) {
  window.location.hash = hrefFor(caseId, screen, param);
}

export function useRoute(): Route {
  const [r, setR] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const f = () => setR(parse(window.location.hash));
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return r;
}
