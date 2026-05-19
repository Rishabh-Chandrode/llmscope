import type { NormalizedTrace } from '../types.js';

type OpenAIFinishReason = 'stop' | 'length' | 'content_filter' | string;

function mapFinishReason(reason: OpenAIFinishReason): NormalizedTrace['finishReason'] {
  if (reason === 'stop') return 'stop';
  if (reason === 'length') return 'length';
  if (reason === 'content_filter') return 'error';
  return 'unknown';
}

export function normaliseOpenAI(response: unknown): NormalizedTrace {
  const r = response as Record<string, unknown>;

  const usage = r['usage'] as Record<string, unknown> | undefined;
  const choices = r['choices'] as Array<Record<string, unknown>> | undefined;
  const firstChoice = choices?.[0];
  const message = firstChoice?.['message'] as Record<string, unknown> | undefined;
  const finishReason = firstChoice?.['finish_reason'] as string ?? 'unknown';

  return {
    model: (r['model'] as string) ?? 'unknown',
    provider: 'openai',
    inputTokens: (usage?.['prompt_tokens'] as number) ?? 0,
    outputTokens: (usage?.['completion_tokens'] as number) ?? 0,
    responseText: (message?.['content'] as string) ?? '',
    finishReason: mapFinishReason(finishReason),
    rawResponse: response,
  };
}