import type { TracePayload } from './types.js';

const SDK_VERSION = '0.1.0';

type TransportConfig = {
  apiKey: string;
  baseUrl: string;
  timeout: number;
};

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 200; 

async function sendWithRetry(
  url: string,
  payload: TracePayload,
  config: TransportConfig,
  attempt: number = 0
): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok && attempt < MAX_RETRIES - 1) {
      const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt);
      await sleep(backoff);
      return sendWithRetry(url, payload, config, attempt + 1);
    }
  } catch (err) {
    if (attempt < MAX_RETRIES - 1) {
      const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt);
      await sleep(backoff);
      return sendWithRetry(url, payload, config, attempt + 1);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class Transport {
  private readonly url: string;
  private readonly config: TransportConfig;

  constructor(config: TransportConfig) {
    this.config = config;
    this.url = `${config.baseUrl}/ingest`;
  }

  
  send(payload: TracePayload): void {
    const payloadWithVersion: TracePayload = {
      ...payload,
      sdkVersion: SDK_VERSION,
    };
    sendWithRetry(this.url, payloadWithVersion, this.config).catch(() => {});
  }
}