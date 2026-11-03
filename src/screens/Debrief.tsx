// After the verdict: how the player investigated, read against research on investigative failure.
import { useKase, useCS } from '../lib/caseContext';
import { availableDocs, type Result } from '../store';
import { hypotheses } from './Board';

type Verdict = 'good' | 'mixed' | 'watch';
interface Finding { title: string; verdict: Verdict; text: string; source: string }

export default function Debrief({ result }: { result: Extract<Result, { outcome: 'solved' }> }) {
  const kase = useKase();
  const st = useCS((s) => s);
  const findings: Finding[] = [];
  const turns = Object.entries(st.chats).flatMap(([sid, c]) => c.turns.map((t) => ({ ...t, sid })));
  const asked = turns.filter((t) => t.role === 'player');
  const catches = turns.filter((t) => t.caught?.length).flatMap((t) => t.caught!.map((id) => t.quality?.[id] ?? 'adapted'));
  const locked = catches.filter((q) => q === 'locked').length;
  const coercive = asked.filter((t) => t.technique === 'coercive').length;
  const leading = asked.filter((t) => t.technique === 'leading').length;
  const open = asked.filter((t) => t.technique === 'open').length;
  const unreliable = turns.filter((t) => t.unreliable).length;

  // 1. Strategic use of evidence
  if (catches.length) {
    findings.push({
      title: 'Timing of evidence',
      verdict: locked >= Math.ceil(catches.length / 2) ? 'good' : locked ? 'mixed' : 'watch',
      text: `${locked} of ${catches.length} lies were locked in: the witness had told the lie on record before you showed the record that broke it. ${locked < catches.length ? 'When you lead with the document, a liar gets the chance to build a story around it.' : 'They had nowhere to go.'}`,
      source: 'Strategic Use of Evidence (Hartwig, Granhag, Stromwall and Kronkvist, 2006)',
    });
  }
  // 2. Pressure
  if (asked.length) {
    findings.push({
      title: 'Questioning style',
      verdict: unreliable ? 'watch' : coercive ? 'mixed' : 'good',
      text: unreliable
        ? `You pushed a witness into ${unreliable} unreliable admission${unreliable > 1 ? 's' : ''}. Pressure produced compliance, not truth.`
        : coercive
          ? `${coercive} of your ${asked.length} questions were threats or accusations. Witnesses gave you less after each one.`
          : `No pressure tactics in ${asked.length} questions${open ? `, and ${open} open questions that let witnesses commit to their own accounts` : ''}.${leading ? ` ${leading} leading question${leading > 1 ? 's' : ''} put words in a witness's mouth.` : ''}`,
      source: 'PEACE interviewing (England and Wales, 1992); Kassin and Gudjonsson on false confessions (2004)',
    });
  }
  // 3. Tunnel vision
  const perSuspect = kase.suspects.map((s) => ({ s, n: asked.filter((t) => t.sid === s.id).length }));
  const interviewed = perSuspect.filter((x) => x.n > 0).length;
  const top = [...perSuspect].sort((a, b) => b.n - a.n)[0];
  findings.push({
    title: 'Tunnel vision',
    verdict: st.wrongCharges ? 'watch' : interviewed === kase.suspects.length ? 'good' : 'mixed',
    text: [
      interviewed === kase.suspects.length ? `You questioned all ${kase.suspects.length} witnesses.` : `You questioned ${interviewed} of ${kase.suspects.length} witnesses${top?.n ? `, ${Math.round((top.n / Math.max(1, asked.length)) * 100)}% of the time ${top.s.name}` : ''}.`,
      st.wrongCharges ? `You charged the wrong person ${st.wrongCharges} time${st.wrongCharges > 1 ? 's' : ''} before reading what cleared them. Fixing on a suspect early is the most common cause of wrongful convictions.` : 'You did not charge anyone until the records pointed at them.',
    ].join(' '),
    source: 'D. Kim Rossmo, Criminal Investigative Failures (2009)',
  });
  // 4. Anchoring on the 1952 verdict
  const how = result.charge?.how;
  findings.push({
    title: 'Anchoring',
    verdict: result.correct.how ? 'good' : 'watch',
    text: result.correct.how
      ? 'The file arrived labelled ACCIDENT. You re-tested the method instead of inheriting it.'
      : `The 1952 file said accident and your charge ${how ? `named "${kase.accusation.how.find((o) => o.id === how)?.label}"` : 'got the method wrong'}. The first explanation you are handed weighs more than it should.`,
    source: 'Tversky and Kahneman, judgement under uncertainty (1974)',
  });
  // 5. Disconfirming evidence on the board
  const hyps = hypotheses(kase);
  const rated = Object.values(st.board).filter((r) => Object.keys(r).length).length;
  const against = Object.values(st.board).reduce((n, r) => n + Object.values(r).filter((v) => v === 'I').length, 0);
  const accusedAgainstChecked = Object.values(st.board).some((r) => r[result.charge?.who ?? ''] !== undefined);
  findings.push({
    title: 'Looking for what disproves you',
    verdict: rated >= 5 && against >= hyps.length ? 'good' : rated ? 'mixed' : 'watch',
    text: rated
      ? `You rated ${rated} records on the hypothesis board and marked ${against} inconsistencies.${accusedAgainstChecked ? '' : ' You never tested your own suspect against the board.'}`
      : 'You never used the hypothesis board. Confirmation bias is easiest to beat by writing down what would prove you wrong.',
    source: 'R. J. Heuer, Psychology of Intelligence Analysis (1999)',
  });
  // 6. Thoroughness
  const docs = availableDocs(kase, st);
  const hiddenFound = docs.filter((d) => d.hidden).length;
  const hiddenTotal = kase.documents.filter((d) => d.hidden).length;
  const readN = docs.filter((d) => st.read[d.id]).length;
  findings.push({
    title: 'Paperwork',
    verdict: readN >= kase.documents.length * 0.8 && hiddenFound === hiddenTotal ? 'good' : readN >= kase.documents.length * 0.5 ? 'mixed' : 'watch',
    text: `You read ${readN} of ${kase.documents.length} records and found ${hiddenFound} of ${hiddenTotal} hidden ones. ${result.correct.proof.length}/3 of your proof documents would hold up before a review board.`,
    source: 'Case files win cases: the record outlives every witness',
  });

  const VERD: Record<Verdict, string> = { good: 'Strong', mixed: 'Mixed', watch: 'Watch this' };
  return (
    <section className="debrief" aria-labelledby="debrief-h">
      <h2 id="debrief-h">Investigator profile</h2>
      <p className="debrief-intro">How you worked, set against what research on real investigations says goes wrong. This does not change your score.</p>
      <div className="findings">
        {findings.map((f) => (
          <article key={f.title} className={`finding v-${f.verdict}`}>
            <header><h3>{f.title}</h3><span className="finding-verdict">{VERD[f.verdict]}</span></header>
            <p>{f.text}</p>
            <p className="source">{f.source}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
