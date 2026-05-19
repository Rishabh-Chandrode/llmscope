import type { NormalizedTrace } from '../types.js';

type GeminiFinishReason = 'STOP' | 'MAX_TOKENS' | string;

function mapFinishReason(reason: GeminiFinishReason): NormalizedTrace['finishReason'] {
  if (reason === 'STOP') return 'stop';
  if (reason === 'MAX_TOKENS') return 'length';
  return 'unknown';
}

export function normaliseGemini(response: unknown): NormalizedTrace {
  const r = response as Record<string, unknown>;

  const usageMetadata = r['usageMetadata'] as Record<string, unknown> | undefined;
  const candidates = r['candidates'] as Array<Record<string, unknown>> | undefined;
  const firstCandidate = candidates?.[0];
  const content = firstCandidate?.['content'] as Record<string, unknown> | undefined;
  const parts = content?.['parts'] as Array<Record<string, unknown>> | undefined;

  const responseText = parts?.map(p => p['text'] as string).join('') ?? '';
  const finishReason = firstCandidate?.['finishReason'] as string ?? 'unknown';

  return {
    model: 'gemini', // Gemini does not return model name in response body
    provider: 'gemini',
    inputTokens: (usageMetadata?.['promptTokenCount'] as number) ?? 0,
    outputTokens: (usageMetadata?.['candidatesTokenCount'] as number) ?? 0,
    responseText,
    finishReason: mapFinishReason(finishReason),
    rawResponse: response,
  };
}