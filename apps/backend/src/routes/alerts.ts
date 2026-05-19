import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  createAlertRule,
  findAlertRulesByApp,
  findAlertRuleById,
  updateAlertRule,
  deleteAlertRule,
} from '../db/alerts.js';
import { logger } from '../logger.js';

export const alertsRouter: Router = Router();

// ── Validation schemas ────────────────────────────────────────────────────────

const createAlertSchema = z.object({
  metric: z.enum(['daily_cost', 'error_rate', 'p95_latency']),
  threshold: z.number().positive(),
  windowMinutes: z.number().int().min(5).max(10080).default(60), // max 1 week
  featureName: z.string().max(255).optional(),
  notifyUrl: z.url(),
});

const updateAlertSchema = z.object({
  threshold: z.number().positive().optional(),
  windowMinutes: z.number().int().min(5).max(10080).optional(),
  featureName: z.string().max(255).optional(),
  notifyUrl: z.url().optional(),
  isActive: z.boolean().optional(),
});

// ── POST /alerts ──────────────────────────────────────────────────────────────

alertsRouter.post('/', async (req: Request, res: Response) => {
  const parsed = createAlertSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Validation failed',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const rule = await createAlertRule({ ...parsed.data, appId: req.appId });
    logger.info({ ruleId: rule.id, metric: rule.metric }, 'Alert rule created');
    res.status(201).json(rule);
  } catch (err) {
    logger.error({ err }, 'POST /alerts failed');
    res.status(500).json({ error: 'Failed to create alert rule' });
  }
});

// ── GET /alerts ───────────────────────────────────────────────────────────────

alertsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const rules = await findAlertRulesByApp(req.appId);
    res.json({ rules });
  } catch (err) {
    logger.error({ err }, 'GET /alerts failed');
    res.status(500).json({ error: 'Failed to fetch alert rules' });
  }
});

// ── GET /alerts/:ruleId ───────────────────────────────────────────────────────

alertsRouter.get('/:ruleId', async (req: Request, res: Response) => {
  try {
    const {ruleId } = req.params;
    if (typeof ruleId != 'string'){
        res.status(404).json({ error: 'Invalid rule id' });
        return;
    }
    const rule = await findAlertRuleById(ruleId, req.appId);

    if (!rule) {
      res.status(404).json({ error: 'Alert rule not found' });
      return;
    }

    res.json(rule);
  } catch (err) {
    logger.error({ err }, 'GET /alerts/:id failed');
    res.status(500).json({ error: 'Failed to fetch alert rule' });
  }
});

// ── PATCH /alerts/:ruleId ─────────────────────────────────────────────────────

alertsRouter.patch('/:ruleId', async (req: Request, res: Response) => {
  const parsed = updateAlertSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Validation failed',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const {ruleId } = req.params;
    if (typeof ruleId != 'string'){
        res.status(404).json({ error: 'Invalid rule id' });
        return;
    }
    const rule = await updateAlertRule(ruleId, req.appId, parsed.data);

    if (!rule) {
      res.status(404).json({ error: 'Alert rule not found' });
      return;
    }

    logger.info({ ruleId: rule.id }, 'Alert rule updated');
    res.json(rule);
  } catch (err) {
    logger.error({ err }, 'PATCH /alerts/:id failed');
    res.status(500).json({ error: 'Failed to update alert rule' });
  }
});

// ── DELETE /alerts/:ruleId ────────────────────────────────────────────────────

alertsRouter.delete('/:ruleId', async (req: Request, res: Response) => {
  try {
    const {ruleId } = req.params;
    if (typeof ruleId != 'string'){
        res.status(404).json({ error: 'Invalid rule id' });
        return;
    }
    const deleted = await deleteAlertRule(ruleId, req.appId);

    if (!deleted) {
      res.status(404).json({ error: 'Alert rule not found' });
      return;
    }

    logger.info({ ruleId: req.params.ruleId }, 'Alert rule deleted');
    res.status(204).send();
  } catch (err) {
    logger.error({ err }, 'DELETE /alerts/:id failed');
    res.status(500).json({ error: 'Failed to delete alert rule' });
  }
});