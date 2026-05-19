import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  findTraces,
  findTraceById,
  getOverviewMetrics,
  getCostBreakdown,
  getLatencyMetrics,
  getVolumeMetrics,
} from '../db/traces.js';
import { logger } from '../logger.js';

export const queryRouter: Router = Router();

// ── Shared param schemas ──────────────────────────────────────────────────────

const dateRangeSchema = z.object({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});

// ── GET /traces ───────────────────────────────────────────────────────────────

const listTracesSchema = dateRangeSchema.extend({
  feature: z.string().optional(),
  status: z.enum(['success', 'failed', 'timeout']).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

queryRouter.get('/traces', async (req: Request, res: Response) => {
  const parsed = listTracesSchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid query parameters',
      details: z.treeifyError(parsed.error),
    });
    return;
  }

  try {
    const { from, to, feature, status, limit, offset } = parsed.data;

    const result = await findTraces({
      appId: req.appId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      feature,
      status,
      limit,
      offset,
    });

    res.json({
      traces: result.traces,
      total: result.total,
      limit,
      offset,
    });

  } catch (err) {
    logger.error({ err }, 'GET /traces failed');
    res.status(500).json({ error: 'Failed to fetch traces' });
  }
});

// ── GET /traces/:traceId ──────────────────────────────────────────────────────

queryRouter.get('/traces/:traceId', async (req: Request, res: Response) => {
  try {
    const { traceId } = req.params;

    if (typeof traceId !== 'string') {
      res.status(400).json({ error: 'Invalid traceId parameter' });
      return;
    }
    const trace = await findTraceById(traceId, req.appId);

    if (!trace) {
      res.status(404).json({ error: 'Trace not found' });
      return;
    }

    res.json(trace);

  } catch (err) {
    logger.error({ err, traceId: req.params.traceId }, 'GET /traces/:id failed');
    res.status(500).json({ error: 'Failed to fetch trace' });
  }
});

// ── GET /metrics/overview ─────────────────────────────────────────────────────

queryRouter.get('/metrics/overview', async (req: Request, res: Response) => {
  try {
    const metrics = await getOverviewMetrics(req.appId);
    res.json(metrics);
  } catch (err) {
    logger.error({ err }, 'GET /metrics/overview failed');
    res.status(500).json({ error: 'Failed to fetch overview metrics' });
  }
});

// ── GET /metrics/cost ─────────────────────────────────────────────────────────

const costQuerySchema = dateRangeSchema.extend({
  groupBy: z.enum(['feature', 'day', 'model']).default('day'),
});

queryRouter.get('/metrics/cost', async (req: Request, res: Response) => {
  const parsed = costQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid query parameters',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const { from, to, groupBy } = parsed.data;

    // Default: last 30 days
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const breakdown = await getCostBreakdown(req.appId, fromDate, toDate, groupBy);
    res.json({ breakdown, from: fromDate.toISOString(), to: toDate.toISOString(), groupBy });

  } catch (err) {
    logger.error({ err }, 'GET /metrics/cost failed');
    res.status(500).json({ error: 'Failed to fetch cost metrics' });
  }
});

// ── GET /metrics/latency ──────────────────────────────────────────────────────

const latencyQuerySchema = dateRangeSchema.extend({
  feature: z.string().optional(),
});

queryRouter.get('/metrics/latency', async (req: Request, res: Response) => {
  const parsed = latencyQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query parameters', details: z.treeifyError(parsed.error) });
    return;
  }

  try {
    const { from, to, feature } = parsed.data;
    const fromDate = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const data = await getLatencyMetrics(req.appId, fromDate, toDate, feature);
    res.json({ data, from: fromDate.toISOString(), to: toDate.toISOString() });

  } catch (err) {
    logger.error({ err }, 'GET /metrics/latency failed');
    res.status(500).json({ error: 'Failed to fetch latency metrics' });
  }
});

// ── GET /metrics/volume ───────────────────────────────────────────────────────

const volumeQuerySchema = dateRangeSchema.extend({
  feature: z.string().optional(),
});

queryRouter.get('/metrics/volume', async (req: Request, res: Response) => {
  const parsed = volumeQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query parameters', details: z.treeifyError(parsed.error) });
    return;
  }

  try {
    const { from, to, feature } = parsed.data;
    const fromDate = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const data = await getVolumeMetrics(req.appId, fromDate, toDate, feature);
    res.json({ data, from: fromDate.toISOString(), to: toDate.toISOString() });

  } catch (err) {
    logger.error({ err }, 'GET /metrics/volume failed');
    res.status(500).json({ error: 'Failed to fetch volume metrics' });
  }
});