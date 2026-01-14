const express = require('express');
const ReferralLink = require('../../models/ReferralLink');
const adminAuth = require('../../middlewares/adminAuth');
const { AppError } = require('../../middlewares/errorHandler');
const pool = require('../../config/database');

const router = express.Router();

// 所有路由都需要管理员认证
router.use(adminAuth);

/**
 * 获取推荐链接列表
 * GET /api/admin/referrals
 */
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, userId } = req.query;
    const result = await ReferralLink.findAll(
      parseInt(page),
      parseInt(limit),
      userId ? parseInt(userId) : null
    );

    res.json({
      code: 200,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 获取推荐链接详情
 * GET /api/admin/referrals/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const link = await ReferralLink.findById(id);

    if (!link) {
      throw new AppError('推荐链接不存在', 404);
    }

    res.json({
      code: 200,
      data: link
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 创建推荐链接
 * POST /api/admin/referrals
 */
router.post('/', async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      throw new AppError('请指定用户ID', 400);
    }

    // 检查用户是否存在
    const [userRows] = await pool.execute('SELECT id FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      throw new AppError('用户不存在', 404);
    }

    // 检查是否已有推荐链接
    const existing = await ReferralLink.findByUserId(userId);
    if (existing) {
      throw new AppError('该用户已有推荐链接', 400);
    }

    const result = await ReferralLink.create(userId);
    const link = await ReferralLink.findById(result.id);

    res.json({
      code: 200,
      message: '创建成功',
      data: link
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 切换推荐链接激活状态
 * PUT /api/admin/referrals/:id/toggle
 */
router.put('/:id/toggle', async (req, res, next) => {
  try {
    const { id } = req.params;

    const link = await ReferralLink.findById(id);
    if (!link) {
      throw new AppError('推荐链接不存在', 404);
    }

    const updatedLink = await ReferralLink.toggleActive(id);

    res.json({
      code: 200,
      message: updatedLink.is_active ? '已激活' : '已禁用',
      data: updatedLink
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 删除推荐链接
 * DELETE /api/admin/referrals/:id
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const link = await ReferralLink.findById(id);
    if (!link) {
      throw new AppError('推荐链接不存在', 404);
    }

    await ReferralLink.delete(id);

    res.json({
      code: 200,
      message: '删除成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 获取通过该链接注册的用户列表
 * GET /api/admin/referrals/:id/registrations
 */
router.get('/:id/registrations', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const link = await ReferralLink.findById(id);
    if (!link) {
      throw new AppError('推荐链接不存在', 404);
    }

    const result = await ReferralLink.getRegistrations(id, parseInt(page), parseInt(limit));

    res.json({
      code: 200,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 验证推荐码（公开接口，用于前端访问推荐链接）
 * GET /api/admin/referrals/verify/:code
 * 注意：这个路由放在这里是因为需要和其他推荐链接路由在一起，
 * 但实际上可能需要移到公开路由
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

    // 增加点击次数
    await ReferralLink.incrementClickCount(link.id);

    res.json({
      code: 200,
      data: {
        valid: true,
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

module.exports = router;
