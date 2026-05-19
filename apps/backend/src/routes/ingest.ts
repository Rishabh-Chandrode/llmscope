import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { redis } from '../redis.js';
import { logger } from '../logger.js';

export const ingestRouter: Router = Router();

const tracePayloadSchema = z.object({
  featureName:     z.string().min(1).max(255),
  model:           z.string().min(1).max(100),
  provider:        z.string().min(1).max(50),
  inputTokens:     z.number().int().min(0),
  outputTokens:    z.number().int().min(0),
  latencyMs:       z.number().int().min(0),
  status:          z.enum(['success', 'failed', 'timeout']),
  errorMessage:    z.string().optional(),
  prompt:          z.string().optional(),
  response:        z.string().optional(),
  clientTimestamp: z.number(),
  sdkVersion:      z.string().optional(),
  metadata:        z.record(z.string(),z.unknown()).optional(),
});

export type TracePayload = z.infer<typeof tracePayloadSchema>;

ingestRouter.post('/', async (req: Request, res: Response) => {
  const parsed = tracePayloadSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Validation failed',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const traceId = randomUUID();
    const bufferedTrace = {
      ...parsed.data,
      traceId,
      appId: req.appId,
      receivedAt: Date.now(),
    };

    
    await redis.lpush('traces:buffer', JSON.stringify(bufferedTrace));

    logger.debug({ traceId, appId: req.appId }, 'Trace buffered in Redis');

    
    res.status(202).json({ traceId });

  } catch (err) {
    logger.error({ err }, 'Ingest failed');
    res.status(500).json({ error: 'Failed to ingest trace' });
  }
});