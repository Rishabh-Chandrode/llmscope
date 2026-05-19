import { Router, Request, Response } from 'express';
import { Registry, Counter, Gauge, Histogram, collectDefaultMetrics } from 'prom-client';
import { redis } from '../redis.js';
import { logger } from '../logger.js';

// Create a single registry for all metrics
export const metricsRegistry = new Registry();

// Collect default Node.js metrics (CPU, memory, event loop lag)
collectDefaultMetrics({ register: metricsRegistry });

// ── Custom metrics ────────────────────────────────────────────────────────────

export const tracesIngestedTotal = new Counter({
  name: 'traces_ingested_total',
  help: 'Total number of traces received at POST /ingest',
  registers: [metricsRegistry],
});

export const tracesFlushedTotal = new Counter({
  name: 'traces_flushed_total',
  help: 'Total number of traces successfully written to PostgreSQL',
  registers: [metricsRegistry],
});

export const redisBufferSize = new Gauge({
  name: 'redis_buffer_size',
  help: 'Current number of items in the Redis traces buffer',
  registers: [metricsRegistry],
});

export const flushDurationMs = new Histogram({
  name: 'flush_duration_ms',
  help: 'Time taken for each flush job cycle in milliseconds',
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000],
  registers: [metricsRegistry],
});

export const ingestHttpDurationMs = new Histogram({
  name: 'ingest_http_duration_ms',
  help: 'HTTP response time for POST /ingest in milliseconds',
  buckets: [1, 2, 5, 10, 25, 50, 100],
  registers: [metricsRegistry],
});

export const alertEvaluationsTotal = new Counter({
  name: 'alert_evaluations_total',
  help: 'Total number of alert rule evaluation cycles run',
  registers: [metricsRegistry],
});

export const alertsFiredTotal = new Counter({
  name: 'alerts_fired_total',
  help: 'Total number of alerts fired (threshold breached)',
  registers: [metricsRegistry],
});

// ── Poll Redis buffer size every 15 seconds ───────────────────────────────────

export function startMetricsPolling(): void {
  setInterval(async () => {
    try {
      const size = await redis.llen('traces:buffer');
      redisBufferSize.set(size);
    } catch (err) {
      logger.debug({ err }, 'Metrics: Redis buffer poll failed');
    }
  }, 15_000);
}

// ── Route ─────────────────────────────────────────────────────────────────────

export const metricsRouter : Router = Router();

// No auth required — Prometheus scrapes this endpoint
metricsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const output = await metricsRegistry.metrics();
    res.set('Content-Type', metricsRegistry.contentType);
    res.send(output);
  } catch (err) {
    logger.error({ err }, 'GET /metrics failed');
    res.status(500).send('# Metrics unavailable');
  }
});