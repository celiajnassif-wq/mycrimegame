// Procedural sepia portrait from a few features in case.json. Deterministic per seed.
import type { PortraitSpec } from '../../shared/types';

function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function Portrait({ spec, label, size = 160 }: { spec: PortraitSpec; label: string; size?: number }) {
  const r = rng(spec.seed);
  const skin = spec.skin ?? '#c8a078';
  const hair = spec.hair ?? '#2a1d14';
  const coat = spec.coat ?? '#3b3b3b';
  const fw = 30 + r() * 6;       // face half width
  const fh = 40 + r() * 5;       // face half height
  const eyeY = 98 + r() * 4;
  const eyeDX = 13 + r() * 3;
  const old = spec.age === 'old';
  const fid = `p${spec.seed}`;
  return (
    <svg viewBox="0 0 160 200" width={size} height={size * 1.25} role="img" aria-label={label} className="portrait">
      <defs>
        <filter id={`${fid}-sepia`}>
          <feColorMatrix type="matrix" values="0.39 0.77 0.19 0 0  0.35 0.69 0.17 0 0  0.27 0.53 0.13 0 0  0 0 0 1 0" />
          <feComponentTransfer><feFuncR type="linear" slope="1.05" /><feFuncG type="linear" slope="1.0" /></feComponentTransfer>
        </filter>
        <filter id={`${fid}-noise`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={spec.seed} result="n" />
          <feColorMatrix in="n" type="saturate" values="0" />
          <feComponentTransfer><feFuncA type="table" tableValues="0 0.22" /></feComponentTransfer>
        </filter>
        <radialGradient id={`${fid}-bg`} cx="0.5" cy="0.4" r="0.7"><stop offset="0" stopColor="#d9d2c2" /><stop offset="1" stopColor="#8a8070" /></radialGradient>
      </defs>
      <g filter={`url(#${fid}-sepia)`}>
        <rect width="160" height="200" fill={`url(#${fid}-bg)`} />
        {spec.hairStyle === 'bun' && <circle cx="80" cy="44" r="18" fill={hair} />}
        <path d={`M20 200 Q24 150 80 146 Q136 150 140 200 Z`} fill={coat} />
        <path d="M66 146 L80 176 L94 146 Z" fill="#e9e4da" />
        {!spec.hairStyle || spec.hairStyle !== 'bun' ? <path d="M76 150 L80 178 L84 150 Z" fill="#222" /> : <path d="M62 150 Q80 160 98 150" stroke="#ddd" strokeWidth="3" fill="none" />}
        <rect x="70" y="126" width="20" height="24" fill={skin} />
        <ellipse cx="80" cy="100" rx={fw} ry={fh} fill={skin} />
        <ellipse cx={80 - fw} cy={eyeY + 4} rx="5" ry="8" fill={skin} />
        <ellipse cx={80 + fw} cy={eyeY + 4} rx="5" ry="8" fill={skin} />
        {spec.hairStyle === 'slick' && <path d={`M${80 - fw - 2} 96 Q${80 - fw} 52 80 54 Q${80 + fw} 52 ${80 + fw + 2} 96 Q${80 + fw - 4} 70 80 68 Q62 66 ${80 - fw + 4} 84 Z`} fill={hair} />}
        {spec.hairStyle === 'wavy' && <path d={`M${80 - fw - 4} 100 Q${80 - fw - 8} 56 80 56 Q${80 + fw + 8} 56 ${80 + fw + 4} 100 Q${80 + fw} 74 ${80 + 12} 72 Q80 80 ${80 - 12} 72 Q${80 - fw} 74 ${80 - fw - 4} 100 Z`} fill={hair} />}
        {spec.hairStyle === 'short' && <path d={`M${80 - fw} 92 Q${80 - fw} 56 80 58 Q${80 + fw} 56 ${80 + fw} 92 Q80 64 ${80 - fw} 92 Z`} fill={hair} />}
        {spec.hairStyle === 'bun' && <path d={`M${80 - fw - 3} 112 Q${80 - fw - 6} 58 80 58 Q${80 + fw + 6} 58 ${80 + fw + 3} 112 Q${80 + fw - 2} 74 80 72 Q${80 - fw + 2} 74 ${80 - fw - 3} 112 Z`} fill={hair} />}
        {spec.hairStyle === 'scarf' && <path d={`M${80 - fw - 8} 140 Q${80 - fw - 10} 50 80 50 Q${80 + fw + 10} 50 ${80 + fw + 8} 140 L${80 + fw} 140 Q${80 + fw} 70 80 70 Q${80 - fw} 70 ${80 - fw} 140 Z`} fill={hair} />}
        <path d={`M${80 - eyeDX - 7} ${eyeY - 7} Q${80 - eyeDX} ${eyeY - 10} ${80 - eyeDX + 7} ${eyeY - 7}`} stroke={hair} strokeWidth="2.5" fill="none" />
        <path d={`M${80 + eyeDX - 7} ${eyeY - 7} Q${80 + eyeDX} ${eyeY - 10} ${80 + eyeDX + 7} ${eyeY - 7}`} stroke={hair} strokeWidth="2.5" fill="none" />
        <ellipse cx={80 - eyeDX} cy={eyeY} rx="4" ry="2.4" fill="#1a1410" />
        <ellipse cx={80 + eyeDX} cy={eyeY} rx="4" ry="2.4" fill="#1a1410" />
        {old && <><path d={`M${80 - eyeDX - 6} ${eyeY + 6} q6 3 12 0`} stroke="#00000044" fill="none" /><path d={`M${80 + eyeDX - 6} ${eyeY + 6} q6 3 12 0`} stroke="#00000044" fill="none" /></>}
        <path d={`M80 ${eyeY + 2} L76 ${eyeY + 20} Q80 ${eyeY + 23} 84 ${eyeY + 20}`} stroke="#00000055" strokeWidth="1.6" fill="none" />
        <path d={`M71 ${eyeY + 32} Q80 ${eyeY + 35 + r() * 2} 89 ${eyeY + 32}`} stroke="#5a2e22" strokeWidth="2.2" fill="none" />
        {spec.mustache && <path d={`M68 ${eyeY + 28} Q80 ${eyeY + 22} 92 ${eyeY + 28} Q80 ${eyeY + 26} 68 ${eyeY + 28} Z`} fill={hair} stroke={hair} strokeWidth="2" />}
        {spec.beard && <path d={`M${80 - fw + 4} ${eyeY + 16} Q${80 - fw + 8} ${eyeY + 56} 80 ${eyeY + 50} Q${80 + fw - 8} ${eyeY + 56} ${80 + fw - 4} ${eyeY + 16} Q80 ${eyeY + 44} ${80 - fw + 4} ${eyeY + 16} Z`} fill={hair} opacity="0.9" />}
        {spec.glasses && <g stroke="#111" strokeWidth="1.6" fill="none"><circle cx={80 - eyeDX} cy={eyeY} r="8" /><circle cx={80 + eyeDX} cy={eyeY} r="8" /><path d={`M${80 - eyeDX + 8} ${eyeY} L${80 + eyeDX - 8} ${eyeY}`} /></g>}
      </g>
      <rect width="160" height="200" filter={`url(#${fid}-noise)`} />
      <rect x="1" y="1" width="158" height="198" fill="none" stroke="#00000033" strokeWidth="2" />
    </svg>
  );
}
