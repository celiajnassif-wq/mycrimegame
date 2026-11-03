import { useKase, useCS } from '../lib/caseContext';
import { POINTS } from '../../shared/scoring';

export default function Hints() {
  const kase = useKase();
  const revealed = useCS((s) => s.hints);
  const reveal = useCS((s) => s.revealHint);
  const cost = Math.min(POINTS.hintMax, revealed.length * POINTS.hint);
  const mode = useCS((s) => s.mode);
  if (mode === 'detective') {
    return <div className="hints-screen"><div className="hint-folder"><div className="hint-cover-stamp">SEALED</div><p className="hint-cost">Detective mode: there is no file to read if you get stuck. Real cases do not come with one either.</p></div></div>;
  }
  return (
    <div className="hints-screen">
      <div className="hint-folder">
        <div className="hint-cover-stamp">READ ONLY IF STUCK</div>
        <p className="hint-cost">Each hint costs {POINTS.hint} points (at most {POINTS.hintMax}). Used: {revealed.length}, costing {cost} points.</p>
        {kase.hints.map((q) => {
          const tiers = [...q.hints].sort((a, b) => a.tier - b.tier);
          const next = tiers.find((h) => !revealed.includes(h.id));
          return (
            <section key={q.id} className="hint-q" aria-labelledby={`hq-${q.id}`}>
              <h2 id={`hq-${q.id}`}>{q.question}</h2>
              <ol>
                {tiers.filter((h) => revealed.includes(h.id)).map((h) => <li key={h.id} className="hint-text"><span className="tier">Hint {h.tier}</span> {h.text}</li>)}
              </ol>
              {next ? (
                <button type="button" className="btn small" onClick={() => reveal(next.id)}>Reveal hint {next.tier} of {tiers.length} (-{POINTS.hint} points)</button>
              ) : <p className="hint-done">All hints shown.</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
