// Text anchoring for highlights. Highlights are stored as character offsets into the document's
// visible text, and painted with the CSS Custom Highlight API so React's DOM is never touched.
import type { DocHighlight, HighlightColor } from '../store';

export const COLORS: { id: HighlightColor; label: string }[] = [
  { id: 'yellow', label: 'Yellow' },
  { id: 'pink', label: 'Pink' },
  { id: 'green', label: 'Green' },
  { id: 'blue', label: 'Blue' },
];

export const supportsPainting = () => typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';

/** Text nodes that count as document text (controls, drawings and inputs are skipped). */
export function textNodes(root: Node): Text[] {
  const out: Text[] = [];
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => ((n.parentElement?.closest('button, svg, textarea, input, .no-hl')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = w.nextNode(); n; n = w.nextNode()) out.push(n as Text);
  return out;
}

function pointToOffset(nodes: Text[], container: Node, offset: number): number | null {
  if (container.nodeType === Node.TEXT_NODE) {
    let acc = 0;
    for (const n of nodes) { if (n === container) return acc + offset; acc += n.length; }
    return null;
  }
  const boundary = document.createRange();
  boundary.setStart(container, offset);
  let acc = 0;
  for (const n of nodes) {
    const r = document.createRange();
    r.selectNode(n);
    if (boundary.compareBoundaryPoints(Range.START_TO_START, r) <= 0) return acc;
    acc += n.length;
  }
  return acc;
}

export function rangeToAnchor(root: Node, range: Range): { start: number; end: number; text: string } | null {
  const nodes = textNodes(root);
  const s = pointToOffset(nodes, range.startContainer, range.startOffset);
  const e = pointToOffset(nodes, range.endContainer, range.endOffset);
  if (s === null || e === null || e <= s) return null;
  const full = nodes.map((n) => n.data).join('');
  let start = s, end = e;
  while (start < end && /\s/.test(full[start])) start++; // trim whitespace at the edges
  while (end > start && /\s/.test(full[end - 1])) end--;
  if (end - start < 2) return null;
  return { start, end, text: full.slice(start, end) };
}

export function anchorToRange(root: Node, h: Pick<DocHighlight, 'start' | 'end' | 'text'>): Range | null {
  const nodes = textNodes(root);
  const full = nodes.map((n) => n.data).join('');
  let start = h.start;
  if (full.slice(start, start + h.text.length) !== h.text) {
    // the layout changed (a translation toggled, a seal broken): find the nearest copy of the text
    let best = -1, bestD = Infinity;
    for (let i = full.indexOf(h.text); i >= 0; i = full.indexOf(h.text, i + 1)) {
      const d = Math.abs(i - h.start);
      if (d < bestD) { best = i; bestD = d; }
    }
    if (best < 0) return null;
    start = best;
  }
  const end = start + h.text.length;
  const r = document.createRange();
  let acc = 0, setStart = false;
  for (const n of nodes) {
    const next = acc + n.length;
    if (!setStart && start < next) { r.setStart(n, start - acc); setStart = true; }
    if (setStart && end <= next) { r.setEnd(n, end - acc); return r; }
    acc = next;
  }
  return null;
}
