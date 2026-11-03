# Progress

1. [x] Engine and schema: shared types, JSON Schemas for case.json and secret.json.
2. [x] Validator: `shared/validate.ts`, CLI `npm run validate-case`, wired into `npm run build`.
3. [x] The Karalis File: 34 documents, 17 timeline facts, 3 suspects, hints, secret truth, SVG assets.
4. [x] Server (Hono): public case API, asset serving (traversal-safe), accuse, give up, interrogation SSE, mock mode.
5. [x] Desk and reader: 14 document renderers in a registry, piles, drag, READ stamps, QR unlocks, wax seal, magnifier.
6. [x] Timeline with collision panel, interrogation UI, notes with CAUGHT cards and transcripts, hints, accusation, scoring.
7. [x] Screenshots at 1280px and 390px reviewed. Fixed: duplicate collision rows (now grouped per statement),
       question chips crowding mobile (now one sideways row), pin chips sorted by time, toast width.
8. [x] Vitest: 26 tests. Found and fixed a leak where a state block without its marker could reach the browser.
9. [x] Playwright: solves the case by clicking on desktop and mobile (wrong charge, then Chief Inspector, 93),
       checks secret.json never reaches the browser, checks give up. 6 of 6 pass.
10. [x] Live AI path checked against a local fake Messages API: streaming, state stripping, server overriding
        false model flags, cache_control and fallbacks sent, outage shows the glass of water. Not yet run against
        the real API (no key in the build environment).
11. [x] Case Forge CLI behind FORGE_ENABLED, with validator repair loop and blind playtest (dry run checked only).
12. [x] README, CLAUDE.md.

13. [x] Highlights and notes: select text in any document to highlight (4 colours) or note it; all marks collected in Notes with search, colour filter, editing and "Show in document". Playwright covers it.

14. [x] Investigation realism: question technique labels, locked-in vs adapted lies (Strategic Use of Evidence), unreliable admissions under pressure, hypothesis board (ACH), investigator profile debrief, detective mode. 32 unit tests, 10 Playwright tests.
15. [x] Raster assets (png, jpg, webp) supported in server and prototype. DESIGN.md with vision and roadmap.

Next ideas: Beirut 1974 or Seoul 1988 case via the Forge; sound (typewriter, wax crack); print-friendly solution memo.
