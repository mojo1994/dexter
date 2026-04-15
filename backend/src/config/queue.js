let cloneQueue = null;

try {
  const Queue = require('bull');

  const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  };

  cloneQueue = new Queue('page-clone', { redis: redisConfig });

  cloneQueue.on('error', (err) => {
    console.warn('Clone queue error:', err.message);
  });

  cloneQueue.on('completed', (job) => {
    console.log(`Clone job ${job.id} completed for URL: ${job.data.url}`);
  });

  cloneQueue.on('failed', (job, err) => {
    console.error(`Clone job ${job.id} failed:`, err.message);
  });
} catch (err) {
  console.warn('Bull queue not available (Redis required). Clone operations will run synchronously.');
}

module.exports = { cloneQueue };
