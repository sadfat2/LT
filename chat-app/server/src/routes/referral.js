const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ReferralLink = require('../models/ReferralLink');
const IpRegisterLimit = require('../models/IpRegisterLimit');
const pool = require('../config/database');
const config = require('../config');
const { AppError } = require('../middlewares/errorHandler');

const router = express.Router();

// 获取客户端真实 IP
function getClientIp(req) {
  // 优先从 X-Forwarded-For 获取（反向代理场景）
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  // 其次从 X-Real-IP 获取
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return realIp;
  }
  // 最后使用 req.ip
  return req.ip || req.connection.remoteAddress;
}

/**
 * 生成随机账号
 */
function generateAccount() {
  const prefix = 'user';
  const random = Math.random().toString(36).substring(2, 10);
  return prefix + random;
}

/**
 * 生成随机密码
 */
function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * 验证推荐码（公开接口）
 * GET /api/referral/verify/:code
 *
 * 返回推荐码是否有效，以及当前 IP 是否可以注册
 */
router.get('/verify/:code', async (req, res, next) => {
  try {
    const { code } = req.params;
    const link = await ReferralLink.findByCode(code);

    if (!link) {
      throw new AppError('推荐链接不存在', 404);
    }

    if (!link.is_active) {
      throw new AppError('推荐链接已失效', 400);
    }

    // 检查 IP 是否可以注册
    let ipAllowed = true;
    const clientIp = getClientIp(req);

    if (config.ipLimit.enabled) {
      ipAllowed = await IpRegisterLimit.canRegister(
        clientIp,
        link.id,
        config.ipLimit.maxRegistrationsPerLink
      );
    }

    // 增加点击次数
    await ReferralLink.incrementClickCount(link.id);

    res.json({
      code: 200,
      data: {
        valid: true,
        ipAllowed,
        referrer: {
          id: link.user_id,
          nickname: link.user_nickname,
          avatar: link.user_avatar
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 自动注册（公开接口）
 * POST /api/referral/auto-register/:code
 *
 * 点击推荐链接后自动创建账号，并添加推荐人为好友
 */
router.post('/auto-register/:code', async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const { code } = req.params;

    // 验证推荐码
    const link = await ReferralLink.findByCode(code);
    if (!link) {
      throw new AppError('推荐链接不存在', 404);
    }
    if (!link.is_active) {
      throw new AppError('推荐链接已失效', 400);
    }

    // IP 限制检查
    const clientIp = getClientIp(req);
    console.log('[自动注册] 客户端IP:', clientIp, '推荐码:', code, 'IP限制启用:', config.ipLimit.enabled);
    if (config.ipLimit.enabled) {
      const canRegister = await IpRegisterLimit.canRegister(
        clientIp,
        link.id,
        config.ipLimit.maxRegistrationsPerLink
      );

      if (!canRegister) {
        throw new AppError('该IP已通过此推荐链接注册过，无法再次注册', 403);
      }
    }

    await connection.beginTransaction();

    // 生成账号和密码
    let account = generateAccount();
    let attempts = 0;

    // 确保账号唯一
    while (attempts < 10) {
      const [existing] = await connection.execute(
        'SELECT id FROM users WHERE account = ?',
        [account]
      );
      if (existing.length === 0) break;
      account = generateAccount();
      attempts++;
    }

    if (attempts >= 10) {
      throw new AppError('生成账号失败，请重试', 500);
    }

    const plainPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    // 创建用户
    const [userResult] = await connection.execute(
      'INSERT INTO users (account, password, nickname) VALUES (?, ?, ?)',
      [account, hashedPassword, account]
    );
    const newUserId = userResult.insertId;

    const referrerId = link.user_id;

    // 创建双向好友关系
    await connection.execute(
      'INSERT INTO friendships (user_id, friend_id) VALUES (?, ?), (?, ?)',
      [newUserId, referrerId, referrerId, newUserId]
    );

    // 创建私聊会话
    const [convResult] = await connection.execute(
      "INSERT INTO conversations (type) VALUES ('private')"
    );
    const conversationId = convResult.insertId;

    // 添加会话参与者
    await connection.execute(
      'INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)',
      [conversationId, newUserId, conversationId, referrerId]
    );

    // 记录推荐注册
    await connection.execute(
      'INSERT INTO referral_registrations (referral_link_id, referrer_id, referee_id) VALUES (?, ?, ?)',
      [link.id, referrerId, newUserId]
    );

    // 更新推荐链接的注册计数
    await connection.execute(
      'UPDATE referral_links SET register_count = register_count + 1 WHERE id = ?',
      [link.id]
    );

    // 记录注册 IP
    await connection.execute(
      'UPDATE users SET register_ip = ? WHERE id = ?',
      [clientIp, newUserId]
    );

    // 记录 IP 注册（用于限制）
    if (config.ipLimit.enabled) {
      await connection.execute(
        'INSERT INTO ip_register_limits (ip_address, referral_link_id, user_id) VALUES (?, ?, ?)',
        [clientIp, link.id, newUserId]
      );
    }

    await connection.commit();

    // 获取新用户信息
    const [userRows] = await pool.execute(
      'SELECT id, account, nickname, avatar, signature FROM users WHERE id = ?',
      [newUserId]
    );
    const user = userRows[0];

    // 生成 JWT token
    const token = jwt.sign(
      { id: user.id, account: user.account },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.json({
      code: 200,
      message: '注册成功',
      data: {
        account,
        password: plainPassword,
        token,
        user
      }
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

module.exports = router;
