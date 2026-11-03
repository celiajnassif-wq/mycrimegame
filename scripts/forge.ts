// Case Forge: Claude writes a brand new case. Behind FORGE_ENABLED=1.
// Pipeline: truth first (secret.json) -> documents as views onto it (case.json + SVG assets)
// -> validate and repair in a loop -> hints, memo, epilogue -> blind playtest.
//
//   FORGE_ENABLED=1 npm run forge -- --place "Seoul" --year 1988 [--id seoul-1988] [--rounds 4] [--dry-run]
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { validateCase } from '../shared/validate';
import type { CaseData, SecretData } from '../shared/types';

const args = process.argv.slice(2);
const arg = (name: string, def?: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const flag = (name: string) => args.includes(`--${name}`);

const place = arg('place', 'Beirut')!;
const year = arg('year', '1974')!;
const id = arg('id', `${place}-${year}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'))!;
const rounds = Number(arg('rounds', '4'));
const dryRun = flag('dry-run');
const FORGE_MODEL = process.env.FORGE_MODEL || 'claude-opus-5-5';
const PLAYTEST_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';

if (process.env.FORGE_ENABLED !== '1') {
  console.error('Case Forge is disabled. Set FORGE_ENABLED=1 (and ANTHROPIC_API_KEY) to use it.');
  process.exit(1);
}
if (!dryRun && !process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set. Put it in .env (server side only).');
  process.exit(1);
}

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const caseSchema = read('schema/case.schema.json');
const secretSchema = read('schema/secret.schema.json');
const exampleCase = read('cases/karalis/case.json');
const exampleSecret = read('cases/karalis/secret.json');
const outDir = join(root, 'forge-out', id);
mkdirSync(outDir, { recursive: true });
const log = (...m: unknown[]) => console.log('[forge]', ...m);

const RULES = `House rules:
- Never use em dashes anywhere. Use commas, periods, colons or parentheses.
- Period-appropriate voices and documents; mix in the local language(s) with translations in handwritten documents.
- Ids are lowercase kebab-case. Times are HH:MM (24h).
- No real living people. Real places and institutions may be named only generically; invent organisations.
- The case must be fair: every fact needed to solve it is in the documents.`;

let client: Anthropic | null = null;
async function ask(system: string, user: string, model = FORGE_MODEL, effort: 'low' | 'medium' | 'high' = 'high'): Promise<string> {
  if (dryRun) { log(`(dry run) would call ${model}: system ${system.length} chars, user ${user.length} chars`); return '{}'; }
  client ??= new Anthropic();
  const params = {
    model, max_tokens: 64000, system, messages: [{ role: 'user' as const, content: user }],
    thinking: { type: 'adaptive' as const }, output_config: { effort },
    betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
  };
  const stream = client.beta.messages.stream(params as unknown as Parameters<Anthropic['beta']['messages']['stream']>[0]);
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') throw new Error('The model declined this request.');
  if (msg.stop_reason === 'max_tokens') log('warning: output hit max_tokens, JSON may be truncated');
  return msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
}

function extractJson<T>(text: string): T {
  const fence = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1]);
  const candidates = [...fence.reverse(), text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)];
  for (const c of candidates) { try { return JSON.parse(c) as T; } catch { /* next */ } }
  throw new Error('Model reply did not contain valid JSON');
}

function safeSvg(svg: string): boolean {
  return /^\s*<svg[\s>]/.test(svg) && !/<script|on\w+\s*=|href\s*=\s*["']?(?!#)|<foreignObject/i.test(svg) && svg.length < 200_000;
}

type Assets = Record<string, string>;

async function main() {
  log(`forging "${place} ${year}" as case "${id}" with ${FORGE_MODEL}`);
  const system = `You design fair, rich cold-case detective cases for the game Dossiers. You output strict JSON only.\n${RULES}`;

  // 1. Truth first.
  log('step 1: secret.json (the truth)');
  const s1 = await ask(system, `Write the server-only truth for a new case set in ${place}, around ${year}.
Return one JSON object: {"secret": <secret.json>, "routes": [three objects {"name", "steps": [document ideas]}]}.
Requirements: three suspects (one culprit), a minute-by-minute trueTimeline of at least 15 entries, three independent routes to the culprit (each enough on its own), each innocent suspect has a lie with an innocent, embarrassing reason and is eliminated by at least one record. Document ids you reference will be created in step 2, so list them consistently.
JSON Schema for secret.json:\n${secretSchema}\n\nExample (another case, for format and quality only, do not reuse its plot):\n${exampleSecret}`);
  const step1 = extractJson<{ secret: SecretData; routes: unknown }>(s1);
  let secret = step1.secret;
  writeFileSync(join(outDir, 'routes.json'), JSON.stringify(step1.routes ?? [], null, 2));

  // 2. Documents as views onto the truth.
  log('step 2: case.json and SVG assets');
  const s2 = await ask(system, `Here is the truth of a case:\n${JSON.stringify(secret)}\n
Write the public case.json: about 28 to 34 documents across 4 or 5 groups, using many document kinds (typed, form, carbon, handwritten with translation, newspaper, email, lab, ledger, suspect, floorplan, photo, sealed, handwriting, qr with a hidden unlocked record). Every document id referenced in the truth must exist. Every timeline fact needs a source document. Include hints (5 questions, 3 tiers each) and accusation options containing the correct answers.
Also write the SVG assets that photo, floorplan and handwriting documents reference (simple hand-drawn style, viewBox only, no scripts, no external links). Photos must contain the small details their evidence tags point at.
Return {"case": <case.json>, "assets": {"file.svg": "<svg ...>"}}.
JSON Schema for case.json:\n${caseSchema}\n\nExample (format only):\n${exampleCase}`);
  if (dryRun) { log('dry run complete: prompts build, no API calls made'); return; }
  const step2 = extractJson<{ case: CaseData; assets: Assets }>(s2);
  let kase = step2.case;
  let assets: Assets = step2.assets ?? {};
  kase.id = id;

  // 3. Validate and repair.
  for (let round = 1; ; round++) {
    const names = Object.keys(assets).filter((n) => safeSvg(assets[n]));
    const { errors, warnings } = validateCase(kase, secret, names.length ? names : ['__none__']);
    log(`step 3: validation round ${round}: ${errors.length} errors, ${warnings.length} warnings`);
    if (!errors.length) break;
    writeFileSync(join(outDir, `errors-round-${round}.txt`), errors.join('\n'));
    if (round >= rounds) { save(kase, secret, assets, false); throw new Error(`still invalid after ${rounds} rounds, see ${outDir}`); }
    const fix = await ask(system, `The validator rejected this case. Fix every error with the smallest changes, keep the plot.
Errors:\n${errors.join('\n')}\n\ncase.json:\n${JSON.stringify(kase)}\n\nsecret.json:\n${JSON.stringify(secret)}\n\nAsset file names: ${Object.keys(assets).join(', ')}
Return {"case": ..., "secret": ..., "assets": {only new or changed svg files}}.`);
    const fixed = extractJson<{ case: CaseData; secret: SecretData; assets?: Assets }>(fix);
    kase = { ...fixed.case, id };
    secret = fixed.secret;
    assets = { ...assets, ...(fixed.assets ?? {}) };
  }

  // 4. Hints, memo and epilogue from the finished documents.
  log('step 4: hints, solution memo, epilogue');
  const s4 = await ask(system, `Final documents of a case:\ncase.json:\n${JSON.stringify(kase)}\nsecret.json:\n${JSON.stringify(secret)}
Write tiered hints that point at real document titles, a solution memo that cites documents by title for method, opportunity, means, motive and eliminations, and a 3 to 4 paragraph epilogue.
Return {"hints": <case.json hints array>, "solutionMemo": [...], "epilogue": [...]}.`, FORGE_MODEL, 'medium');
  const step4 = extractJson<{ hints: CaseData['hints']; solutionMemo: string[]; epilogue: string[] }>(s4);
  if (Array.isArray(step4.hints) && step4.hints.length) kase.hints = step4.hints;
  if (Array.isArray(step4.solutionMemo)) secret.solutionMemo = step4.solutionMemo;
  if (Array.isArray(step4.epilogue)) secret.epilogue = step4.epilogue;
  const final = validateCase(kase, secret, Object.keys(assets));
  if (final.errors.length) { save(kase, secret, assets, false); throw new Error(`step 4 broke validation:\n${final.errors.join('\n')}`); }

  // 5. Blind playtest: a second model sees only public data.
  log(`step 5: blind playtest with ${PLAYTEST_MODEL}`);
  const report = await playtest(kase, secret);
  writeFileSync(join(outDir, 'playtest.json'), JSON.stringify(report, null, 2));
  log(`playtest: ${report.verdict}`);
  save(kase, secret, assets, true);
}

async function playtest(kase: CaseData, secret: SecretData) {
  const sys = 'You are a sharp amateur detective playing a document-based cold-case game. Reason only from the documents given. Answer in JSON.';
  const q = (docs: CaseData['documents']) => `Case: ${kase.title}, ${kase.place}, ${kase.date}.\nVictim: ${JSON.stringify(kase.victim)}\nSuspects: ${JSON.stringify(kase.suspects.map(({ id, name, role, sheet }) => ({ id, name, role, sheet })))}\nDocuments:\n${JSON.stringify(docs.map(({ id, title, kind, body, date }) => ({ id, title, kind, date, body })))}
Name the culprit. Return {"culprit": suspect id, "confidence": 0 to 1, "keyDocuments": [ids], "reasoning": "short"}.`;
  const full = extractJson<{ culprit: string; confidence: number; keyDocuments: string[]; reasoning: string }>(await ask(sys, q(kase.documents), PLAYTEST_MODEL, 'medium'));
  // shallow: only statements, suspect sheets and the first group, no recovered records
  const shallowDocs = kase.documents.filter((d) => d.kind === 'carbon' || d.kind === 'suspect' || d.group === kase.groups[0].id);
  const shallow = extractJson<{ culprit: string; confidence: number }>(await ask(sys, q(shallowDocs), PLAYTEST_MODEL, 'low'));
  const solvable = full.culprit === secret.culprit;
  const tooEasy = shallow.culprit === secret.culprit && shallow.confidence >= 0.7;
  const verdict = !solvable ? 'FAIL: the blind playtester could not name the culprit from the full desk'
    : tooEasy ? 'WARN: too easy, the culprit is guessable with confidence from statements alone'
    : 'PASS: solvable from the records, not from the statements alone';
  return { verdict, full, shallow: { ...shallow, documents: shallowDocs.length } };
}

function save(kase: CaseData, secret: SecretData, assets: Assets, toCases: boolean) {
  const dir = toCases ? join(root, 'cases', id) : outDir;
  if (toCases && existsSync(join(dir, 'case.json')) && !flag('force')) { log(`cases/${id} exists, writing to ${outDir} instead (use --force)`); return save(kase, secret, assets, false); }
  mkdirSync(join(dir, 'assets'), { recursive: true });
  writeFileSync(join(dir, 'case.json'), JSON.stringify(kase, null, 2) + '\n');
  writeFileSync(join(dir, 'secret.json'), JSON.stringify(secret, null, 2) + '\n');
  for (const [name, svg] of Object.entries(assets)) {
    if (/^[a-zA-Z0-9_.-]+\.svg$/.test(name) && safeSvg(svg)) writeFileSync(join(dir, 'assets', name), svg);
    else log(`skipped unsafe asset ${name}`);
  }
  log(`wrote ${dir}`);
}

main().catch((e) => { console.error('[forge] failed:', e.message); process.exit(1); });
