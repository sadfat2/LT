const express = require('express');
const authMiddleware = require('../middlewares/auth');
const redisClient = require('../config/redis');

const router = express.Router();

const TURN_CACHE_KEY = 'turn:credentials';
const TURN_CACHE_TTL = 300; // 5 分钟

/**
 * 获取 TURN 服务器凭据
 * 代理 Cloudflare 的 TURN 凭据 API，避免 CORS 问题
 * 使用 Redis 缓存支持多进程共享
 */
router.get('/turn-credentials', authMiddleware, async (req, res) => {
  try {
    // 从 Redis 获取缓存
    const cached = await redisClient.get(TURN_CACHE_KEY);
    if (cached) {
      return res.json({ code: 200, data: JSON.parse(cached) });
    }

    // 从 Cloudflare 获取新凭据
    const response = await fetch('https://speed.cloudflare.com/turn-creds');

    if (!response.ok) {
      throw new Error('获取 TURN 凭据失败');
    }

    const data = await response.json();

    // 存入 Redis（多进程共享）
    await redisClient.setEx(TURN_CACHE_KEY, TURN_CACHE_TTL, JSON.stringify(data));

    res.json({ code: 200, data });
  } catch (error) {
    console.error('获取 TURN 凭据错误:', error);
    res.status(500).json({
      code: 500,
      message: '获取 TURN 凭据失败'
    });
  }
});

module.exports = router;
