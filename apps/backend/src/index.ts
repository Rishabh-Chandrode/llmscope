
import { config } from './config.js';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from './logger.js';
import { connectDb } from './db.js';
import { authMiddleware } from './middleware/auth.js';
import { appsRouter } from './routes/apps.js';
import { ingestRouter } from './routes/ingest.js';
import { startFlushJob } from './jobs/flush.js';


import './redis.js';

async function main() {
  
  await connectDb();

  const app = express();

  
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    });
  });

  
  app.use('/apps', appsRouter);
  app.use('/ingest', authMiddleware, ingestRouter);

  
  
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error({ err }, 'Unhandled error');
    res.status(500).json({ error: 'Internal server error' });
  });

  app.listen(config.port, () => {
    logger.info({ port: config.port }, 'LLMScope backend started');

    
    startFlushJob();
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});