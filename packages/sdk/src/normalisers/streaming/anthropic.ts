import type { PartialNormalizedTrace } from '../../types.js';

export class AnthropicStreamNormaliser {
  private text = '';
  private model = 'unknown';
  private inputTokens = 0;
  private outputTokens = 0;
  private finishReason: PartialNormalizedTrace['finishReason'] = 'unknown';

  consume(chunk: unknown): void {
    if (!chunk || typeof chunk !== 'object') return;
    const c = chunk as Record<string, unknown>;

    const chunkType = c['type'] as string | undefined;

    
    if (chunkType === 'message_start') {
      const message = c['message'] as Record<string, unknown> | undefined;
      if (typeof message?.['model'] === 'string') {
        this.model = message['model'];
      }
      const usage = message?.['usage'] as Record<string, unknown> | undefined;
      if (usage) {
        this.inputTokens = (usage['input_tokens'] as number) ?? 0;
      }
    }

    
    if (chunkType === 'content_block_delta') {
      const delta = c['delta'] as Record<string, unknown> | undefined;
      if (delta?.['type'] === 'text_delta' && typeof delta['text'] === 'string') {
        this.text += delta['text'];
      }
    }

    
    if (chunkType === 'message_delta') {
      const delta = c['delta'] as Record<string, unknown> | undefined;
      const stopReason = delta?.['stop_reason'] as string | undefined;
      if (stopReason === 'end_turn') this.finishReason = 'stop';
      else if (stopReason === 'max_tokens') this.finishReason = 'length';

      const usage = c['usage'] as Record<string, unknown> | undefined;
      if (usage) {
        this.outputTokens = (usage['output_tokens'] as number) ?? 0;
      }
    }
  }

  finalise(): PartialNormalizedTrace {
    return {
      model: this.model,
      provider: 'anthropic',
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      responseText: this.text,
      finishReason: this.finishReason,
    };
  }
}