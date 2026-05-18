import Redis from 'ioredis';
import { config } from './config.js';
import { logger } from './logger.js';

const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (err) => {
  logger.error({ err }, 'Redis error');
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

export { redis };