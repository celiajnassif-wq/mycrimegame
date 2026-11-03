// Anthropic streaming call for interrogations. The key never leaves this process.
import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 60_000 });
  return client;
}

export const MODEL = () => process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';

export interface StreamArgs {
  staticSystem: string;
  turnNote: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  onText: (t: string) => void;
  signal?: AbortSignal;
}

/** Streams a reply. Resolves with the stop reason. Throws on API failure. */
export async function streamReply(a: StreamArgs): Promise<string> {
  const params = {
    model: MODEL(),
    max_tokens: 1200,
    // static persona is cached; the per-turn note sits after the breakpoint
    system: [
      { type: 'text' as const, text: a.staticSystem, cache_control: { type: 'ephemeral' as const } },
      { type: 'text' as const, text: a.turnNote },
    ],
    messages: a.messages,
    output_config: { effort: 'low' as const },
  };
  const useFallbacks = process.env.AI_FALLBACKS !== '0';
  const stream = useFallbacks
    ? getClient().beta.messages.stream(
        // server-side fallback routes a refused request to another model instead of failing the turn
        { ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } as unknown as Parameters<Anthropic['beta']['messages']['stream']>[0],
        { signal: a.signal },
      )
    : getClient().messages.stream(params as unknown as Parameters<Anthropic['messages']['stream']>[0], { signal: a.signal });
  for await (const event of stream as AsyncIterable<{ type: string; delta?: { type: string; text?: string } }>) {
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) a.onText(event.delta.text);
  }
  const final = await (stream as unknown as { finalMessage: () => Promise<{ stop_reason: string | null }> }).finalMessage();
  return final.stop_reason ?? 'end_turn';
}
