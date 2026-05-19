import { query } from '../db.js';
import { config } from '../config.js';
import { logger } from '../logger.js';



async function runAggregation(): Promise<void> {
  const sql = `
    INSERT INTO hourly_metrics (
      app_id, feature_name, hour_bucket,
      total_calls, failed_calls, total_cost_usd,
      total_input_tokens, total_output_tokens,
      avg_latency_ms, p95_latency_ms, p99_latency_ms
    )
    SELECT
      app_id,
      feature_name,
      date_trunc('hour', received_at) AS hour_bucket,
      COUNT(*)                                                            AS total_calls,
      COUNT(*) FILTER (WHERE status = 'failed')                          AS failed_calls,
      SUM(cost_usd)                                                       AS total_cost_usd,
      SUM(input_tokens)                                                   AS total_input_tokens,
      SUM(output_tokens)                                                  AS total_output_tokens,
      AVG(latency_ms)                                                     AS avg_latency_ms,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)           AS p95_latency_ms,
      PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms)           AS p99_latency_ms
    FROM traces
    WHERE received_at >= date_trunc('hour', NOW() - INTERVAL '1 hour')
      AND received_at <  date_trunc('hour', NOW())
    GROUP BY app_id, feature_name, date_trunc('hour', received_at)
    ON CONFLICT (app_id, feature_name, hour_bucket)
    DO UPDATE SET
      total_calls        = EXCLUDED.total_calls,
      failed_calls       = EXCLUDED.failed_calls,
      total_cost_usd     = EXCLUDED.total_cost_usd,
      total_input_tokens = EXCLUDED.total_input_tokens,
      total_output_tokens= EXCLUDED.total_output_tokens,
      avg_latency_ms     = EXCLUDED.avg_latency_ms,
      p95_latency_ms     = EXCLUDED.p95_latency_ms,
      p99_latency_ms     = EXCLUDED.p99_latency_ms,
      computed_at        = NOW();
  `;

  await query(sql);
  logger.info('AggregateJob: hourly rollup complete');
}

export function startAggregateJob(): void {
  logger.info({ intervalMs: config.aggregateIntervalMs }, 'AggregateJob started');

  
  runAggregation().catch((err) => {
    logger.error({ err }, 'AggregateJob: initial run failed');
  });

  setInterval(async () => {
    try {
      await runAggregation();
    } catch (err) {
      
      logger.error({ err }, 'AggregateJob: cycle failed');
    }
  }, config.aggregateIntervalMs);
}