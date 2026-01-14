const express = require('express');
const Admin = require('../../models/Admin');
const adminAuth = require('../../middlewares/adminAuth');
const { AppError } = require('../../middlewares/errorHandler');

const router = express.Router();

// 所有路由都需要管理员认证
router.use(adminAuth);

/**
 * 获取管理员列表
 * GET /api/admin/admins
 */
router.get('/', async (req, res, next) => {
  try {
    const admins = await Admin.findAll();

    res.json({
      code: 200,
      data: admins
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 获取管理员详情
 * GET /api/admin/admins/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const admin = await Admin.findById(id);

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
 * 创建管理员
 * POST /api/admin/admins
 */
router.post('/', async (req, res, next) => {
  try {
    const { username, password, nickname } = req.body;

    if (!username || !password) {
      throw new AppError('请输入用户名和密码', 400);
    }

    // 验证用户名格式
    if (!/^[a-zA-Z0-9_]{4,20}$/.test(username)) {
      throw new AppError('用户名格式错误：需要4-20位字母、数字或下划线', 400);
    }

    // 验证密码格式
    if (password.length < 6 || password.length > 20) {
      throw new AppError('密码格式错误：需要6-20位字符', 400);
    }

    // 检查用户名是否已存在
    const exists = await Admin.isUsernameExists(username);
    if (exists) {
      throw new AppError('用户名已存在', 400);
    }

    const adminId = await Admin.create(username, password, nickname);
    const admin = await Admin.findById(adminId);

    res.json({
      code: 200,
      message: '创建成功',
      data: admin
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 更新管理员
 * PUT /api/admin/admins/:id
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nickname, password } = req.body;

    const admin = await Admin.findById(id);
    if (!admin) {
      throw new AppError('管理员不存在', 404);
    }

    const updateData = {};
    if (nickname !== undefined) updateData.nickname = nickname;
    if (password) {
      // 验证密码格式
      if (password.length < 6 || password.length > 20) {
        throw new AppError('密码格式错误：需要6-20位字符', 400);
      }
      updateData.password = password;
    }

    if (Object.keys(updateData).length === 0) {
      throw new AppError('没有要更新的数据', 400);
    }

    await Admin.update(id, updateData);
    const updatedAdmin = await Admin.findById(id);

    res.json({
      code: 200,
      message: '更新成功',
      data: updatedAdmin
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 删除管理员
 * DELETE /api/admin/admins/:id
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // 不能删除自己
    if (parseInt(id) === req.admin.id) {
      throw new AppError('不能删除自己', 400);
    }

    const admin = await Admin.findById(id);
    if (!admin) {
      throw new AppError('管理员不存在', 404);
    }

    await Admin.delete(id);

    res.json({
      code: 200,
      message: '删除成功'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
