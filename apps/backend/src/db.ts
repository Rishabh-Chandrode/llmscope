import { Pool, PoolClient } from 'pg';
import { config } from './config.js';
import { logger } from './logger.js';

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,                        
  idleTimeoutMillis: 30_000,      
  connectionTimeoutMillis: 5_000, 
});

pool.on('error', (err) => {
  logger.error({ err }, 'PostgreSQL pool error');
});


export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}


export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}


export async function connectDb(): Promise<void> {
  const client = await pool.connect();
  logger.info('PostgreSQL connected');
  client.release();
}