// Analysis of Competing Hypotheses (Richards Heuer, "Psychology of Intelligence Analysis", 1999).
// The player rates each record against each theory. The board never peeks at the solution.
import { useState } from 'react';
import { useKase, useCS } from '../lib/caseContext';
import { availableDocs, useUI, type BoardMark } from '../store';

const NEXT: Record<string, BoardMark | null> = { '': 'C', C: 'I', I: 'N', N: null };
const LABEL: Record<BoardMark, string> = { C: 'consistent', I: 'inconsistent', N: 'not relevant' };
const SKIP_KINDS = new Set(['qr', 'suspect']);

export function hypotheses(kase: ReturnType<typeof useKase>) {
  return [...kase.suspects.map((s) => ({ id: s.id, label: s.name.split(' ').slice(-1)[0], full: s.name })), { id: 'none', label: 'Accident', full: 'No one: it was an accident' }];
}

export default function Board() {
  const kase = useKase();
  const st = useCS((s) => s);
  const setOpenDoc = useUI((u) => u.setOpenDoc);
  const [onlyMarked, setOnlyMarked] = useState(false);
  const hyps = hypotheses(kase);
  const rows = availableDocs(kase, st).filter((d) => st.read[d.id] && !SKIP_KINDS.has(d.kind))
    .filter((d) => !onlyMarked || Object.keys(st.board[d.id] ?? {}).length);
  const marked = (docId: string) => st.board[docId] ?? {};
  const inconsistent = (h: string) => Object.values(st.board).filter((r) => r[h] === 'I').length;
  const consistent = (h: string) => Object.values(st.board).filter((r) => r[h] === 'C').length;
  const anyMarks = Object.values(st.board).some((r) => Object.keys(r).length);
  const diagnostic = (docId: string) => {
    const r = marked(docId);
    const vals = hyps.map((h) => r[h.id] ?? '');
    if (vals.some((v) => !v)) return null; // not fully rated yet
    return new Set(vals.filter((v) => v !== 'N')).size > 1;
  };
  const ranked = [...hyps].sort((a, b) => inconsistent(a.id) - inconsistent(b.id));
  const best = ranked[0];
  const tie = ranked.length > 1 && inconsistent(ranked[1].id) === inconsistent(best.id);

  return (
    <div className="board-screen">
      <div className="screen-head">
        <h1>Hypothesis board</h1>
        <p>For each record you have read, mark whether it fits each theory. Tap a square to cycle: <b>C</b> consistent, <b>I</b> inconsistent, <b>N</b> not relevant. The theory to take seriously is the one with the <em>fewest inconsistencies</em>, not the most support: anything fits a theory you already believe. (Analysis of Competing Hypotheses, R. J. Heuer)</p>
      </div>
      {anyMarks && (
        <div className="board-summary" role="status">
          <div className="hyp-tally">
            {hyps.map((h) => (
              <div key={h.id} className={`tally ${!tie && h.id === best.id ? 'lead' : ''}`}>
                <span className="tally-name">{h.full}</span>
                <span className="tally-num">{inconsistent(h.id)}<small> against</small></span>
                <span className="tally-sub">{consistent(h.id)} fit</span>
              </div>
            ))}
          </div>
          <p className="board-advice">
            {tie ? 'No theory stands out yet. Rate more records, especially ones that could rule a theory out.'
              : <>Fewest inconsistencies: <strong>{best.full}</strong>. Before you charge, look for the one record that would disprove it.</>}
          </p>
        </div>
      )}
      <div className="board-controls">
        <label className="check"><input type="checkbox" checked={onlyMarked} onChange={(e) => setOnlyMarked(e.target.checked)} /> Only rows I have rated</label>
      </div>
      {rows.length === 0 && <p className="empty">{onlyMarked ? 'No rated rows yet.' : 'Read some records on the desk first. They appear here as rows.'}</p>}
      {rows.length > 0 && (
        <div className="board-wrap" tabIndex={0} aria-label="Hypothesis matrix, scroll sideways on small screens">
          <table className="board">
            <thead>
              <tr><th scope="col" className="doc-col">Record</th>{hyps.map((h) => <th key={h.id} scope="col" title={h.full}>{h.label}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const diag = diagnostic(d.id);
                return (
                  <tr key={d.id} className={diag === false ? 'non-diag' : ''}>
                    <th scope="row" className="doc-col">
                      <button type="button" className="linkish" onClick={() => setOpenDoc(d.id)}>{d.title}</button>
                      {diag === false && <span className="diag-note">Fits every theory alike: it cannot tell them apart</span>}
                    </th>
                    {hyps.map((h) => {
                      const v = marked(d.id)[h.id] ?? '';
                      return (
                        <td key={h.id}>
                          <button type="button" className={`cell m-${v || 'empty'}`} onClick={() => st.setMark(d.id, h.id, NEXT[v])}
                            aria-label={`${d.title} against ${h.full}: ${v ? LABEL[v as BoardMark] : 'not rated'}. Activate to change.`}>{v}</button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
