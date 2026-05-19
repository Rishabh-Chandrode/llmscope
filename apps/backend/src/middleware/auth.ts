import { Request, Response, NextFunction } from 'express';
import { authenticateApiKey } from '../services/auth.js';
import { logger } from '../logger.js';

declare global {
  namespace Express {
    interface Request {
      appId: string;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || typeof apiKey !== 'string') {
    res.status(401).json({ error: 'Missing x-api-key header' });
    return;
  }

  try {
    const appId = await authenticateApiKey(apiKey);

    if (!appId) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    req.appId = appId;
    next();

  } catch (err) {
    logger.error({ err }, 'Auth middleware error');
    res.status(500).json({ error: 'Internal server error' });
  }
}