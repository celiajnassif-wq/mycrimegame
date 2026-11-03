# Dossiers: working rules

Cold-case detective game. Vite + TypeScript + React (plain CSS, Zustand) in `src/`, a Hono server in `server/`,
shared pure logic in `shared/`, case data in `cases/`.

## Hard rules
- Never use em dashes anywhere (code, comments, UI text, case content, docs). Use commas, periods, colons or parentheses.
  The validator rejects them in case files.
- Case content stays out of engine code. A new case must need zero engine changes.
- `secret.json` is server-only. The browser never receives it, except the solution memo after a charge is filed
  correctly or the player gives up. The Anthropic key lives only in `.env` on the server.
- Never trust the model for game state. Lies caught and confessions are decided by `shared/interrogation.ts`
  from `secret.json` rules; model flags are only accepted when they agree.
- Keep the layout working at 390px wide: no horizontal scroll, 16px side gutters, visible focus, keyboard access.

## Commands
- `npm run dev`: server (port 8787, `tsx watch`) plus Vite (5173, proxies `/api` and `/case-assets`).
- `npm run build`: validates every case, type-checks, builds `dist/`. Fails on case errors.
- `npm start`: production server, serves `dist/` and the API.
- `npm run validate-case <id>` (or `--all`).
- `npm test`: Vitest (scoring, timeline, validator, interrogation rules, stream parser).
- `npm run e2e`: builds, then Playwright solves the case on desktop and mobile with `MOCK_AI=1`.
- `npm run forge -- --place "Seoul" --year 1988` (needs `FORGE_ENABLED=1` and a key).

## Case format
`cases/<id>/case.json` (public, schema `schema/case.schema.json`):
- `id, title, subtitle, place, date, reopened, intro, groups[], documents[], timeline, suspects[], hints[], accusation`.
- Document: `{ id, kind, title, group, date?, rotate?, hidden?, unlockedBy?, body }`. `kind` picks a renderer in
  `src/docs/registry.tsx` (one file per kind in `src/docs/kinds/`). `unlockedBy` is `{ qr }`, `{ seal }` or `{ read }`.
- Timeline facts: `{ id, lane, kind: record|statement|absence|window|moment, start, end?, label, place?, source,
  conflictsWith? }`. A statement and a record collide when they share a lane, overlap in time and name different
  places, or when `conflictsWith` links them.
- Suspects: public sheet plus `portrait` features (procedural SVG) and `questions[]` (chips, `unlockedBy` a doc id).

`cases/<id>/secret.json` (server only, schema `schema/secret.schema.json`):
- `culprit, method, motive, answers {how, why}, proofDocuments[], trueTimeline[], documentRoles{}, eliminations{},
  suspects{ persona, knows, hides, lies[{id, claim, truth, caughtBy[], pointed[][], reaction}], breakdown?,
  confession?, mock{} }, refusalTemplate, epilogue, solutionMemo[]`.

`cases/<id>/assets/`: SVG, PNG, JPG or WebP (no external images). Served at `/case-assets/<id>/<file>`.

## Validator checks (`shared/validate.ts`)
Schema, every cross reference, every timeline fact sourced, every document used (proof, elimination, lie catcher,
timeline source, unlock key, or a declared red herring/context role), every innocent suspect eliminated by at least
one record, unlock graph reachable, correct answers present in options, no em dashes.
