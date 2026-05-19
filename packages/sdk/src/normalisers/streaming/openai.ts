import type { PartialNormalizedTrace } from '../../types.js';

export class OpenAIStreamNormaliser {
  private text = '';
  private model = 'unknown';
  private inputTokens = 0;
  private outputTokens = 0;
  private finishReason: PartialNormalizedTrace['finishReason'] = 'unknown';

  consume(chunk: unknown): void {
    if (!chunk || typeof chunk !== 'object') return;
    const c = chunk as Record<string, unknown>;

    
    if (typeof c['model'] === 'string') {
      this.model = c['model'];
    }

    
    const choices = c['choices'] as Array<Record<string, unknown>> | undefined;
    const delta = choices?.[0]?.['delta'] as Record<string, unknown> | undefined;
    if (typeof delta?.['content'] === 'string') {
      this.text += delta['content'];
    }

    
    const finishReason = choices?.[0]?.['finish_reason'];
    if (finishReason === 'stop') this.finishReason = 'stop';
    else if (finishReason === 'length') this.finishReason = 'length';
    else if (finishReason === 'content_filter') this.finishReason = 'error';

    
    const usage = c['usage'] as Record<string, unknown> | undefined;
    if (usage) {
      this.inputTokens = (usage['prompt_tokens'] as number) ?? 0;
      this.outputTokens = (usage['completion_tokens'] as number) ?? 0;
    }
  }

  finalise(): PartialNormalizedTrace {
    return {
      model: this.model,
      provider: 'openai',
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      responseText: this.text,
      finishReason: this.finishReason,
    };
  }
}