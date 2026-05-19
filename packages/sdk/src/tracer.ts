import type { TracerConfig, TraceMetadata, TracePayload } from './types.js';
import { Transport } from './transport.js';
import { normalise, createStreamNormaliser } from './normalisers/index.js';

const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_TIMEOUT = 5000;
const SDK_VERSION = '0.1.0';

export class LLMTracer {
  private readonly transport: Transport;
  private readonly config: Required<TracerConfig>;

  constructor(config: TracerConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
      capturePrompts: config.capturePrompts ?? false,
      captureResponses: config.captureResponses ?? false,
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
    };

    this.transport = new Transport({
      apiKey: this.config.apiKey,
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout,
    });
  }


  async trace<T>(
    featureName: string,
    fn: () => Promise<T>,
    metadata?: TraceMetadata
  ): Promise<T> {
    const startTime = Date.now();
    let response: T;

    try {
      response = await fn();
    } catch (err) {
      // Capture the error and fire a failed trace — then re-throw
      const latencyMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);

      const payload: TracePayload = {
        featureName,
        model: 'unknown',
        provider: 'unknown',
        inputTokens: 0,
        outputTokens: 0,
        latencyMs,
        status: 'failed',
        errorMessage,
        clientTimestamp: startTime,
        sdkVersion: SDK_VERSION,
        metadata,
      };

      this.transport.send(payload);

      throw err;
    }

    const latencyMs = Date.now() - startTime;

    const normalized = normalise(response);

    const payload: TracePayload = {
      featureName,
      model: normalized.model,
      provider: normalized.provider,
      inputTokens: normalized.inputTokens,
      outputTokens: normalized.outputTokens,
      latencyMs,
      status: 'success',
      clientTimestamp: startTime,
      sdkVersion: SDK_VERSION,
      metadata,
      ...(this.config.captureResponses && {
        response: normalized.responseText,
      }),
    };

    this.transport.send(payload);
    return response;
  }

  async traceStream<T>(
    featureName: string,
    fn: () => Promise<AsyncIterable<T>>,
    metadata?: TraceMetadata
  ): Promise<AsyncGenerator<T>> {
    const startTime = Date.now();
    let stream: AsyncIterable<T>;

    try {
      stream = await fn();
    } catch (err) {
      // fn() itself threw before returning a stream — fire failed trace
      const latencyMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);

      this.transport.send({
        featureName,
        model: 'unknown',
        provider: 'unknown',
        inputTokens: 0,
        outputTokens: 0,
        latencyMs,
        status: 'failed',
        errorMessage,
        clientTimestamp: startTime,
        sdkVersion: SDK_VERSION,
        metadata,
      });

      throw err;
    }

    // Return an async generator that passes chunks through unchanged
    // while feeding them to the stream normaliser
    const transport = this.transport;
    const config = this.config;

    async function* tracingGenerator(): AsyncGenerator<T> {
      let normaliser: ReturnType<typeof createStreamNormaliser> | null = null;
      let firstChunk = true;

      try {
        for await (const chunk of stream) {
          // Detect provider from first chunk and create the right normaliser
          if (firstChunk) {
            normaliser = createStreamNormaliser(chunk);
            firstChunk = false;
          }

          // Feed chunk to normaliser (accumulates text and token counts)
          normaliser?.consume(chunk);

          // Yield chunk unchanged — developer gets exactly what the provider sent
          yield chunk;
        }

        // Stream finished normally — fire success trace
        const latencyMs = Date.now() - startTime;
        const partial = normaliser?.finalise() ?? {};

        transport.send({
          featureName,
          model: partial.model ?? 'unknown',
          provider: partial.provider ?? 'unknown',
          inputTokens: partial.inputTokens ?? 0,
          outputTokens: partial.outputTokens ?? 0,
          latencyMs,
          status: 'success',
          clientTimestamp: startTime,
          sdkVersion: SDK_VERSION,
          metadata,
          ...(config.captureResponses && {
            response: partial.responseText ?? '',
          }),
        });

      } catch (err) {
        // Stream threw mid-way — fire failed trace
        const latencyMs = Date.now() - startTime;
        const errorMessage = err instanceof Error ? err.message : String(err);

        transport.send({
          featureName,
          model: 'unknown',
          provider: 'unknown',
          inputTokens: 0,
          outputTokens: 0,
          latencyMs,
          status: 'failed',
          errorMessage,
          clientTimestamp: startTime,
          sdkVersion: SDK_VERSION,
          metadata,
        });

        throw err;
      }
    }

    return tracingGenerator();
  }
}