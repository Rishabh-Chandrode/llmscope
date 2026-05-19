import { redis } from '../redis.js';
import { query } from '../db.js';
import { findAllActiveAlertRules, AlertRule } from '../db/alerts.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { alertEvaluationsTotal, alertsFiredTotal } from '../routes/matrics.js';

const COOLDOWN_SECONDS = 1800; // 30 minutes between repeated alerts for same rule

// ── Metric queries ────────────────────────────────────────────────────────────

async function queryDailyCost(appId: string, windowMinutes: number, featureName?: string | null): Promise<number> {
  const params: unknown[] = [appId, windowMinutes];
  let featureClause = '';

  if (featureName) {
    params.push(featureName);
    featureClause = `AND feature_name = $${params.length}`;
  }

  const rows = await query<{ total: string }>(
    `SELECT COALESCE(SUM(cost_usd), 0) AS total
     FROM traces
     WHERE app_id = $1
       AND received_at >= NOW() - ($2 || ' minutes')::INTERVAL
       ${featureClause}`,
    params
  );

  return parseFloat(rows[0].total);
}

async function queryErrorRate(appId: string, windowMinutes: number, featureName?: string | null): Promise<number> {
  const params: unknown[] = [appId, windowMinutes];
  let featureClause = '';

  if (featureName) {
    params.push(featureName);
    featureClause = `AND feature_name = $${params.length}`;
  }

  const rows = await query<{ total: string; failed: string }>(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status = 'failed') AS failed
     FROM traces
     WHERE app_id = $1
       AND received_at >= NOW() - ($2 || ' minutes')::INTERVAL
       ${featureClause}`,
    params
  );

  const total = parseInt(rows[0].total);
  if (total === 0) return 0;
  return (parseInt(rows[0].failed) / total) * 100;
}

async function queryP95Latency(appId: string, windowMinutes: number, featureName?: string | null): Promise<number> {
  const params: unknown[] = [appId, windowMinutes];
  let featureClause = '';

  if (featureName) {
    params.push(featureName);
    featureClause = `AND feature_name = $${params.length}`;
  }

  const rows = await query<{ p95: string | null }>(
    `SELECT PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95
     FROM traces
     WHERE app_id = $1
       AND received_at >= NOW() - ($2 || ' minutes')::INTERVAL
       ${featureClause}`,
    params
  );

  return parseFloat(rows[0].p95 ?? '0');
}

// ── Webhook firing ────────────────────────────────────────────────────────────

async function fireWebhook(
  rule: AlertRule,
  currentValue: number
): Promise<boolean> {
  try {
    const payload = {
      ruleId: rule.id,
      appId: rule.appId,
      metric: rule.metric,
      currentValue,
      threshold: parseFloat(rule.threshold),
      featureName: rule.featureName,
      firedAt: new Date().toISOString(),
    };

    const response = await fetch(rule.notifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000), // 10 second timeout
    });

    return response.ok;
  } catch (err) {
    logger.warn({ err, ruleId: rule.id }, 'AlertJob: webhook delivery failed');
    return false;
  }
}

// ── Record alert event in DB ──────────────────────────────────────────────────

async function recordAlertEvent(
  rule: AlertRule,
  currentValue: number,
  notifiedSuccessfully: boolean
): Promise<void> {
  await query(
    `INSERT INTO alert_events (rule_id, app_id, metric, current_value, threshold, notify_url, notified_successfully)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      rule.id,
      rule.appId,
      rule.metric,
      currentValue,
      parseFloat(rule.threshold),
      rule.notifyUrl,
      notifiedSuccessfully,
    ]
  );
}

// ── Evaluate a single rule ────────────────────────────────────────────────────

async function evaluateRule(rule: AlertRule): Promise<void> {
  // Check cooldown — skip if rule fired recently
  const cooldownKey = `alert:cooldown:${rule.id}`;
  const inCooldown = await redis.get(cooldownKey);
  if (inCooldown) {
    logger.debug({ ruleId: rule.id }, 'AlertJob: rule in cooldown, skipping');
    return;
  }

  // Query the metric
  let currentValue: number;

  try {
    if (rule.metric === 'daily_cost') {
      currentValue = await queryDailyCost(rule.appId, rule.windowMinutes, rule.featureName);
    } else if (rule.metric === 'error_rate') {
      currentValue = await queryErrorRate(rule.appId, rule.windowMinutes, rule.featureName);
    } else if (rule.metric === 'p95_latency') {
      currentValue = await queryP95Latency(rule.appId, rule.windowMinutes, rule.featureName);
    } else {
      logger.warn({ ruleId: rule.id, metric: rule.metric }, 'AlertJob: unknown metric type');
      return;
    }
  } catch (err) {
    logger.error({ err, ruleId: rule.id }, 'AlertJob: metric query failed');
    return;
  }

  const threshold = parseFloat(rule.threshold);

  // Not breached — nothing to do
  if (currentValue <= threshold) return;

  logger.warn(
    { ruleId: rule.id, metric: rule.metric, currentValue, threshold },
    'AlertJob: threshold breached — firing alert'
  );

  alertsFiredTotal.inc();

  // Fire webhook
  const notifiedSuccessfully = await fireWebhook(rule, currentValue);

  // Set cooldown so we don't spam the webhook
  await redis.set(cooldownKey, '1', 'EX', COOLDOWN_SECONDS);

  // Record in DB
  try {
    await recordAlertEvent(rule, currentValue, notifiedSuccessfully);
  } catch (err) {
    logger.error({ err }, 'AlertJob: failed to record alert event');
  }
}

// ── Main evaluation loop ──────────────────────────────────────────────────────

async function runAlertEvaluation(): Promise<void> {
    alertEvaluationsTotal.inc();
  const rules = await findAllActiveAlertRules();

  if (rules.length === 0) return;

  logger.debug({ count: rules.length }, 'AlertJob: evaluating rules');

  // Evaluate rules in parallel with a limit to avoid hammering the DB
  const batchSize = 10;
  for (let i = 0; i < rules.length; i += batchSize) {
    const batch = rules.slice(i, i + batchSize);
    await Promise.allSettled(batch.map(rule => evaluateRule(rule)));
  }
}

export function startAlertJob(): void {
  logger.info({ intervalMs: config.alertIntervalMs }, 'AlertJob started');

  setInterval(async () => {
    try {
      await runAlertEvaluation();
    } catch (err) {
      logger.error({ err }, 'AlertJob: evaluation cycle failed');
    }
  }, config.alertIntervalMs);
}