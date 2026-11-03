import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { CaseData, SecretData } from '../shared/types';

export const CASES_DIR = resolve(process.env.CASES_DIR ?? join(process.cwd(), 'cases'));

const cache = new Map<string, { c: CaseData; s: SecretData }>();

export function listCaseIds(): string[] {
  return readdirSync(CASES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(CASES_DIR, d.name, 'case.json')))
    .map((d) => d.name);
}

export function safeId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(id);
}

export function loadCase(id: string): { c: CaseData; s: SecretData } | null {
  if (!safeId(id)) return null;
  if (process.env.NODE_ENV === 'production' && cache.has(id)) return cache.get(id)!;
  const dir = join(CASES_DIR, id);
  if (!existsSync(join(dir, 'case.json')) || !existsSync(join(dir, 'secret.json'))) return null;
  const c = JSON.parse(readFileSync(join(dir, 'case.json'), 'utf8')) as CaseData;
  const s = JSON.parse(readFileSync(join(dir, 'secret.json'), 'utf8')) as SecretData;
  cache.set(id, { c, s });
  return { c, s };
}

export function assetNames(id: string): string[] {
  const dir = join(CASES_DIR, id, 'assets');
  return existsSync(dir) ? readdirSync(dir) : [];
}
