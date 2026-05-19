import { redis } from '../redis.js';
import { query } from '../db.js';
import { calculateCost } from '../services/cost.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

type BufferedTrace  = {
  traceId: string;
  appId: string;
  featureName: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  status: string;
  errorMessage?: string;
  prompt?: string;
  response?: string;
  clientTimestamp: number;
  receivedAt: number;
  sdkVersion?: string;
}

async function flushTracesToPostgres(): Promise<void> {
  const bufferSize = await redis.llen('traces:buffer');
  if (bufferSize === 0) return;

  const batchSize = config.redisBufferBatchSize;

  
  
  
  const pipeline = redis.pipeline();
  pipeline.lrange('traces:buffer', 0, batchSize - 1);
  pipeline.ltrim('traces:buffer', batchSize, -1);
  const results = await pipeline.exec();

  if (!results) return;

  const rawTraces = results[0][1] as string[];
  if (!rawTraces || rawTraces.length === 0) return;

  const traces: BufferedTrace[] = rawTraces.map(raw => JSON.parse(raw));

  
  const values: unknown[] = [];
  const placeholders = traces.map((trace, i) => {
    //update this logic if trace table structure is updated
    const base = i * 14;
    const costUsd = calculateCost(trace.model, trace.inputTokens, trace.outputTokens);
    values.push(
      trace.traceId,
      trace.appId,
      trace.featureName,
      trace.model,
      trace.provider,
      trace.inputTokens,
      trace.outputTokens,
      costUsd,
      trace.latencyMs,
      trace.status,
      trace.errorMessage ?? null,
      trace.prompt ?? null,
      trace.response ?? null,
      new Date(trace.receivedAt).toISOString(),
    );
    return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10},$${base+11},$${base+12},$${base+13},$${base+14})`;
  });

  const insertSQL = `
    INSERT INTO traces (
      id, app_id, feature_name, model, provider,
      input_tokens, output_tokens, cost_usd, latency_ms, status,
      error_message, prompt, response, received_at
    ) VALUES ${placeholders.join(',')}
    ON CONFLICT (id) DO NOTHING
  `;

  try {
    await query(insertSQL, values);
    logger.debug({ count: traces.length }, 'FlushJob: traces written to PostgreSQL');
  } catch (err) {
    console.log(values);
    
    logger.error({ err }, 'FlushJob: Postgres insert failed — re-queuing traces');
    const repushPipeline = redis.pipeline();
    rawTraces.forEach(raw => repushPipeline.rpush('traces:buffer', raw));
    await repushPipeline.exec();
  }
}

export function startFlushJob(): void {
  logger.info({ intervalMs: config.flushIntervalMs }, 'FlushJob started');

  setInterval(async () => {
    const startTime = Date.now();
    try {
      await flushTracesToPostgres();
      logger.debug({ durationMs: Date.now() - startTime }, 'FlushJob cycle complete');
    } catch (err) {
      
      logger.error({ err, durationMs: Date.now() - startTime }, 'FlushJob cycle failed');
    }
  }, config.flushIntervalMs);
}