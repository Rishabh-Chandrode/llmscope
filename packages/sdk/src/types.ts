// ── Normalised output shape ───────────────────────────────────────────────────
// Every provider normaliser must output this exact shape.
// The rest of the SDK never looks at provider-specific response fields.

export type NormalizedTrace = {
  model: string;
  provider: 'openai' | 'anthropic' | 'gemini' | 'unknown';
  inputTokens: number;
  outputTokens: number;
  responseText: string;
  finishReason: 'stop' | 'length' | 'error' | 'unknown';
  rawResponse: unknown; // original provider response, stored as-is
};

// ── What the SDK sends to POST /ingest ───────────────────────────────────────

export type TracePayload = {
  featureName: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  status: 'success' | 'failed' | 'timeout';
  errorMessage?: string;
  prompt?: string;
  response?: string;
  clientTimestamp: number; // Date.now() from the SDK
  sdkVersion: string;
  metadata?: Record<string, unknown>;
};

// ── Config passed to new LLMTracer(config) ────────────────────────────────────

export type TracerConfig = {
  apiKey: string;
  baseUrl?: string;           // defaults to http://localhost:3000
  capturePrompts?: boolean;   // default false
  captureResponses?: boolean; // default false
  timeout?: number;           // HTTP timeout ms, default 5000
};

// ── Optional metadata developer can pass to trace() ──────────────────────────

export type TraceMetadata = {
  userId?: string;
  sessionId?: string;
  environment?: string;
  [key: string]: unknown;
};

// ── Partial normalised trace — returned by streaming normalisers ──────────────
// Streaming normalisers accumulate data chunk by chunk.
// finalise() returns only what was successfully collected.

export type PartialNormalizedTrace = Partial<NormalizedTrace>;