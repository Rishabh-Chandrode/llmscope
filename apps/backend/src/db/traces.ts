import { query } from '../db.js';

export type Trace = {
  id: string;
  appId: string;
  featureName: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: string;
  latencyMs: number;
  status: string;
  errorMessage: string | null;
  prompt: string | null;
  response: string | null;
  clientTimestamp: Date | null;
  receivedAt: Date;
  sdkVersion: string | null;
}

export type TraceQueryOptions = {
  appId: string;
  from?: Date;
  to?: Date;
  feature?: string;
  status?: string;
  limit: number;
  offset: number;
}

export async function findTraces(opts: TraceQueryOptions): Promise<{ traces: Trace[]; total: number }> {
  const conditions: string[] = ['app_id = $1'];
  const params: unknown[] = [opts.appId];
  let paramIndex = 2;

  if (opts.from) {
    conditions.push(`received_at >= $${paramIndex++}`);
    params.push(opts.from.toISOString());
  }
  if (opts.to) {
    conditions.push(`received_at <= $${paramIndex++}`);
    params.push(opts.to.toISOString());
  }
  if (opts.feature) {
    conditions.push(`feature_name = $${paramIndex++}`);
    params.push(opts.feature);
  }
  if (opts.status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(opts.status);
  }

  const where = conditions.join(' AND ');

  
  const countRows = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM traces WHERE ${where}`,
    params
  );
  const total = parseInt(countRows[0].count);

  
  const dataParams = [...params, opts.limit, opts.offset];
  const traces = await query<Trace>(
    `SELECT
       id, app_id AS "appId", feature_name AS "featureName",
       model, provider, input_tokens AS "inputTokens",
       output_tokens AS "outputTokens", cost_usd AS "costUsd",
       latency_ms AS "latencyMs", status, error_message AS "errorMessage",
       client_timestamp AS "clientTimestamp", received_at AS "receivedAt",
       sdk_version AS "sdkVersion"
     FROM traces
     WHERE ${where}
     ORDER BY received_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    dataParams
  );

  return { traces, total };
}

export async function findTraceById(id: string, appId: string): Promise<Trace | null> {
  
  const rows = await query<Trace>(
    `SELECT
       id, app_id AS "appId", feature_name AS "featureName",
       model, provider, input_tokens AS "inputTokens",
       output_tokens AS "outputTokens", cost_usd AS "costUsd",
       latency_ms AS "latencyMs", status, error_message AS "errorMessage",
       prompt, response,
       client_timestamp AS "clientTimestamp", received_at AS "receivedAt",
       sdk_version AS "sdkVersion"
     FROM traces
     WHERE id = $1 AND app_id = $2`,
    [id, appId]
  );
  return rows[0] ?? null;
}


export type OverviewMetrics = {
  totalCalls: number;
  totalCost: number;
  errorRate: number;
  avgLatencyMs: number;
  topFeatures: { name: string; calls: number; cost: string }[];
}

export async function getOverviewMetrics(appId: string): Promise<OverviewMetrics> {
  const summaryRows = await query<{
    total_calls: string;
    total_cost: string;
    failed_calls: string;
    avg_latency: string;
  }>(
    `SELECT
       COUNT(*) AS total_calls,
       SUM(cost_usd) AS total_cost,
       COUNT(*) FILTER (WHERE status = 'failed') AS failed_calls,
       AVG(latency_ms) AS avg_latency
     FROM traces
     WHERE app_id = $1
       AND received_at >= NOW() - INTERVAL '24 hours'`,
    [appId]
  );

  const s = summaryRows[0];
  const totalCalls = parseInt(s.total_calls) || 0;
  const failedCalls = parseInt(s.failed_calls) || 0;

  const topFeatureRows = await query<{ name: string; calls: string; cost: string }>(
    `SELECT
       feature_name AS name,
       COUNT(*) AS calls,
       SUM(cost_usd) AS cost
     FROM traces
     WHERE app_id = $1
       AND received_at >= NOW() - INTERVAL '24 hours'
     GROUP BY feature_name
     ORDER BY calls DESC
     LIMIT 10`,
    [appId]
  );

  return {
    totalCalls,
    totalCost: parseFloat(s.total_cost) || 0,
    errorRate: totalCalls > 0 ? (failedCalls / totalCalls) * 100 : 0,
    avgLatencyMs: parseFloat(s.avg_latency) || 0,
    topFeatures: topFeatureRows.map(r => ({
      name: r.name,
      calls: parseInt(r.calls),
      cost: r.cost,
    })),
  };
}


export async function getCostBreakdown(
  appId: string,
  from: Date,
  to: Date,
  groupBy: 'feature' | 'day' | 'model'
): Promise<{ group: string; totalCost: string; totalCalls: number }[]> {
  let groupExpr: string;
  let selectExpr: string;

  if (groupBy === 'feature') {
    groupExpr = 'feature_name';
    selectExpr = 'feature_name AS group';
  } else if (groupBy === 'model') {
    groupExpr = 'model';
    selectExpr = 'model AS group';
  } else {
    groupExpr = "date_trunc('day', received_at)";
    selectExpr = "date_trunc('day', received_at)::text AS group";
  }

  return query(
    `SELECT
       ${selectExpr},
       SUM(cost_usd) AS "totalCost",
       COUNT(*) AS "totalCalls"
     FROM traces
     WHERE app_id = $1
       AND received_at BETWEEN $2 AND $3
     GROUP BY ${groupExpr}
     ORDER BY "totalCost" DESC`,
    [appId, from.toISOString(), to.toISOString()]
  );
}


export async function getLatencyMetrics(
  appId: string,
  from: Date,
  to: Date,
  feature?: string
): Promise<{ hourBucket: string; p50: string; p95: string; p99: string }[]> {
  const params: unknown[] = [appId, from.toISOString(), to.toISOString()];
  let featureClause = '';

  if (feature) {
    params.push(feature);
    featureClause = `AND feature_name = $${params.length}`;
  }

  return query(
    `SELECT
       hour_bucket AS "hourBucket",
       p50_latency_ms AS p50,
       p95_latency_ms AS p95,
       p99_latency_ms AS p99
     FROM hourly_metrics
     WHERE app_id = $1
       AND hour_bucket BETWEEN $2 AND $3
       ${featureClause}
     ORDER BY hour_bucket ASC`,
    params
  );
}


export async function getVolumeMetrics(
  appId: string,
  from: Date,
  to: Date,
  feature?: string
): Promise<{ hourBucket: string; totalCalls: number; failedCalls: number }[]> {
  const params: unknown[] = [appId, from.toISOString(), to.toISOString()];
  let featureClause = '';

  if (feature) {
    params.push(feature);
    featureClause = `AND feature_name = $${params.length}`;
  }

  return query(
    `SELECT
       hour_bucket AS "hourBucket",
       total_calls AS "totalCalls",
       failed_calls AS "failedCalls"
     FROM hourly_metrics
     WHERE app_id = $1
       AND hour_bucket BETWEEN $2 AND $3
       ${featureClause}
     ORDER BY hour_bucket ASC`,
    params
  );
}