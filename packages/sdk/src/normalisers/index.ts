import type { NormalizedTrace, PartialNormalizedTrace } from '../types.js';
import { detectProvider } from './detect.js';
import { normaliseOpenAI } from './openai.js';
import { normaliseAnthropic } from './anthropic.js';
import { normaliseGemini } from './gemini.js';
import { OpenAIStreamNormaliser } from './streaming/openai.js';
import { AnthropicStreamNormaliser } from './streaming/anthropic.js';
import { GeminiStreamNormaliser } from './streaming/gemini.js';



export function normalise(response: unknown): NormalizedTrace {
  const provider = detectProvider(response);

  switch (provider) {
    case 'openai':    return normaliseOpenAI(response);
    case 'anthropic': return normaliseAnthropic(response);
    case 'gemini':    return normaliseGemini(response);
    default:
      
      return {
        model: 'unknown',
        provider: 'unknown',
        inputTokens: 0,
        outputTokens: 0,
        responseText: '',
        finishReason: 'unknown',
        rawResponse: response,
      };
  }
}



export type StreamNormaliser = {
  consume(chunk: unknown): void;
  finalise(): PartialNormalizedTrace;
};


export function createStreamNormaliser(firstChunk: unknown): StreamNormaliser {
  const provider = detectProvider(firstChunk);

  switch (provider) {
    case 'openai':    return new OpenAIStreamNormaliser();
    case 'anthropic': return new AnthropicStreamNormaliser();
    case 'gemini':    return new GeminiStreamNormaliser();
    default:
      
      return {
        consume: () => { /* no-op */ },
        finalise: (): PartialNormalizedTrace => ({
          provider: 'unknown',
          model: 'unknown',
          inputTokens: 0,
          outputTokens: 0,
          responseText: '',
          finishReason: 'unknown',
        }),
      };
  }
}