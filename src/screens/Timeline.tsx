import { useKase, useCS } from '../lib/caseContext';
import { useUI } from '../store';
import { factRange, findCollisions, toMinutes } from '../../shared/timeline';

const KIND_LABEL: Record<string, string> = { record: 'Record', statement: 'Statement', absence: 'Absence', window: 'Estimated window', moment: 'Moment' };

export default function Timeline() {
  const kase = useKase();
  const tl = kase.timeline;
  const pinned = useCS((s) => s.pinned);
  const read = useCS((s) => s.read);
  const togglePin = useCS((s) => s.togglePin);
  const setOpenDoc = useUI((u) => u.setOpenDoc);
  const t0 = toMinutes(tl.start), t1 = toMinutes(tl.end), span = t1 - t0;
  const facts = tl.facts.filter((f) => pinned.includes(f.id));
  const mode = useCS((s) => s.mode);
  const collisions = mode === 'detective' ? [] : findCollisions(facts);
  const available = tl.facts.filter((f) => read[f.source] && !pinned.includes(f.id));
  const hours: number[] = [];
  for (let m = Math.ceil(t0 / 60) * 60; m <= t1; m += 60) hours.push(m);
  const pct = (m: number) => `${((m - t0) / span) * 100}%`;
  const docTitle = (id: string) => kase.documents.find((d) => d.id === id)?.title ?? id;

  return (
    <div className="timeline-screen">
      <div className="screen-head">
        <h1>Timeline: {tl.date}</h1>
        <p>{facts.length} of {tl.facts.length} facts pinned. Pin facts from the bar at the foot of each document.{mode === 'detective' && ' Detective mode: contradictions are not flagged for you.'}</p>
      </div>
      {collisions.length > 0 && (
        <section className="collisions" aria-labelledby="coll-h">
          <h2 id="coll-h">Statements that collide with the record</h2>
          <ul>
            {[...new Set(collisions.map((c) => c.statement.id))].map((sid) => {
              const group = collisions.filter((c) => c.statement.id === sid);
              const st = group[0].statement;
              return (
                <li key={sid}>
                  <strong>{kase.timeline.lanes.find((l) => l.id === st.lane)?.label}:</strong>{' '}
                  <button type="button" className="linkish" onClick={() => setOpenDoc(st.source)}>"{st.label}" ({st.start}{st.end ? `-${st.end}` : ''}{st.place ? `, ${st.place}` : ''})</button>
                  <ul className="coll-records">
                    {group.map((c) => (
                      <li key={c.record.id}>
                        <button type="button" className="linkish" onClick={() => setOpenDoc(c.record.source)}>{c.record.label}</button>{' '}
                        <span className="coll-reason">({c.record.start}{c.record.end ? `-${c.record.end}` : ''}{c.record.place && st.conflictsWith?.includes(c.record.id) ? '' : c.record.place ? `, ${c.record.place}` : ''}{st.conflictsWith?.includes(c.record.id) ? `. ${c.reason}` : ''}). Source: {docTitle(c.record.source)}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <div className="tl-legend" aria-hidden="true">
        {Object.entries(KIND_LABEL).map(([k, v]) => <span key={k} className={`legend-item kind-${k}`}><i />{v}</span>)}
      </div>
      <div className="tl-board-wrap" tabIndex={0} aria-label="Timeline board, scroll sideways on small screens">
        <div className="tl-board">
          <div className="tl-axis">
            {hours.map((m) => <span key={m} className="tl-hour" style={{ left: pct(m) }}>{String(Math.floor(m / 60) % 24).padStart(2, '0')}:00</span>)}
          </div>
          {tl.lanes.map((lane) => {
            const lf = facts.filter((f) => f.lane === lane.id);
            return (
              <div key={lane.id} className="tl-lane">
                <div className="tl-lane-label">{lane.label}</div>
                <div className="tl-track">
                  {hours.map((m) => <span key={m} className="tl-grid" style={{ left: pct(m) }} />)}
                  {lf.map((f, i) => {
                    const [s, e] = factRange(f);
                    const isMoment = f.kind === 'moment' || !f.end;
                    const colliding = collisions.some((c) => c.statement.id === f.id || c.record.id === f.id);
                    return (
                      <button key={f.id} type="button" className={`tl-bar kind-${f.kind} ${isMoment ? 'is-moment' : ''} ${colliding ? 'colliding' : ''}`}
                        style={{ left: pct(s), width: isMoment ? undefined : pct(t0 + (e - s)), top: `${(i % 3) * 30 + 4}px` }}
                        onClick={() => setOpenDoc(f.source)}
                        aria-label={`${KIND_LABEL[f.kind]}: ${f.label}, ${f.start}${f.end ? ' to ' + f.end : ''}${f.place ? ', ' + f.place : ''}. Source: ${docTitle(f.source)}`}>
                        <span className="tl-bar-text">{f.start} {f.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {available.length > 0 && (
        <section className="tl-available">
          <h2>From documents you have read</h2>
          <ul>
            {available.map((f) => (
              <li key={f.id}>
                <button type="button" className={`pin-chip kind-${f.kind}`} onClick={() => togglePin([f.id], true)}>+ {f.start}{f.end ? `-${f.end}` : ''} {f.label}</button>
                <span className="src"> ({docTitle(f.source)})</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {facts.length > 0 && <button type="button" className="btn small ghost-light" onClick={() => togglePin(facts.map((f) => f.id), false)}>Unpin everything</button>}
    </div>
  );
}
