const express = require('express');
const pool = require('../../config/database');
const adminAuth = require('../../middlewares/adminAuth');
const { AppError } = require('../../middlewares/errorHandler');
const { getIO } = require('../../socket');
const redisClient = require('../../config/redis');
const User = require('../../models/User');

const router = express.Router();

// 所有路由都需要管理员认证
router.use(adminAuth);

/**
 * 创建用户
 * POST /api/admin/users
 */
router.post('/', async (req, res, next) => {
  try {
    const { account, password, nickname } = req.body;

    // 验证参数
    if (!account || !password) {
      throw new AppError('账号和密码不能为空', 400);
    }

    // 验证账号格式（4-20位字母数字）
    if (!/^[a-zA-Z0-9]{4,20}$/.test(account)) {
      throw new AppError('账号格式错误：需要4-20位字母或数字', 400);
    }

    // 验证密码格式（6-20位）
    if (password.length < 6 || password.length > 20) {
      throw new AppError('密码格式错误：需要6-20位字符', 400);
    }

    // 检查账号是否已存在
    const existingUser = await User.findByAccount(account);
    if (existingUser) {
      throw new AppError('账号已存在', 400);
    }

    // 创建用户
    const userId = await User.create(account, password);

    // 如果提供了昵称，更新昵称
    if (nickname) {
      await User.update(userId, { nickname });
    }

    const user = await User.findById(userId);

    res.status(201).json({
      code: 200,
      message: '用户创建成功',
      data: user
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 获取用户列表
 * GET /api/admin/users
 */
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, keyword = '', status = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = `
      SELECT u.id, u.account, u.nickname, u.avatar, u.signature, u.status,
             u.banned_at, u.banned_reason, u.created_at,
             rl.id as referral_link_id, rl.code as referral_code, rl.is_active as referral_active
      FROM users u
      LEFT JOIN referral_links rl ON u.id = rl.user_id
      WHERE 1=1
    `;
    const params = [];

    if (keyword) {
      sql += ' AND (u.account LIKE ? OR u.nickname LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    if (status && ['active', 'banned'].includes(status)) {
      sql += ' AND u.status = ?';
      params.push(status);
    }

    // 获取总数
    let countSql = `
      SELECT COUNT(*) as total
      FROM users u
      LEFT JOIN referral_links rl ON u.id = rl.user_id
      WHERE 1=1
    `;
    if (keyword) {
      countSql += ' AND (u.account LIKE ? OR u.nickname LIKE ?)';
    }
    if (status && ['active', 'banned'].includes(status)) {
      countSql += ' AND u.status = ?';
    }
    const [countResult] = await pool.execute(countSql, params);

    // 分页 (LIMIT/OFFSET 直接拼接，确保为整数防止注入)
    const limitInt = parseInt(limit) || 20;
    const offsetInt = parseInt(offset) || 0;
    sql += ` ORDER BY u.created_at DESC LIMIT ${limitInt} OFFSET ${offsetInt}`;

    const [rows] = await pool.execute(sql, params);

    // 检查在线状态
    const usersWithOnline = await Promise.all(rows.map(async (user) => {
      const online = await redisClient.get(`online:${user.id}`);
      return { ...user, is_online: !!online };
    }));

    res.json({
      code: 200,
      data: {
        list: usersWithOnline,
        total: countResult[0].total,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 获取用户详情
 * GET /api/admin/users/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // 用户基本信息
    const [userRows] = await pool.execute(
      `SELECT id, account, nickname, avatar, signature, status, banned_at, banned_reason, created_at
       FROM users WHERE id = ?`,
      [id]
    );

    if (userRows.length === 0) {
      throw new AppError('用户不存在', 404);
    }

    const user = userRows[0];

    // 好友数量
    const [friendCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM friendships WHERE user_id = ?',
      [id]
    );

    // 群组数量
    const [groupCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM group_members WHERE user_id = ?',
      [id]
    );

    // 消息数量
    const [messageCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM messages WHERE sender_id = ?',
      [id]
    );

    // 推荐链接
    const [referralLink] = await pool.execute(
      'SELECT * FROM referral_links WHERE user_id = ?',
      [id]
    );

    // 在线状态
    const online = await redisClient.get(`online:${id}`);

    res.json({
      code: 200,
      data: {
        ...user,
        is_online: !!online,
        friend_count: friendCount[0].count,
        group_count: groupCount[0].count,
        message_count: messageCount[0].count,
        referral_link: referralLink[0] || null
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 更新用户信息
 * PUT /api/admin/users/:id
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nickname, avatar, signature } = req.body;

    // 检查用户是否存在
    const [userRows] = await pool.execute('SELECT id FROM users WHERE id = ?', [id]);
    if (userRows.length === 0) {
      throw new AppError('用户不存在', 404);
    }

    const fields = [];
    const values = [];

    if (nickname !== undefined) {
      fields.push('nickname = ?');
      values.push(nickname);
    }
    if (avatar !== undefined) {
      fields.push('avatar = ?');
      values.push(avatar);
    }
    if (signature !== undefined) {
      fields.push('signature = ?');
      values.push(signature);
    }

    if (fields.length === 0) {
      throw new AppError('没有要更新的数据', 400);
    }

    values.push(id);
    await pool.execute(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    res.json({
      code: 200,
      message: '更新成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 封停用户
 * POST /api/admin/users/:id/ban
 */
router.post('/:id/ban', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason = '' } = req.body;

    // 检查用户是否存在
    const [userRows] = await pool.execute('SELECT id, status FROM users WHERE id = ?', [id]);
    if (userRows.length === 0) {
      throw new AppError('用户不存在', 404);
    }

    if (userRows[0].status === 'banned') {
      throw new AppError('用户已被封停', 400);
    }

    // 更新用户状态
    await pool.execute(
      'UPDATE users SET status = ?, banned_at = NOW(), banned_reason = ? WHERE id = ?',
      ['banned', reason, id]
    );

    // 通过 Socket.io 强制用户下线
    try {
      const io = getIO();
      io.to(`user_${id}`).emit('force_logout', {
        reason: 'banned',
        message: reason || '您的账号已被封停'
      });
    } catch (socketError) {
      console.error('发送强制下线事件失败:', socketError);
    }

    // 清除 Redis 在线状态
    await redisClient.del(`online:${id}`);

    res.json({
      code: 200,
      message: '封停成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 解封用户
 * POST /api/admin/users/:id/unban
 */
router.post('/:id/unban', async (req, res, next) => {
  try {
    const { id } = req.params;

    // 检查用户是否存在
    const [userRows] = await pool.execute('SELECT id, status FROM users WHERE id = ?', [id]);
    if (userRows.length === 0) {
      throw new AppError('用户不存在', 404);
    }

    if (userRows[0].status !== 'banned') {
      throw new AppError('用户未被封停', 400);
    }

    // 更新用户状态
    await pool.execute(
      'UPDATE users SET status = ?, banned_at = NULL, banned_reason = NULL WHERE id = ?',
      ['active', id]
    );

    res.json({
      code: 200,
      message: '解封成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 获取用户会话列表
 * GET /api/admin/users/:id/conversations
 */
router.get('/:id/conversations', async (req, res, next) => {
  try {
    const { id } = req.params;

    // 检查用户是否存在
    const [userRows] = await pool.execute('SELECT id FROM users WHERE id = ?', [id]);
    if (userRows.length === 0) {
      throw new AppError('用户不存在', 404);
    }

    // 获取用户的所有会话
    const [conversations] = await pool.execute(
      `SELECT c.id, c.type, c.created_at,
              CASE
                WHEN c.type = 'private' THEN (
                  SELECT JSON_OBJECT('id', u.id, 'nickname', u.nickname, 'avatar', u.avatar)
                  FROM conversation_participants cp2
                  JOIN users u ON cp2.user_id = u.id
                  WHERE cp2.conversation_id = c.id AND cp2.user_id != ?
                  LIMIT 1
                )
                WHEN c.type = 'group' THEN (
                  SELECT JSON_OBJECT('id', g.id, 'name', g.name, 'avatar', g.avatar)
                  FROM \`groups\` g
                  WHERE g.id = c.group_id
                )
              END as target,
              (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count,
              (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at
       FROM conversations c
       JOIN conversation_participants cp ON c.id = cp.conversation_id
       WHERE cp.user_id = ?
       ORDER BY last_message_at DESC`,
      [id, id]
    );

    // 解析 target JSON (MySQL 可能返回对象或字符串)
    const result = conversations.map(conv => ({
      ...conv,
      target: conv.target
        ? (typeof conv.target === 'string' ? JSON.parse(conv.target) : conv.target)
        : null
    }));

    res.json({
      code: 200,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 获取用户聊天记录
 * GET /api/admin/users/:id/messages
 */
router.get('/:id/messages', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { conversationId, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // 检查用户是否存在
    const [userRows] = await pool.execute('SELECT id FROM users WHERE id = ?', [id]);
    if (userRows.length === 0) {
      throw new AppError('用户不存在', 404);
    }

    let sql = `
      SELECT m.*, u.nickname as sender_nickname, u.avatar as sender_avatar,
             c.type as conversation_type
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      JOIN conversations c ON m.conversation_id = c.id
      JOIN conversation_participants cp ON c.id = cp.conversation_id AND cp.user_id = ?
    `;
    const params = [id];

    if (conversationId) {
      sql += ' AND m.conversation_id = ?';
      params.push(conversationId);
    }

    // 获取总数
    const countSql = `
      SELECT COUNT(*) as total
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      JOIN conversation_participants cp ON c.id = cp.conversation_id AND cp.user_id = ?
      ${conversationId ? 'AND m.conversation_id = ?' : ''}
    `;
    const countParams = conversationId ? [id, conversationId] : [id];
    const [countResult] = await pool.execute(countSql, countParams);

    // 分页 (LIMIT/OFFSET 直接拼接，确保为整数防止注入)
    const msgLimitInt = parseInt(limit) || 50;
    const msgOffsetInt = parseInt(offset) || 0;
    sql += ` ORDER BY m.created_at DESC LIMIT ${msgLimitInt} OFFSET ${msgOffsetInt}`;

    const [messages] = await pool.execute(sql, params);

    res.json({
      code: 200,
      data: {
        list: messages,
        total: countResult[0].total,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
