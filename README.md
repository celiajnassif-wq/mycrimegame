# Dossiers

A cold-case detective game for one player or a game night. Read a desk of period documents, question
AI-driven suspects in free text, pin claims against records on a timeline, then file a charge: who, how,
why, and three records that prove it.

The first case, **The Karalis File** (Alexandria, 10 January 1952, reopened 2024), ships with 34 documents,
three suspects, a 17-fact timeline and tiered hints.

## Run it

```bash
npm install
cp .env.example .env    # then edit it, see below
npm run dev             # server on :8787, game on http://localhost:5173
```

With no key, or with `MOCK_AI=1`, suspects answer from scripted replies built from `secret.json`, so the whole game
(lies caught, confession) works offline.

| Command | What it does |
| --- | --- |
| `npm run dev` | Server (tsx watch) plus Vite dev server |
| `npm run build` | Validates every case, type-checks, builds `dist/`. Fails on case errors |
| `npm start` | Production server: API plus the built game on one port |
| `npm run validate-case karalis` | Validate one case (`--all` for every case) |
| `npm test` | Vitest: scoring, timeline, validator, interrogation rules, stream stripping |
| `npm run e2e` | Builds, then Playwright solves the case by clicking at 1280px and 390px |
| `npm run forge -- --place Seoul --year 1988` | Optional Case Forge (needs `FORGE_ENABLED=1`) |

## Setting ANTHROPIC_API_KEY

The key is only ever read by the Node server. The browser talks to `/api/interrogate`, never to Anthropic.

```bash
# .env (never commit it, it is in .gitignore)
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-5-5   # optional, this is the default
MOCK_AI=0
```

Interrogations stream over server-sent events. The static persona prompt is cached (prompt caching), the per-turn
state goes after the cache breakpoint, old turns are condensed after 16 messages, and each browser session is rate
limited (`RATE_PER_MINUTE`, default 12; `RATE_PER_DAY`, default 400). If the API fails, the suspect asks for a glass
of water and the player can retry. Requests use the API's server-side fallback, so a refused turn is retried on
another model; set `AI_FALLBACKS=0` to turn that off.

**Fair play, enforced on the server.** The model ends each reply with a hidden state line, which the server strips
before it reaches the browser. Which lies are caught, and whether the culprit may confess, is computed in
`shared/interrogation.ts` from `secret.json`: a lie breaks when the player shows a document in its `caughtBy` list
or asks a pointed question (every keyword group in `pointed` matches). The culprit can confess only when
`breakdown` is met (for Karalis: three lies caught and the toxicology report or the sealed letter shown). The
model's own flags are ignored where they disagree.

## Adding a new case

A case is data only. No engine changes.

1. Create `cases/<id>/` with `case.json`, `secret.json` and `assets/` (SVG files). Copy `cases/karalis` as a template.
2. `case.json` is public: documents, groups, timeline facts, suspects' public sheets, question chips, hints and
   accusation options. Schema: `schema/case.schema.json`.
3. `secret.json` is server only: culprit, answers, proof documents, a minute-by-minute true timeline, what each
   suspect knows, does not know, hides and lies about (with `caughtBy`, `pointed`, `reaction`), breakdown and
   confession for the culprit, eliminations with in-world refusals, epilogue and solution memo.
   Schema: `schema/secret.schema.json`.
4. Run `npm run validate-case <id>`. It checks that every cross reference resolves, every timeline fact has a
   source, every document is used (proof, elimination, lie catcher, timeline source, unlock key, or a declared
   red herring or context role), every innocent suspect is cleared by a record, hidden documents are reachable,
   the correct answers are among the options, and that no em dashes appear.
5. The case appears on the home screen automatically.

Document kinds (`kind`): `typed`, `form`, `carbon`, `handwritten` (with `lang` and a translation toggle; Arabic
uses Aref Ruqaa, Korean Nanum Pen Script), `newspaper`, `email`, `lab`, `ledger`, `suspect`, `floorplan`, `photo`
(draggable magnifier, numbered tags, back of print), `sealed` (break the wax to read), `handwriting` (enlarged
letters side by side) and `qr` (scanning unlocks a hidden record). Hidden documents use
`"hidden": true` with `"unlockedBy": { "qr" | "seal" | "read": "<doc id>" }`.

To add a new kind, write one component in `src/docs/kinds/`, register it in `src/docs/registry.tsx`, and add the
name to the `kind` enum in the case schema.

Portraits are drawn procedurally from `portrait` features (seed, skin, hair, style, glasses, beard, coat), or use
`portraitAsset` for a hand-drawn SVG.

### Case Forge (optional)

`FORGE_ENABLED=1 npm run forge -- --place Beirut --year 1974` asks Claude (`FORGE_MODEL`, default
`claude-opus-5-5`) to write the truth first (with three independent routes to the culprit), then the documents
and SVGs as views onto it, then loops validator errors back until the case passes (`--rounds`, default 4), then
writes hints, memo and epilogue. Finally a blind playtest model sees only `case.json` and tries to name the
culprit twice: once with the full desk (it must succeed) and once with only statements and the police file
(it should not succeed with confidence, or the case is too easy). Results go to `forge-out/<id>/` and, when valid,
to `cases/<id>/`. Use `--dry-run` to check the prompts without calling the API. Always play a forged case before
sharing it.

## Deploying

### Render (easiest, free tier)

1. Sign in at render.com with your GitHub account.
2. New, then Blueprint, then pick this repository. Render reads `render.yaml`.
3. When asked, paste your `ANTHROPIC_API_KEY` (from console.anthropic.com). It stays in Render's settings, never in the repo.
4. Wait for the build, then open the address Render gives you. Free instances sleep when idle, so the first visit
   after a while takes about a minute to wake up.

Without a key the game still works, with scripted suspects (mock mode).

### Anywhere else

It is one Node process. Any host that runs Node 20+ works (Render, Railway, Fly.io, a VPS).

```bash
npm ci
npm run build
NODE_ENV=production PORT=8080 ANTHROPIC_API_KEY=... npm start
```

- Set `ANTHROPIC_API_KEY` (and optionally `CLAUDE_MODEL`, `RATE_PER_MINUTE`, `RATE_PER_DAY`) as host secrets,
  never in the client bundle.
- `npm start` serves `dist/` and the API on the same port, so there is no CORS setup.
- The rate limiter is in memory. If you run several instances, put a shared limiter (for example at the proxy)
  in front.
- Player progress lives in each browser's localStorage, one key per case (`dossiers:case:<id>`).

## Layout

```
cases/<id>/        case.json, secret.json, assets/
schema/            JSON Schemas
shared/            types, scoring, timeline collisions, interrogation rules, validator (pure, tested)
server/            Hono app: case API, asset serving, interrogate (SSE), accuse, give up, mock replies
src/               React app: screens/, docs/ (renderer registry), store.ts (Zustand, persisted per case)
scripts/           validate-case CLI, Case Forge
tests/, e2e/       Vitest and Playwright
```
