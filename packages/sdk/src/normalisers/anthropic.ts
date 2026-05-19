import type { NormalizedTrace } from '../types.js';

type AnthropicFinishReason = 'end_turn' | 'max_tokens' | string;

function mapFinishReason(reason: AnthropicFinishReason): NormalizedTrace['finishReason'] {
  if (reason === 'end_turn') return 'stop';
  if (reason === 'max_tokens') return 'length';
  return 'unknown';
}

export function normaliseAnthropic(response: unknown): NormalizedTrace {
  const r = response as Record<string, unknown>;

  const usage = r['usage'] as Record<string, unknown> | undefined;
  const content = r['content'] as Array<Record<string, unknown>> | undefined;

  // Anthropic returns content as an array of blocks — filter for text blocks only
  const responseText = content
    ?.filter(block => block['type'] === 'text')
    .map(block => block['text'] as string)
    .join('') ?? '';

  const stopReason = r['stop_reason'] as string ?? 'unknown';

  return {
    model: (r['model'] as string) ?? 'unknown',
    provider: 'anthropic',
    inputTokens: (usage?.['input_tokens'] as number) ?? 0,
    outputTokens: (usage?.['output_tokens'] as number) ?? 0,
    responseText,
    finishReason: mapFinishReason(stopReason),
    rawResponse: response,
  };
}