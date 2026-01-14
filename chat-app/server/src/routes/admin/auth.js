const express = require('express');
const jwt = require('jsonwebtoken');
const Admin = require('../../models/Admin');
const config = require('../../config');
const adminAuth = require('../../middlewares/adminAuth');
const { AppError } = require('../../middlewares/errorHandler');

const router = express.Router();

/**
 * 管理员登录
 * POST /api/admin/auth/login
 */
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      throw new AppError('请输入用户名和密码', 400);
    }

    // 查找管理员
    const admin = await Admin.findByUsername(username);
    if (!admin) {
      throw new AppError('用户名或密码错误', 401);
    }

    // 验证密码
    const isValid = await Admin.verifyPassword(password, admin.password);
    if (!isValid) {
      throw new AppError('用户名或密码错误', 401);
    }

    // 更新登录信息
    const ip = req.ip || req.connection.remoteAddress;
    await Admin.updateLoginInfo(admin.id, ip);

    // 生成 admin token
    const token = jwt.sign(
      { id: admin.id, username: admin.username, isAdmin: true },
      config.jwt.adminSecret,
      { expiresIn: config.jwt.adminExpiresIn }
    );

    // 返回管理员信息（不含密码）
    const { password: _, ...adminInfo } = admin;

    res.json({
      code: 200,
      message: '登录成功',
      data: { token, admin: adminInfo }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 获取当前管理员信息
 * GET /api/admin/auth/profile
 */
router.get('/profile', adminAuth, async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.admin.id);
    if (!admin) {
      throw new AppError('管理员不存在', 404);
    }

    res.json({
      code: 200,
      data: admin
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 更新当前管理员信息
 * PUT /api/admin/auth/profile
 */
router.put('/profile', adminAuth, async (req, res, next) => {
  try {
    const { nickname, avatar, password, oldPassword } = req.body;

    // 如果要修改密码，需要验证旧密码
    if (password) {
      if (!oldPassword) {
        throw new AppError('请输入原密码', 400);
      }

      const admin = await Admin.findByUsername(req.admin.username);
      const isValid = await Admin.verifyPassword(oldPassword, admin.password);
      if (!isValid) {
        throw new AppError('原密码错误', 400);
      }
    }

    const updateData = {};
    if (nickname !== undefined) updateData.nickname = nickname;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (password) updateData.password = password;

    if (Object.keys(updateData).length === 0) {
      throw new AppError('没有要更新的数据', 400);
    }

    await Admin.update(req.admin.id, updateData);
    const updatedAdmin = await Admin.findById(req.admin.id);

    res.json({
      code: 200,
      message: '更新成功',
      data: updatedAdmin
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
