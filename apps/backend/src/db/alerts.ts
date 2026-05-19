import { query } from '../db.js';

export type AlertRule = {
  id: string;
  appId: string;
  metric: string;
  threshold: string;
  windowMinutes: number;
  featureName: string | null;
  notifyUrl: string;
  isActive: boolean;
  createdAt: Date;
}

export type CreateAlertRuleInput = {
  appId: string;
  metric: 'daily_cost' | 'error_rate' | 'p95_latency';
  threshold: number;
  windowMinutes?: number;
  featureName?: string;
  notifyUrl: string;
}

export async function createAlertRule(input: CreateAlertRuleInput): Promise<AlertRule> {
  const rows = await query<AlertRule>(
    `INSERT INTO alert_rules (app_id, metric, threshold, window_minutes, feature_name, notify_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING
       id, app_id AS "appId", metric, threshold,
       window_minutes AS "windowMinutes", feature_name AS "featureName",
       notify_url AS "notifyUrl", is_active AS "isActive", created_at AS "createdAt"`,
    [
      input.appId,
      input.metric,
      input.threshold,
      input.windowMinutes ?? 60,
      input.featureName ?? null,
      input.notifyUrl,
    ]
  );
  return rows[0];
}

export async function findAlertRulesByApp(appId: string): Promise<AlertRule[]> {
  return query<AlertRule>(
    `SELECT
       id, app_id AS "appId", metric, threshold,
       window_minutes AS "windowMinutes", feature_name AS "featureName",
       notify_url AS "notifyUrl", is_active AS "isActive", created_at AS "createdAt"
     FROM alert_rules
     WHERE app_id = $1
     ORDER BY created_at DESC`,
    [appId]
  );
}

export async function findAlertRuleById(id: string, appId: string): Promise<AlertRule | null> {
  const rows = await query<AlertRule>(
    `SELECT
       id, app_id AS "appId", metric, threshold,
       window_minutes AS "windowMinutes", feature_name AS "featureName",
       notify_url AS "notifyUrl", is_active AS "isActive", created_at AS "createdAt"
     FROM alert_rules
     WHERE id = $1 AND app_id = $2`,
    [id, appId]
  );
  return rows[0] ?? null;
}

export async function updateAlertRule(
  id: string,
  appId: string,
  updates: Partial<Pick<CreateAlertRuleInput, 'threshold' | 'windowMinutes' | 'notifyUrl' | 'featureName'>> & { isActive?: boolean }
): Promise<AlertRule | null> {
  // Only update fields that were provided
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (updates.threshold !== undefined) {
    setClauses.push(`threshold = $${paramIndex++}`);
    params.push(updates.threshold);
  }
  if (updates.windowMinutes !== undefined) {
    setClauses.push(`window_minutes = $${paramIndex++}`);
    params.push(updates.windowMinutes);
  }
  if (updates.notifyUrl !== undefined) {
    setClauses.push(`notify_url = $${paramIndex++}`);
    params.push(updates.notifyUrl);
  }
  if (updates.featureName !== undefined) {
    setClauses.push(`feature_name = $${paramIndex++}`);
    params.push(updates.featureName);
  }
  if (updates.isActive !== undefined) {
    setClauses.push(`is_active = $${paramIndex++}`);
    params.push(updates.isActive);
  }

  if (setClauses.length === 0) return findAlertRuleById(id, appId);

  params.push(id, appId);

  const rows = await query<AlertRule>(
    `UPDATE alert_rules
     SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex} AND app_id = $${paramIndex + 1}
     RETURNING
       id, app_id AS "appId", metric, threshold,
       window_minutes AS "windowMinutes", feature_name AS "featureName",
       notify_url AS "notifyUrl", is_active AS "isActive", created_at AS "createdAt"`,
    params
  );
  return rows[0] ?? null;
}

export async function deleteAlertRule(id: string, appId: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    'DELETE FROM alert_rules WHERE id = $1 AND app_id = $2 RETURNING id',
    [id, appId]
  );
  return rows.length > 0;
}

// Used by the evaluation job — get all active rules across all apps
export async function findAllActiveAlertRules(): Promise<AlertRule[]> {
  return query<AlertRule>(
    `SELECT
       id, app_id AS "appId", metric, threshold,
       window_minutes AS "windowMinutes", feature_name AS "featureName",
       notify_url AS "notifyUrl", is_active AS "isActive", created_at AS "createdAt"
     FROM alert_rules
     WHERE is_active = TRUE
     ORDER BY created_at ASC`
  );
}