const Redis = require('ioredis');

async function resetRedis() {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  });

  try {
    console.log('🔄 Flushing Redis cache...');
    await redis.flushdb();
    console.log('✅ Redis cleared successfully!');
  } catch (error) {
    console.error('❌ Failed to clear Redis:', error.message);
  } finally {
    redis.disconnect();
  }
}

resetRedis();
