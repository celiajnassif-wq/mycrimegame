// Procedural sound: typewriter, paper, stamp, wax, scanner beep, rain. No audio files.
// Audio starts only after the player interacts (browsers require it), and can be muted.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let rain: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
let lastKey = 0;

const read = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };

let muted = read('dossiers:muted', '0') === '1';
let rainOn = read('dossiers:rain', '0') === '1';
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function noiseBuffer(c: AudioContext, seconds: number, brown = false): AudioBuffer {
  const b = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
  }
  return b;
}

function burst(opts: { dur: number; freq: number; q?: number; gain: number; type?: BiquadFilterType; at?: number }) {
  const c = audio();
  if (!c || !master || muted) return;
  const t = c.currentTime + (opts.at ?? 0);
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, opts.dur + 0.02);
  const f = c.createBiquadFilter();
  f.type = opts.type ?? 'bandpass';
  f.frequency.value = opts.freq;
  f.Q.value = opts.q ?? 1;
  const g = c.createGain();
  g.gain.setValueAtTime(opts.gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + opts.dur + 0.02);
}

function tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', at = 0, slideTo?: number) {
  const c = audio();
  if (!c || !master || muted) return;
  const t = c.currentTime + at;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  /** One typewriter key. Throttled so streamed text sounds like typing, not static. */
  key() {
    const now = performance.now();
    if (now - lastKey < 55) return;
    lastKey = now;
    burst({ dur: 0.025, freq: 2400 + Math.random() * 1400, q: 3, gain: 0.5 });
    burst({ dur: 0.04, freq: 180 + Math.random() * 60, q: 2, gain: 0.25, type: 'lowpass' });
  },
  /** Carriage return at the end of an answer. */
  ding() { tone(2093, 0.5, 0.12, 'triangle'); burst({ dur: 0.12, freq: 900, q: 1, gain: 0.25, at: 0.05 }); },
  paper() { burst({ dur: 0.28, freq: 3200, q: 0.6, gain: 0.35 }); burst({ dur: 0.18, freq: 1500, q: 0.8, gain: 0.2, at: 0.08 }); },
  stamp() { tone(90, 0.22, 0.9, 'sine', 0, 45); burst({ dur: 0.06, freq: 700, q: 1, gain: 0.6 }); },
  crack() { for (let i = 0; i < 6; i++) burst({ dur: 0.03, freq: 1800 + Math.random() * 2500, q: 4, gain: 0.5, at: i * 0.045 + Math.random() * 0.02 }); },
  beep() { tone(1320, 0.12, 0.25, 'square'); tone(1760, 0.14, 0.2, 'square', 0.13); },
  twine() { burst({ dur: 0.5, freq: 600, q: 0.7, gain: 0.3 }); burst({ dur: 0.35, freq: 2600, q: 0.5, gain: 0.2, at: 0.4 }); },
};

function startRain() {
  const c = audio();
  if (!c || !master || rain) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 4, true);
  src.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 1100;
  const hp = c.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 120;
  const g = c.createGain();
  g.gain.value = 0;
  g.gain.linearRampToValueAtTime(0.5, c.currentTime + 2);
  src.connect(lp).connect(hp).connect(g).connect(master);
  src.start();
  rain = { src, gain: g };
}

function stopRain() {
  if (!rain || !ctx) return;
  const r = rain;
  rain = null;
  r.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
  setTimeout(() => r.src.stop(), 1100);
}

export const sound = {
  get muted() { return muted; },
  get rain() { return rainOn; },
  setMuted(m: boolean) {
    muted = m; write('dossiers:muted', m ? '1' : '0');
    if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.55, ctx.currentTime, 0.05);
    notify();
  },
  setRain(on: boolean) {
    rainOn = on; write('dossiers:rain', on ? '1' : '0');
    if (on) startRain(); else stopRain();
    notify();
  },
  /** Call from a click: resumes audio and restores the rain if the player had it on. */
  wake() { audio(); if (rainOn) startRain(); },
  subscribe(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; },
};
