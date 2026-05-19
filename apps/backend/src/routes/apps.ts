import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createApp } from '../db/apps.js';
import { logger } from '../logger.js';

export const appsRouter: Router  = Router();

const registerSchema = z.object({
  name: z.string().min(1, 'App name is required').max(255),
});

appsRouter.post('/register', async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Validation failed',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const { appId, rawKey } = await createApp(parsed.data.name);

    logger.info({ appId, name: parsed.data.name }, 'New app registered');

    
    res.status(201).json({
      appId,
      apiKey: rawKey,
      message: 'Save this API key — it will never be shown again',
    });

  } catch (err) {
    logger.error({ err }, 'App registration failed');
    res.status(500).json({ error: 'Registration failed' });
  }
});