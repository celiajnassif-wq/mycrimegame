import { useEffect, useState, useSyncExternalStore } from 'react';
import { sound } from './lib/sound';
import type { CaseData } from '../shared/types';
import { fetchCase, fetchCases } from './api';
import { CaseCtx } from './lib/caseContext';
import { go, hrefFor, useRoute, type Screen } from './lib/router';
import { caseStore, useUI, availableDocs } from './store';
import Intro from './screens/Intro';
import Desk from './screens/Desk';
import Reader from './screens/Reader';
import Timeline from './screens/Timeline';
import Interrogate from './screens/Interrogate';
import Notes from './screens/Notes';
import Hints from './screens/Hints';
import Accuse from './screens/Accuse';
import Board from './screens/Board';

const TABS: { id: Screen; label: string; icon: string }[] = [
  { id: 'desk', label: 'Desk', icon: '🗂' },
  { id: 'timeline', label: 'Timeline', icon: '⏱' },
  { id: 'interrogate', label: 'Interview', icon: '🎙' },
  { id: 'board', label: 'Board', icon: '▦' },
  { id: 'notes', label: 'Notes', icon: '✎' },
  { id: 'hints', label: 'Hints', icon: '?' },
  { id: 'accuse', label: 'Charge', icon: '⚖' },
];

function Home() {
  const [cases, setCases] = useState<Awaited<ReturnType<typeof fetchCases>> | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { fetchCases().then(setCases).catch(() => setErr(true)); }, []);
  return (
    <main className="home">
      <h1 className="brand">Dossiers</h1>
      <p className="tagline">Cold cases, reopened. Read the records, question the witnesses, file the charge.</p>
      {err && <p role="alert">The archive server is not answering. Is <code>npm run dev</code> running?</p>}
      <ul className="case-list">
        {cases?.map((c) => (
          <li key={c.id}>
            <button type="button" className="case-folder" onClick={() => go(c.id, 'intro')}>
              <span className="folder-tab">{c.place}</span>
              <span className="case-title">{c.title}</span>
              <span className="case-sub">{c.subtitle}. {c.date}</span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}

function SoundControls() {
  const muted = useSyncExternalStore(sound.subscribe, () => sound.muted);
  const rain = useSyncExternalStore(sound.subscribe, () => sound.rain);
  return (
    <div className="sound-controls">
      <button type="button" className="icon-btn" aria-pressed={!muted} onClick={() => sound.setMuted(!muted)} title={muted ? 'Sound off' : 'Sound on'} aria-label={muted ? 'Turn sound on' : 'Turn sound off'}>{muted ? '🔇' : '🔊'}</button>
      <button type="button" className="icon-btn" aria-pressed={rain} disabled={muted} onClick={() => sound.setRain(!rain)} title="Rain on the window" aria-label={rain ? 'Stop the rain' : 'Rain on the window'}>{rain ? '🌧' : '☁'}</button>
    </div>
  );
}

function CaseShell({ kase, screen }: { kase: CaseData; screen: Screen }) {
  const st = caseStore(kase.id)();
  const openDoc = useUI((u) => u.openDoc);
  const setOpenDoc = useUI((u) => u.setOpenDoc);
  const toast = useUI((u) => u.toast);
  const setToast = useUI((u) => u.setToast);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3200); return () => clearTimeout(t); } }, [toast, setToast]);
  useEffect(() => { setOpenDoc(null); }, [screen, setOpenDoc]);
  useEffect(() => { document.title = `${kase.title} . Dossiers`; }, [kase.title]);

  if (screen === 'intro' || !st.opened) return <CaseCtx.Provider value={kase}><Intro /></CaseCtx.Provider>;
  const docs = availableDocs(kase, st);
  const readCount = docs.filter((d) => st.read[d.id]).length;
  const marks = st.highlights.length + st.cards.filter((c) => c.kind === 'note').length;
  return (
    <CaseCtx.Provider value={kase}>
      <div className="shell">
        <header className="topbar">
          <button type="button" className="case-chip" onClick={() => go(null)} aria-label="Back to all cases">
            <span className="chip-title">{kase.title}</span>
            <span className="chip-sub">{kase.place}, {kase.date}</span>
          </button>
          <div className="top-right">
            <SoundControls />
            <div className="counter" aria-live="polite">{st.mode === 'detective' && <span className="mode-badge">DETECTIVE MODE</span>}<span className="stamp-mini">READ</span> {readCount} / {docs.length}</div>
          </div>
          <nav className="tabs" aria-label="Case sections">
            {TABS.map((t) => (
              <a key={t.id} href={hrefFor(kase.id, t.id)} className={`tab ${screen === t.id ? 'active' : ''}`} aria-current={screen === t.id ? 'page' : undefined}>
                <span className="tab-icon" aria-hidden="true">{t.icon}</span>{t.label}
                {t.id === 'notes' && marks > 0 && <span className="tab-badge" aria-label={`${marks} highlights and notes`}>{marks}</span>}
              </a>
            ))}
          </nav>
        </header>
        <main className="screen" id="main">
          {screen === 'desk' && <Desk />}
          {screen === 'timeline' && <Timeline />}
          {screen === 'interrogate' && <Interrogate />}
          {screen === 'notes' && <Notes />}
          {screen === 'hints' && <Hints />}
          {screen === 'accuse' && <Accuse />}
          {screen === 'board' && <Board />}
        </main>
        {openDoc && <Reader docId={openDoc} onClose={() => setOpenDoc(null)} />}
        {toast && <div className="toast" role="status">{toast}</div>}
      </div>
    </CaseCtx.Provider>
  );
}

export default function App() {
  const route = useRoute();
  useEffect(() => {
    const wake = () => sound.wake();
    window.addEventListener('pointerdown', wake, { once: true });
    window.addEventListener('keydown', wake, { once: true });
    return () => { window.removeEventListener('pointerdown', wake); window.removeEventListener('keydown', wake); };
  }, []);
  const [kase, setKase] = useState<CaseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setError(null);
    if (!route.caseId) { setKase(null); return; }
    if (kase?.id === route.caseId) return;
    fetchCase(route.caseId).then(setKase).catch((e) => setError(String(e.message ?? e)));
  }, [route.caseId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!route.caseId) return <Home />;
  if (error) return <main className="home"><p role="alert">{error}</p><button className="btn" onClick={() => go(null)}>All cases</button></main>;
  if (!kase || kase.id !== route.caseId) return <main className="home"><p className="loading">Fetching the file from the archive...</p></main>;
  return <CaseShell kase={kase} screen={route.screen} />;
}
