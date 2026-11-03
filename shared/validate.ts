// Case validator: pure function, used by the CLI, the build and the tests.
import Ajv from 'ajv';
import caseSchema from '../schema/case.schema.json';
import secretSchema from '../schema/secret.schema.json';
import type { CaseData, SecretData } from './types';
import { toMinutes } from './timeline';

export interface ValidationResult { errors: string[]; warnings: string[] }

const EM_DASH = '\u2014';

function findEmDashes(value: unknown, path: string, out: string[]) {
  if (typeof value === 'string') {
    if (value.includes(EM_DASH)) out.push(`${path}: contains an em dash ("${value.slice(0, 50)}...")`);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => findEmDashes(v, `${path}[${i}]`, out));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) findEmDashes(v, `${path}.${k}`, out);
  }
}

export function validateCase(c: CaseData, s: SecretData, assetNames?: string[]): ValidationResult {
  const checkAssets = Array.isArray(assetNames);
  const hasAsset = (f: string) => !checkAssets || assetNames!.includes(f);
  const errors: string[] = [];
  const warnings: string[] = [];
  const ajv = new Ajv({ allErrors: true, strict: false });
  const vc = ajv.compile(caseSchema);
  const vs = ajv.compile(secretSchema);
  if (!vc(c)) for (const e of vc.errors ?? []) errors.push(`case.json${e.instancePath} ${e.message}`);
  if (!vs(s)) for (const e of vs.errors ?? []) errors.push(`secret.json${e.instancePath} ${e.message}`);
  if (errors.length) return { errors, warnings }; // structural errors first, cross checks need shape

  findEmDashes(c, 'case', errors);
  findEmDashes(s, 'secret', errors);

  const dup = (ids: string[], what: string) => {
    const seen = new Set<string>();
    for (const id of ids) { if (seen.has(id)) errors.push(`duplicate ${what} id "${id}"`); seen.add(id); }
  };
  const docIds = new Set(c.documents.map((d) => d.id));
  const suspectIds = new Set(c.suspects.map((x) => x.id));
  const groupIds = new Set(c.groups.map((g) => g.id));
  const laneIds = new Set(c.timeline.lanes.map((l) => l.id));
  const factIds = new Set(c.timeline.facts.map((f) => f.id));
  dup(c.documents.map((d) => d.id), 'document');
  dup(c.suspects.map((x) => x.id), 'suspect');
  dup(c.timeline.facts.map((f) => f.id), 'fact');
  dup(c.hints.flatMap((h) => h.hints.map((x) => x.id)), 'hint');
  const docRef = (id: string | undefined, where: string) => {
    if (id !== undefined && !docIds.has(id)) errors.push(`${where}: unknown document "${id}"`);
  };
  const byId = new Map(c.documents.map((d) => [d.id, d]));

  // documents
  for (const d of c.documents) {
    if (!groupIds.has(d.group)) errors.push(`document ${d.id}: unknown group "${d.group}"`);
    if (d.unlockedBy) {
      const u = d.unlockedBy;
      docRef(u.qr, `document ${d.id} unlockedBy.qr`);
      docRef(u.seal, `document ${d.id} unlockedBy.seal`);
      docRef(u.read, `document ${d.id} unlockedBy.read`);
      if (u.qr && byId.get(u.qr)?.kind !== 'qr') errors.push(`document ${d.id}: unlockedBy.qr "${u.qr}" is not a qr document`);
      if (u.seal && byId.get(u.seal)?.kind !== 'sealed') errors.push(`document ${d.id}: unlockedBy.seal "${u.seal}" is not a sealed document`);
      if (!d.hidden) warnings.push(`document ${d.id}: has unlockedBy but is not hidden`);
    }
    if (d.hidden && !d.unlockedBy) errors.push(`document ${d.id}: hidden but has no unlockedBy rule, it can never appear`);
    if (typeof d.body.signatureSvg === 'string' && !hasAsset(d.body.signatureSvg)) errors.push(`document ${d.id}: missing asset "${d.body.signatureSvg}"`);
    if (d.kind === 'qr') {
      docRef(d.body.unlocks, `qr ${d.id} body.unlocks`);
      const target = byId.get(d.body.unlocks);
      if (target && target.unlockedBy?.qr !== d.id) errors.push(`qr ${d.id}: target "${d.body.unlocks}" is not unlockedBy this qr`);
    }
    if (d.kind === 'suspect' && !suspectIds.has(d.body.suspectId)) errors.push(`document ${d.id}: unknown suspect "${d.body.suspectId}"`);
    for (const key of ['svg']) {
      const f = d.body[key];
      if (typeof f === 'string' && !hasAsset(f)) errors.push(`document ${d.id}: missing asset "${f}"`);
    }
    if (d.kind === 'handwriting') {
      for (const row of d.body.rows as { cells: { svg?: string }[] }[]) {
        for (const cell of row.cells) if (cell.svg && !hasAsset(cell.svg)) errors.push(`document ${d.id}: missing asset "${cell.svg}"`);
      }
    }
  }

  // unlock reachability: every hidden doc must be reachable from the visible set
  const visible = new Set(c.documents.filter((d) => !d.hidden).map((d) => d.id));
  let grew = true;
  while (grew) {
    grew = false;
    for (const d of c.documents) {
      if (visible.has(d.id) || !d.unlockedBy) continue;
      const key = d.unlockedBy.qr ?? d.unlockedBy.seal ?? d.unlockedBy.read;
      if (key && visible.has(key)) { visible.add(d.id); grew = true; }
    }
  }
  for (const d of c.documents) if (!visible.has(d.id)) errors.push(`document ${d.id}: unreachable (unlock chain never starts from a visible document)`);

  // timeline
  const tl = c.timeline;
  for (const l of tl.lanes) if (l.suspectId && !suspectIds.has(l.suspectId)) errors.push(`lane ${l.id}: unknown suspect "${l.suspectId}"`);
  for (const f of tl.facts) {
    if (!laneIds.has(f.lane)) errors.push(`fact ${f.id}: unknown lane "${f.lane}"`);
    if (!f.source) errors.push(`fact ${f.id}: has no source document`);
    docRef(f.source, `fact ${f.id} source`);
    if (f.end && toMinutes(f.end) < toMinutes(f.start)) errors.push(`fact ${f.id}: ends before it starts`);
    if (toMinutes(f.start) < toMinutes(tl.start) || toMinutes(f.end ?? f.start) > toMinutes(tl.end)) errors.push(`fact ${f.id}: outside the timeline window ${tl.start} to ${tl.end}`);
    if ((f.kind === 'window' || f.kind === 'absence' || f.kind === 'record' || f.kind === 'statement') && !f.end) warnings.push(`fact ${f.id}: ${f.kind} without end time renders as a moment`);
    for (const x of f.conflictsWith ?? []) if (!factIds.has(x)) errors.push(`fact ${f.id}: conflictsWith unknown fact "${x}"`);
  }

  // suspects
  for (const x of c.suspects) {
    for (const q of x.questions) docRef(q.unlockedBy, `suspect ${x.id} question ${q.id}`);
    if (x.portraitAsset && !hasAsset(x.portraitAsset)) errors.push(`suspect ${x.id}: missing portrait asset "${x.portraitAsset}"`);
    if (!s.suspects[x.id]) errors.push(`suspect ${x.id}: no entry in secret.json suspects`);
  }
  for (const id of Object.keys(s.suspects)) if (!suspectIds.has(id)) errors.push(`secret suspect "${id}" is not in case.json`);

  // secret cross refs
  if (!suspectIds.has(s.culprit)) errors.push(`secret.culprit "${s.culprit}" is not a suspect`);
  if (!c.accusation.how.some((o) => o.id === s.answers.how)) errors.push(`secret.answers.how "${s.answers.how}" is not an accusation option`);
  if (!c.accusation.why.some((o) => o.id === s.answers.why)) errors.push(`secret.answers.why "${s.answers.why}" is not an accusation option`);
  if (s.proofDocuments.length < c.accusation.proofCount) errors.push(`secret.proofDocuments needs at least ${c.accusation.proofCount} documents`);
  s.proofDocuments.forEach((d) => docRef(d, 'secret.proofDocuments'));
  for (const id of Object.keys(s.documentRoles)) docRef(id, 'secret.documentRoles');
  for (const [sid, e] of Object.entries(s.eliminations)) {
    if (!suspectIds.has(sid)) errors.push(`secret.eliminations: unknown suspect "${sid}"`);
    if (sid === s.culprit) errors.push(`secret.eliminations: the culprit "${sid}" cannot be eliminated`);
    e.documents.forEach((d) => docRef(d, `secret.eliminations.${sid}`));
  }
  for (const x of c.suspects) {
    if (x.id !== s.culprit && !(s.eliminations[x.id]?.documents.length)) errors.push(`suspect ${x.id}: innocent but no record eliminates them`);
  }
  const allLieIds: string[] = [];
  for (const [sid, ss] of Object.entries(s.suspects)) {
    for (const lie of ss.lies) {
      allLieIds.push(lie.id);
      lie.caughtBy.forEach((d) => docRef(d, `lie ${lie.id} caughtBy`));
    }
    ss.breakdown?.requiredShown.forEach((d) => docRef(d, `suspect ${sid} breakdown`));
    if (sid === s.culprit && !ss.breakdown) errors.push(`culprit ${sid}: needs breakdown conditions`);
    if (sid === s.culprit && !ss.confession) errors.push(`culprit ${sid}: needs a confession`);
    if (sid !== s.culprit && ss.breakdown) errors.push(`suspect ${sid}: innocent suspects must not have breakdown conditions`);
    if (sid !== s.culprit && !ss.innocentExplanation) warnings.push(`suspect ${sid}: no innocentExplanation`);
    if (ss.breakdown && ss.breakdown.minLiesCaught > ss.lies.length) errors.push(`suspect ${sid}: breakdown needs more lies than exist`);
  }
  dup(allLieIds, 'lie');

  // every document is used
  const used = new Map<string, string>();
  const mark = (id: string | undefined, why: string) => { if (id && !used.has(id)) used.set(id, why); };
  s.proofDocuments.forEach((d) => mark(d, 'proof'));
  Object.values(s.eliminations).forEach((e) => e.documents.forEach((d) => mark(d, 'elimination')));
  Object.values(s.suspects).forEach((ss) => ss.lies.forEach((l) => l.caughtBy.forEach((d) => mark(d, 'catches a lie'))));
  tl.facts.forEach((f) => mark(f.source, 'timeline source'));
  c.documents.forEach((d) => { if (d.unlockedBy) { mark(d.unlockedBy.qr, 'unlock key'); mark(d.unlockedBy.seal, 'unlock key'); mark(d.unlockedBy.read, 'unlock key'); } });
  Object.entries(s.documentRoles).forEach(([id, r]) => mark(id, r.role));
  for (const d of c.documents) if (!used.has(d.id)) errors.push(`document ${d.id}: not used for anything (proof, elimination, lie, timeline, unlock or a declared role)`);

  // hints
  for (const h of c.hints) {
    const tiers = h.hints.map((x) => x.tier);
    if (tiers.join() !== [...tiers].sort((a, b) => a - b).join()) warnings.push(`hint question ${h.id}: tiers not ascending`);
  }

  // timeline should contain at least one collision so the board has something to show
  if (!tl.facts.some((f) => f.kind === 'statement')) warnings.push('timeline has no statements, nothing can collide');

  return { errors, warnings };
}
