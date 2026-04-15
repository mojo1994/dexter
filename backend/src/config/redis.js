let redis = null;

try {
  const Redis = require('ioredis');

  redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    maxRetriesPerRequest: null,
    retryStrategy: (times) => {
      if (times > 3) return null;
      return Math.min(times * 200, 2000);
    },
  });

  redis.on('error', (err) => {
    console.warn('Redis connection error (queue features disabled):', err.message);
  });

  redis.on('connect', () => {
    console.log('Connected to Redis');
  });
} catch (err) {
  console.warn('Redis not available, queue features disabled');
}

module.exports = redis;
