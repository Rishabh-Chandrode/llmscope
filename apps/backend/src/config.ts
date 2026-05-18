import { z } from 'zod';
import dotenv from 'dotenv';
dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  FLUSH_INTERVAL_MS: z.string().default('5000'),
  AGGREGATE_INTERVAL_MS: z.string().default('3600000'),
  ALERT_INTERVAL_MS: z.string().default('300000'),
  REDIS_BUFFER_BATCH_SIZE: z.string().default('500'),
  API_KEY_PREFIX: z.string().default('llmscope_live_'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  port: parseInt(parsed.data.PORT),
  nodeEnv: parsed.data.NODE_ENV,
  databaseUrl: parsed.data.DATABASE_URL,
  redisUrl: parsed.data.REDIS_URL,
  flushIntervalMs: parseInt(parsed.data.FLUSH_INTERVAL_MS),
  aggregateIntervalMs: parseInt(parsed.data.AGGREGATE_INTERVAL_MS),
  alertIntervalMs: parseInt(parsed.data.ALERT_INTERVAL_MS),
  redisBufferBatchSize: parseInt(parsed.data.REDIS_BUFFER_BATCH_SIZE),
  apiKeyPrefix: parsed.data.API_KEY_PREFIX,
};