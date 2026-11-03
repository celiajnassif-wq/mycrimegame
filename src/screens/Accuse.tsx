import { useState } from 'react';
import { useKase, useCS } from '../lib/caseContext';
import { availableDocs, useUI } from '../store';
import { accuse, giveUp } from '../api';
import { Portrait } from '../lib/portrait';
import { POINTS } from '../../shared/scoring';
import Debrief from './Debrief';

const STEPS = ['Who', 'How', 'Why', 'Proof', 'File'] as const;

function Memo({ memo }: { memo: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="memo-wrap">
      {!open ? (
        <button type="button" className="memo-sealed" onClick={() => setOpen(true)}>
          <span className="wax small" aria-hidden="true"><span className="wax-initials">SOL</span></span>
          Unseal the solution memo
        </button>
      ) : (
        <article className="paper paper-typed memo"><div className="typed">{memo.map((p, i) => <p key={i}>{p}</p>)}</div></article>
      )}
    </div>
  );
}

export default function Accuse() {
  const kase = useKase();
  const st = useCS((s) => s);
  const setOpenDoc = useUI((u) => u.setOpenDoc);
  const [step, setStep] = useState(0);
  const [who, setWho] = useState<string | null>(null);
  const [how, setHow] = useState<string | null>(null);
  const [why, setWhy] = useState<string | null>(null);
  const [proof, setProof] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<{ text: string; clearedBy: string[] } | null>(null);
  const [confirming, setConfirming] = useState<'giveup' | 'reset' | null>(null);
  const need = kase.accusation.proofCount;
  const readDocs = availableDocs(kase, st).filter((d) => st.read[d.id]);
  const r = st.result;

  if (r) {
    const culprit = kase.suspects.find((s) => s.id === (r.outcome === 'gaveup' ? r.culprit : who ?? ''));
    return (
      <div className="accuse-screen">
        {r.outcome === 'solved' ? (
          <section className="verdict paper paper-typed" aria-labelledby="verdict-h">
            <div className="typed">
              <div className="letterhead">REVIEW BOARD . {kase.title.toUpperCase()}</div>
              <h1 id="verdict-h" className="verdict-title">Charge accepted</h1>
              <div className="rank-stamp" data-testid="rank">{r.score.rank}</div>
              <table className="score-table">
                <tbody>
                  <tr><th scope="row">Culprit</th><td>{r.score.culprit} / {POINTS.culprit}</td></tr>
                  <tr><th scope="row">How</th><td>{r.score.how} / {POINTS.how} {r.correct.how ? '' : '(wrong method)'}</td></tr>
                  <tr><th scope="row">Why</th><td>{r.score.why} / {POINTS.why} {r.correct.why ? '' : '(wrong motive)'}</td></tr>
                  <tr><th scope="row">Proof</th><td>{r.score.proof} / 30 ({r.correct.proof.length} of 3 documents hold up)</td></tr>
                  <tr><th scope="row">Hints</th><td>-{r.score.hintPenalty}</td></tr>
                  <tr><th scope="row">Wrong charges</th><td>-{r.score.wrongPenalty}</td></tr>
                  <tr className="total"><th scope="row">Total</th><td data-testid="score-total">{r.score.total}</td></tr>
                </tbody>
              </table>
              {st.mode === 'detective' && <p className="mode-note">Solved in detective mode: no suggested questions, no flagged contradictions, no hints.</p>}
              <h2>Epilogue</h2>
              {r.epilogue.map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </section>
        ) : (
          <section className="verdict paper paper-typed"><div className="typed"><div className="letterhead">FILE RETURNED UNSOLVED</div><h1 className="verdict-title">You gave up the case</h1><p>The memo names {culprit?.name ?? 'the culprit'}. No rank is awarded.</p></div></section>
        )}
        {r.outcome === 'solved' && <Debrief result={r} />}
        <Memo memo={r.memo} />
        {confirming === 'reset' ? (
          <div className="confirm-row" role="group" aria-label="Confirm restart">
            <span>Erase your notes and progress and start again?</span>
            <button type="button" className="btn primary" onClick={() => { setConfirming(null); st.reset(); }}>Yes, start again</button>
            <button type="button" className="btn ghost-light" onClick={() => setConfirming(null)}>Keep my progress</button>
          </div>
        ) : <button type="button" className="btn ghost-light" onClick={() => setConfirming('reset')}>Start the case again</button>}
      </div>
    );
  }

  const file = async () => {
    if (!who || !how || !why || proof.length !== need) return;
    setBusy(true); setError(null);
    try {
      const res = await accuse({ caseId: kase.id, who, how, why, proof, hintsUsed: st.hints.length, wrongCharges: st.wrongCharges });
      if (res.outcome === 'refused') { st.addRefusal(who, res.text); setRefusal({ text: res.text, clearedBy: res.clearedBy }); }
      else st.setResult({ ...res, charge: { who, how, why, proof }, at: Date.now() });
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };
  const doGiveUp = async () => {
    setConfirming(null);
    const g = await giveUp(kase.id);
    st.setResult({ outcome: 'gaveup', memo: g.memo, culprit: g.culprit });
  };
  const canNext = [who, how, why, proof.length === need ? 'ok' : null, 'ok'][step];

  if (refusal) {
    return (
      <div className="accuse-screen">
        <section className="refusal paper paper-typed" role="alert">
          <div className="typed">
            <div className="letterhead">REVIEW BOARD . CHARGE REFUSED</div>
            <p>{refusal.text}</p>
            <p className="penalty">-{POINTS.wrong} points. Wrong charges so far: {st.wrongCharges}.</p>
            <p>Cleared by: {refusal.clearedBy.map((id) => (
              <button key={id} type="button" className="linkish" onClick={() => setOpenDoc(id)}>{kase.documents.find((d) => d.id === id)?.title}</button>
            ))}</p>
            <div className="stamp red">REFUSED</div>
          </div>
        </section>
        <button type="button" className="btn primary" onClick={() => { setRefusal(null); setStep(0); setWho(null); }}>Reconsider the charge</button>
      </div>
    );
  }

  return (
    <div className="accuse-screen">
      <div className="screen-head"><h1>File a charge</h1><p>Name the culprit, the method, the motive, and exactly {need} records that prove it. A wrong name costs {POINTS.wrong} points.</p></div>
      <ol className="stepper" aria-label="Charge steps">
        {STEPS.map((s, i) => <li key={s} className={i === step ? 'current' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>{i + 1}. {s}</li>)}
      </ol>
      <div className="step-body paper paper-typed">
        {step === 0 && (
          <fieldset><legend>Who killed {kase.victim.name}?</legend>
            <div className="who-grid">
              {kase.suspects.map((s) => (
                <label key={s.id} className={`who-opt ${who === s.id ? 'on' : ''}`}>
                  <input type="radio" name="who" value={s.id} checked={who === s.id} onChange={() => setWho(s.id)} />
                  <Portrait spec={s.portrait} label="" size={70} />
                  <span>{s.name}<small>{s.role}</small></span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {step === 1 && (
          <fieldset><legend>How was it done?</legend>
            {kase.accusation.how.map((o) => <label key={o.id} className={`opt ${how === o.id ? 'on' : ''}`}><input type="radio" name="how" checked={how === o.id} onChange={() => setHow(o.id)} /> {o.label}</label>)}
          </fieldset>
        )}
        {step === 2 && (
          <fieldset><legend>Why?</legend>
            {kase.accusation.why.map((o) => <label key={o.id} className={`opt ${why === o.id ? 'on' : ''}`}><input type="radio" name="why" checked={why === o.id} onChange={() => setWhy(o.id)} /> {o.label}</label>)}
          </fieldset>
        )}
        {step === 3 && (
          <fieldset><legend>Pick exactly {need} proof documents ({proof.length} chosen)</legend>
            {readDocs.length < need && <p>You have read only {readDocs.length} documents. Read more on the desk.</p>}
            <div className="proof-list">
              {readDocs.map((d) => {
                const on = proof.includes(d.id);
                return (
                  <label key={d.id} className={`opt ${on ? 'on' : ''}`}>
                    <input type="checkbox" checked={on} disabled={!on && proof.length >= need} onChange={() => setProof(on ? proof.filter((p) => p !== d.id) : [...proof, d.id])} /> {d.title}
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
        {step === 4 && (
          <div className="review">
            <h2>Charge sheet</h2>
            <dl>
              <dt>Accused</dt><dd>{kase.suspects.find((s) => s.id === who)?.name}</dd>
              <dt>Method</dt><dd>{kase.accusation.how.find((o) => o.id === how)?.label}</dd>
              <dt>Motive</dt><dd>{kase.accusation.why.find((o) => o.id === why)?.label}</dd>
              <dt>Proof</dt><dd><ul>{proof.map((p) => <li key={p}>{kase.documents.find((d) => d.id === p)?.title}</li>)}</ul></dd>
            </dl>
            {error && <p role="alert" className="err-text">{error}</p>}
            <button type="button" className="btn primary big" onClick={file} disabled={busy}>{busy ? 'Filing...' : 'File the charge'}</button>
          </div>
        )}
      </div>
      <div className="step-nav">
        <button type="button" className="btn" onClick={() => setStep(step - 1)} disabled={step === 0}>Back</button>
        {step < 4 && <button type="button" className="btn primary" onClick={() => setStep(step + 1)} disabled={!canNext}>Next</button>}
      </div>
      {confirming === 'giveup' ? (
        <div className="confirm-row give-up" role="group" aria-label="Confirm giving up">
          <span>Read the solution now? No rank will be awarded.</span>
          <button type="button" className="btn primary" onClick={doGiveUp}>Yes, show the solution</button>
          <button type="button" className="btn ghost-light" onClick={() => setConfirming(null)}>Keep investigating</button>
        </div>
      ) : <button type="button" className="btn ghost-light give-up" onClick={() => setConfirming('giveup')}>Give up and read the solution</button>}
    </div>
  );
}
