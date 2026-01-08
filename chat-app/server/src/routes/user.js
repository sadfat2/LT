const express = require('express');
const User = require('../models/User');
const authMiddleware = require('../middlewares/auth');
const { AppError } = require('../middlewares/errorHandler');

const router = express.Router();

// 获取当前用户信息
router.get('/profile', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      throw new AppError('用户不存在', 404);
    }

    res.json({
      code: 200,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

// 更新用户信息
router.put('/profile', authMiddleware, async (req, res, next) => {
  try {
    const { nickname, signature } = req.body;

    if (nickname !== undefined && (nickname.length < 1 || nickname.length > 50)) {
      throw new AppError('昵称长度需要在1-50个字符之间', 400);
    }

    if (signature !== undefined && signature.length > 200) {
      throw new AppError('签名长度不能超过200个字符', 400);
    }

    await User.update(req.user.id, { nickname, signature });
    const user = await User.findById(req.user.id);

    res.json({
      code: 200,
      message: '更新成功',
      data: user
    });
  } catch (error) {
    next(error);
  }
});

// 搜索用户
router.get('/search', authMiddleware, async (req, res, next) => {
  try {
    const { keyword } = req.query;

    if (!keyword || keyword.length < 1) {
      throw new AppError('请输入搜索关键词', 400);
    }

    const users = await User.search(keyword, req.user.id);

    res.json({
      code: 200,
      data: users
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
