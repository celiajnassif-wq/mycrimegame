# Dossiers: design vision

**One line:** the cold-case game a working detective would respect. The puzzle is the paperwork, the people and
the investigator's own mind.

## Pillars

1. **The record is the truth.** Every fact needed to solve a case sits in a document a real investigator could hold:
   registers, day-books, carbon copies, lab sheets, photographs. Nothing is solved by a cutscene.
2. **People lie for reasons, and most liars are innocent.** Every suspect hides something. Only one hides a killing.
   Telling an embarrassing secret apart from guilt is the core skill.
3. **Technique matters, like it does in real interviews.** The game rewards what research says works and punishes
   what produces wrongful convictions.
4. **Fair play.** The solution is never decided by the model. A server-side rules engine decides when a lie breaks and
   when a culprit confesses, so the case can be solved by reasoning, every time.
5. **Atmosphere through authenticity.** Period typefaces, languages with translations, real units and procedures,
   real places treated respectfully, fictional people.

## Built

| Mechanic | Grounded in | How it plays |
| --- | --- | --- |
| Desk of period records, piles, READ stamps, sealed letters, QR-digitised archives | Archival investigation | Read, unlock, cross-reference |
| Timeline with claims against records | Alibi analysis | Pin facts; collisions flagged (Investigator mode) |
| AI interviews in each suspect's voice | PEACE model, cognitive interview | Free text; questions labelled open, closed, leading or pressure |
| Locked-in versus adapted lies | Strategic Use of Evidence (Hartwig, Granhag et al., 2006) | Let the witness commit to a lie before you show the record |
| Unreliable admissions under pressure | Kassin and Gudjonsson on false confessions (2004) | Bully an innocent witness and they "admit" things that are not true |
| Hypothesis board | Analysis of Competing Hypotheses (Heuer, 1999) | Rate records against theories; fewest inconsistencies wins; non-diagnostic rows flagged |
| Investigator profile after the verdict | Tunnel vision (Rossmo, 2009), anchoring (Tversky and Kahneman, 1974), confirmation bias | Six findings on how you worked; never changes the score |
| Detective mode | | No suggested questions, no flagged contradictions, no hints |
| Highlights and notes | | Mark any passage; everything collected and searchable |
| Case Forge | | Claude writes new cases truth-first, validated and blind-playtested |

## Inspirations (mechanics and mood, never content)

Procedural realism from Simenon's Maigret (the milieu explains the crime) and from police interview training.
Fair-play construction from Golden Age detective fiction. The paper-trail obsession of journalism-driven true-crime
films. Deduction-by-verified-facts and database-search games, as a genre. The game recreates none of them.

## Roadmap, in the order I would build it

1. **Real imagery.** The engine now serves PNG, JPG and WebP assets as well as SVG (server and prototype). Next: a
   photograph pipeline. Options: (a) public-domain archival photographs of the real city and period for streets and
   buildings, with evidence details added; (b) commissioned or AI-generated period photographs of the fictional
   people and rooms, kept consistent across documents. Rule: never real victims, never real crime-scene photographs.
2. **Lab requests and a case clock.** The review board sits in ten working days. Interviews, archive searches and
   forensic tests each cost time; results arrive later as new documents. Investigation becomes triage.
3. **Witness contamination.** If you feed a witness a detail, they may repeat it later as their own memory, and the
   transcript flags it (Loftus, misinformation effect). Testimony quality becomes something you can damage.
4. **Cross-examination.** Before the charge is accepted, defence counsel (AI) attacks each proof document: chain of
   custody, alternative explanations. You answer from the record.
5. **Game night co-op.** One shared case room, roles (interviewer, analyst, archivist), shared board and notes.
6. **Voices.** Each suspect read aloud in a distinct voice, with the transcript still the record.
7. **More worlds.** Beirut 1974, Seoul 1988, Cadiz 1912: each a new tradition of paperwork and a new language mix.
