const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { Friend } = require('../models/Friend');
const ReferralLink = require('../models/ReferralLink');
const Conversation = require('../models/Conversation');
const config = require('../config');
const { AppError } = require('../middlewares/errorHandler');

const router = express.Router();

// 注册
router.post('/register', async (req, res, next) => {
  try {
    const { account, password, referralCode } = req.body;

    // 验证账号格式（4-20位字母数字）
    if (!/^[a-zA-Z0-9]{4,20}$/.test(account)) {
      throw new AppError('账号格式错误：需要4-20位字母或数字', 400);
    }

    // 验证密码格式（6-20位）
    if (!password || password.length < 6 || password.length > 20) {
      throw new AppError('密码格式错误：需要6-20位字符', 400);
    }

    // 检查账号是否已存在
    const existingUser = await User.findByAccount(account);
    if (existingUser) {
      throw new AppError('账号已存在', 400);
    }

    // 验证推荐码（如果提供）
    let referralLink = null;
    if (referralCode) {
      referralLink = await ReferralLink.findByCode(referralCode);
      if (!referralLink || !referralLink.is_active) {
        // 推荐码无效，但不阻止注册，只是不处理推荐关系
        referralLink = null;
      }
    }

    // 创建用户
    const userId = await User.create(account, password);

    // 如果有有效的推荐码，处理推荐关系
    if (referralLink) {
      try {
        // 记录推荐注册
        await ReferralLink.recordRegistration(
          referralLink.id,
          referralLink.user_id,
          userId
        );

        // 自动添加推荐人为好友（双向）
        await Friend.addFriend(userId, referralLink.user_id);

        // 创建私聊会话
        await Conversation.getOrCreatePrivate(userId, referralLink.user_id);
      } catch (refError) {
        // 推荐处理失败不影响注册
        console.error('推荐关系处理失败:', refError);
      }
    }

    // 生成 token
    const token = jwt.sign(
      { id: userId, account },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    // 获取用户信息
    const user = await User.findById(userId);

    res.status(201).json({
      code: 200,
      message: '注册成功',
      data: {
        token,
        user,
        referrer: referralLink ? {
          id: referralLink.user_id,
          nickname: referralLink.user_nickname
        } : null
      }
    });
  } catch (error) {
    next(error);
  }
});

// 登录
router.post('/login', async (req, res, next) => {
  try {
    const { account, password } = req.body;

    if (!account || !password) {
      throw new AppError('请输入账号和密码', 400);
    }

    // 查找用户
    const user = await User.findByAccount(account);
    if (!user) {
      throw new AppError('账号或密码错误', 401);
    }

    // 检查用户是否被封停
    if (user.status === 'banned') {
      throw new AppError('账号已被封停', 403);
    }

    // 验证密码
    const isValid = await User.verifyPassword(password, user.password);
    if (!isValid) {
      throw new AppError('账号或密码错误', 401);
    }

    // 生成 token
    const token = jwt.sign(
      { id: user.id, account: user.account },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    // 返回用户信息（不含密码）
    const { password: _, ...userInfo } = user;

    res.json({
      code: 200,
      message: '登录成功',
      data: { token, user: userInfo }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
