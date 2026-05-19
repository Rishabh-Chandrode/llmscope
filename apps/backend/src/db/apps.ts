import { createHash, randomUUID } from 'crypto';
import { query } from '../db.js';
import { config } from '../config.js';

export type App = {
  id: string;
  name: string;
  createdAt: Date;
}

export type CreateAppResult = {
  appId: string;
  rawKey: string; 
}

export async function createApp(name: string): Promise<CreateAppResult> {
  
  const rawKey = `${config.apiKeyPrefix}${randomUUID().replace(/-/g, '')}`;

  
  const keyHash = createHash('sha256').update(rawKey).digest('hex');

  const rows = await query<{ id: string }>(
    'INSERT INTO apps (name, api_key_hash) VALUES ($1, $2) RETURNING id',
    [name, keyHash]
  );

  return { appId: rows[0].id, rawKey };
}

export async function findAppById(id: string): Promise<App | null> {
  const rows = await query<App>(
    'SELECT id, name, created_at AS "createdAt" FROM apps WHERE id = $1',
    [id]
  );
  return rows[0] ?? null;
}

export async function findAllApps(): Promise<App[]> {
  return query<App>(
    'SELECT id, name, created_at AS "createdAt" FROM apps ORDER BY created_at DESC'
  );
}