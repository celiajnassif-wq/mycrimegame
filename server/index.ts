import 'dotenv/config';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync, readFileSync } from 'node:fs';
import { app } from './app';

if (process.env.NODE_ENV === 'production' && existsSync('dist/index.html')) {
  app.use('/assets/*', serveStatic({ root: './dist' }));
  const html = readFileSync('dist/index.html', 'utf8');
  app.get('*', (c) => c.html(html));
}

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, () => {
  const mode = process.env.MOCK_AI === '1' || !process.env.ANTHROPIC_API_KEY ? 'MOCK (scripted replies)' : `live (${process.env.CLAUDE_MODEL || 'claude-sonnet-5-5'})`;
  console.log(`Dossiers server on http://localhost:${port}  AI: ${mode}`);
});
