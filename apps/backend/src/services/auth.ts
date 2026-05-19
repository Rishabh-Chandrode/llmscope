import { createHash } from 'crypto';
import { query } from '../db.js';
import { redis } from '../redis.js';
import { logger } from '../logger.js';

const CACHE_TTL_SECONDS = 300; 

function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}


export async function authenticateApiKey(apiKey: string): Promise<string | null> {
  const keyHash = hashApiKey(apiKey);
  const cacheKey = `auth:cache:${keyHash}`;

  
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return cached;
  } catch (err) {
    
    logger.warn({ err }, 'Auth cache read failed, falling back to DB');
  }

  
  const rows = await query<{ id: string }>(
    'SELECT id FROM apps WHERE api_key_hash = $1',
    [keyHash]
  );

  if (rows.length === 0) return null;

  const appId = rows[0].id;

  
  try {
    await redis.set(cacheKey, appId, 'EX', CACHE_TTL_SECONDS);
  } catch (err) {
    
    logger.warn({ err }, 'Auth cache write failed');
  }

  return appId;
}