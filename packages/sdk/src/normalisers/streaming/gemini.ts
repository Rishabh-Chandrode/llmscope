import type { PartialNormalizedTrace } from '../../types.js';

export class GeminiStreamNormaliser {
  private text = '';
  private inputTokens = 0;
  private outputTokens = 0;
  private finishReason: PartialNormalizedTrace['finishReason'] = 'unknown';

  consume(chunk: unknown): void {
    if (!chunk || typeof chunk !== 'object') return;
    const c = chunk as Record<string, unknown>;

    
    const candidates = c['candidates'] as Array<Record<string, unknown>> | undefined;
    const firstCandidate = candidates?.[0];
    const content = firstCandidate?.['content'] as Record<string, unknown> | undefined;
    const parts = content?.['parts'] as Array<Record<string, unknown>> | undefined;

    if (parts) {
      this.text += parts.map(p => p['text'] as string ?? '').join('');
    }

    
    const finishReason = firstCandidate?.['finishReason'] as string | undefined;
    if (finishReason === 'STOP') this.finishReason = 'stop';
    else if (finishReason === 'MAX_TOKENS') this.finishReason = 'length';

    
    const usageMetadata = c['usageMetadata'] as Record<string, unknown> | undefined;
    if (usageMetadata) {
      this.inputTokens = (usageMetadata['promptTokenCount'] as number) ?? 0;
      this.outputTokens = (usageMetadata['candidatesTokenCount'] as number) ?? 0;
    }
  }

  finalise(): PartialNormalizedTrace {
    return {
      model: 'gemini',
      provider: 'gemini',
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      responseText: this.text,
      finishReason: this.finishReason,
    };
  }
}