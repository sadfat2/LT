const express = require('express');
const config = require('../config');

const router = express.Router();

/**
 * 获取公开配置（无需认证）
 * GET /api/config/public
 */
router.get('/public', (req, res) => {
  res.json({
    code: 200,
    data: {
      registerEnabled: config.features.registerEnabled,
      voiceCallEnabled: config.features.voiceCallEnabled
    }
  });
});

module.exports = router;
