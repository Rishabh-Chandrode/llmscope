export type Provider = 'openai' | 'anthropic' | 'gemini' | 'unknown';

export function detectProvider(response: unknown): Provider {
  if (!response || typeof response !== 'object') return 'unknown';

  const r = response as Record<string, unknown>;

  // Anthropic streaming chunks — must check BEFORE non-streaming Anthropic
  // because streaming chunks have a 'type' field but no top-level content[]
  if (typeof r['type'] === 'string') {
    const t = r['type'];
    if (
      t === 'message_start' ||
      t === 'content_block_start' ||
      t === 'content_block_delta' ||
      t === 'content_block_stop' ||
      t === 'message_delta' ||
      t === 'message_stop'
    ) return 'anthropic';
  }

  // OpenAI: has choices array (non-streaming and streaming)
  if (Array.isArray(r['choices'])) return 'openai';

  // Anthropic non-streaming: has content array AND stop_reason
  if (Array.isArray(r['content']) && 'stop_reason' in r) return 'anthropic';

  // Gemini: has candidates array AND usageMetadata
  if (Array.isArray(r['candidates']) && 'usageMetadata' in r) return 'gemini';

  return 'unknown';
}