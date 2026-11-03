import { listCaseIds, loadCase, assetNames } from '../server/caseStore';
import { validateCase } from '../shared/validate';

const args = process.argv.slice(2);
const ids = args.includes('--all') || args.length === 0 ? listCaseIds() : args.filter((a) => !a.startsWith('--'));
let failed = 0;
for (const id of ids) {
  const loaded = loadCase(id);
  if (!loaded) { console.error(`x ${id}: case.json or secret.json missing`); failed++; continue; }
  const { errors, warnings } = validateCase(loaded.c, loaded.s, assetNames(id));
  for (const w of warnings) console.warn(`  warn  ${id}: ${w}`);
  for (const e of errors) console.error(`  error ${id}: ${e}`);
  if (errors.length) { failed++; console.error(`x ${id}: ${errors.length} error(s)`); }
  else console.log(`ok ${id}: ${loaded.c.documents.length} documents, ${loaded.c.timeline.facts.length} timeline facts, ${loaded.c.suspects.length} suspects`);
}
process.exit(failed ? 1 : 0);
