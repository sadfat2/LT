const { createClient } = require('redis');
const config = require('./index');

const redisClient = createClient({
  socket: {
    host: config.redis.host,
    port: config.redis.port
  }
});

redisClient.on('error', (err) => {
  console.error('Redis 连接错误:', err);
});

redisClient.on('connect', () => {
  console.log('Redis 连接成功');
});

// 连接 Redis
redisClient.connect().catch(console.error);

module.exports = redisClient;
