const express = require('express');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();

// 缓存 TURN 凭据（有效期 5 分钟）
let cachedCredentials = null;
let cacheExpiry = 0;

/**
 * 获取 TURN 服务器凭据
 * 代理 Cloudflare 的 TURN 凭据 API，避免 CORS 问题
 */
router.get('/turn-credentials', authMiddleware, async (req, res) => {
  try {
    const now = Date.now();

    // 如果缓存有效，直接返回
    if (cachedCredentials && now < cacheExpiry) {
      return res.json({
        code: 200,
        data: cachedCredentials
      });
    }

    // 从 Cloudflare 获取新凭据
    const response = await fetch('https://speed.cloudflare.com/turn-creds');

    if (!response.ok) {
      throw new Error('获取 TURN 凭据失败');
    }

    const data = await response.json();

    // 缓存 5 分钟
    cachedCredentials = data;
    cacheExpiry = now + 5 * 60 * 1000;

    res.json({
      code: 200,
      data: data
    });
  } catch (error) {
    console.error('获取 TURN 凭据错误:', error);
    res.status(500).json({
      code: 500,
      message: '获取 TURN 凭据失败'
    });
  }
});

module.exports = router;
