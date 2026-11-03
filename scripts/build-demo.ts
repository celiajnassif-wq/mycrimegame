// Packs the static prototype (vite --mode demo) into one self-contained HTML page.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'dist-demo/assets';
const files = readdirSync(dir);
const js = files.filter((f) => f.endsWith('.js'));
const css = files.filter((f) => f.endsWith('.css'));
if (js.length !== 1) throw new Error(`expected one JS chunk, found ${js.length}`);
const script = readFileSync(join(dir, js[0]), 'utf8').replace(/<\/script/gi, '<\\/script');
const style = css.map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
const fonts = readFileSync('index.html', 'utf8').match(/<link href="https:\/\/fonts\.googleapis\.com[^>]+>/)?.[0] ?? '';

const page = `<title>The Karalis File</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="theme-color" content="#2a1a10">
${fonts}
<style>
:root { color-scheme: dark; }
${style}
</style>
<div id="root"></div>
<script type="module">
${script}
</script>
`;
const out = process.argv[2] ?? 'dist-demo/dossiers-prototype.html';
writeFileSync(out, page);
console.log(`wrote ${out} (${(page.length / 1024).toFixed(0)} KB)`);
