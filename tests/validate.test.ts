import { describe, it, expect } from 'vitest';
import { validateCase } from '../shared/validate';
import { loadCase, assetNames } from '../server/caseStore';
import type { CaseData, SecretData } from '../shared/types';

const fresh = () => {
  const { c, s } = loadCase('karalis')!;
  return { c: structuredClone(c) as CaseData, s: structuredClone(s) as SecretData };
};
const errs = (c: CaseData, s: SecretData) => validateCase(c, s, assetNames('karalis')).errors;

describe('validator', () => {
  it('passes the shipped Karalis case', () => {
    const { c, s } = fresh();
    expect(errs(c, s)).toEqual([]);
  });
  it('catches a broken cross reference', () => {
    const { c, s } = fresh();
    s.suspects.aris.lies[0].caughtBy = ['no-such-doc'];
    expect(errs(c, s).join('\n')).toMatch(/unknown document "no-such-doc"/);
  });
  it('catches a timeline fact without a valid source', () => {
    const { c, s } = fresh();
    c.timeline.facts[0].source = 'ghost';
    expect(errs(c, s).join('\n')).toMatch(/fact k-coffee-order source: unknown document "ghost"/);
  });
  it('catches an unused document', () => {
    const { c, s } = fresh();
    delete s.documentRoles['review-brief'];
    expect(errs(c, s).join('\n')).toMatch(/review-brief: not used/);
  });
  it('catches an innocent suspect with no eliminating record', () => {
    const { c, s } = fresh();
    delete s.eliminations.laila;
    expect(errs(c, s).join('\n')).toMatch(/suspect laila: innocent but no record eliminates them/);
  });
  it('catches unreachable hidden documents and missing assets', () => {
    const { c, s } = fresh();
    const d = c.documents.find((x) => x.id === 'vehicle-registry')!;
    d.unlockedBy = { read: 'lab-notebook' };
    c.documents.find((x) => x.id === 'lab-notebook')!.unlockedBy = { read: 'vehicle-registry' };
    c.documents.find((x) => x.id === 'scene-photo')!.body.svg = 'missing.svg';
    const e = errs(c, s).join('\n');
    expect(e).toMatch(/vehicle-registry: unreachable/);
    expect(e).toMatch(/missing asset "missing.svg"/);
  });
  it('rejects em dashes in case content', () => {
    const { c, s } = fresh();
    c.title = 'The Karalis File \u2014 reopened';
    expect(errs(c, s).join('\n')).toMatch(/em dash/);
  });
  it('rejects a wrong answer id', () => {
    const { c, s } = fresh();
    s.answers.how = 'how-nope';
    expect(errs(c, s).join('\n')).toMatch(/answers.how/);
  });
});
