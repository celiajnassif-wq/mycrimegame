import { useState } from 'react';
import { useKase, useCS } from '../lib/caseContext';
import { go, DEMO } from '../lib/router';
import { sfx } from '../lib/sound';

export default function Intro() {
  const kase = useKase();
  const opened = useCS((s) => s.opened);
  const open = useCS((s) => s.open);
  const mode = useCS((s) => s.mode);
  const setMode = useCS((s) => s.setMode);
  const [phase, setPhase] = useState<'closed' | 'untying' | 'open'>(opened ? 'open' : 'closed');
  const untie = () => {
    sfx.twine();
    setPhase('untying');
    setTimeout(() => setPhase('open'), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1300);
  };
  const enter = () => { open(); go(kase.id, 'desk'); };
  return (
    <main className="intro">
      <div className={`folder ${phase}`}>
        <div className="folder-back">
          <div className="briefing paper">
            <div className="letterhead">{kase.reopened.toUpperCase()}</div>
            <h1 className="brief-title">{kase.title}</h1>
            <p className="brief-sub">{kase.place} . {kase.date}</p>
            {kase.intro.briefing.map((p, i) => <p key={i}>{p}</p>)}
            {!opened && (
              <fieldset className="mode-pick">
                <legend>How do you want to work?</legend>
                <label className={`mode-opt ${mode === 'standard' ? 'on' : ''}`}>
                  <input type="radio" name="mode" checked={mode === 'standard'} onChange={() => setMode('standard')} />
                  <span><strong>Investigator</strong> Suggested questions, contradictions flagged on the timeline, a hints file if you are stuck.</span>
                </label>
                <label className={`mode-opt ${mode === 'detective' ? 'on' : ''}`}>
                  <input type="radio" name="mode" checked={mode === 'detective'} onChange={() => setMode('detective')} />
                  <span><strong>Detective mode</strong> No suggested questions, no flagged contradictions, no hints. Only the records, the witnesses and you.</span>
                </label>
              </fieldset>
            )}
            <button type="button" className="btn primary" onClick={enter} disabled={phase !== 'open'}>Go to the desk</button>
          </div>
        </div>
        <div className="folder-cover" aria-hidden={phase === 'open'}>
          <div className="folder-tab-label">{kase.place.toUpperCase()}</div>
          <div className="folder-label">
            <div className="label-line">{kase.intro.label}</div>
            <div className="label-title">{kase.title}</div>
            <div className="label-line">{kase.date}</div>
          </div>
          <div className="folder-stamps">
            {kase.intro.stamps.map((s, i) => <span key={s} className={`stamp ${i === 1 ? 'red' : i === 2 ? 'blue' : ''}`} style={{ transform: `rotate(${[-8, 6, -3][i % 3]}deg)` }}>{s}</span>)}
          </div>
          <div className="twine" aria-hidden="true"><span className="twine-h" /><span className="twine-v" /><span className="twine-knot" /></div>
        </div>
      </div>
      {phase === 'closed' && <button type="button" className="btn primary untie" onClick={untie} autoFocus>Untie the twine</button>}
      {phase !== 'closed' && <p className="sr-only" role="status">{phase === 'open' ? 'The folder is open.' : 'Untying the twine.'}</p>}
      {DEMO
        ? <p className="demo-note">Prototype build. Suspects answer from scripted lines here; the full game puts Claude behind each witness.</p>
        : <button type="button" className="btn ghost back-home" onClick={() => go(null)}>All cases</button>}
    </main>
  );
}
