const express = require('express');
const pool = require('../../config/database');
const redisClient = require('../../config/redis');
const adminAuth = require('../../middlewares/adminAuth');

const router = express.Router();

// 所有路由都需要管理员认证
router.use(adminAuth);

/**
 * 获取概览数据
 * GET /api/admin/statistics/overview
 */
router.get('/overview', async (req, res, next) => {
  try {
    // 总用户数
    const [totalUsers] = await pool.execute('SELECT COUNT(*) as count FROM users');

    // 今日新增用户
    const [todayNewUsers] = await pool.execute(
      'SELECT COUNT(*) as count FROM users WHERE DATE(created_at) = CURDATE()'
    );

    // 今日活跃用户（今天发送过消息的用户）
    const [todayActiveUsers] = await pool.execute(
      'SELECT COUNT(DISTINCT sender_id) as count FROM messages WHERE DATE(created_at) = CURDATE()'
    );

    // 当前在线用户数（从 Redis 获取）
    const onlineKeys = await redisClient.keys('online:*');
    const onlineCount = onlineKeys.length;

    // 累计消息数
    const [totalMessages] = await pool.execute('SELECT COUNT(*) as count FROM messages');

    // 累计群组数
    const [totalGroups] = await pool.execute('SELECT COUNT(*) as count FROM `groups`');

    // 封停用户数
    const [bannedUsers] = await pool.execute(
      "SELECT COUNT(*) as count FROM users WHERE status = 'banned'"
    );

    // 推荐链接数
    const [totalReferrals] = await pool.execute('SELECT COUNT(*) as count FROM referral_links');

    // 通过推荐注册的用户数
    const [referralRegistrations] = await pool.execute(
      'SELECT COUNT(*) as count FROM referral_registrations'
    );

    res.json({
      code: 200,
      data: {
        total_users: totalUsers[0].count,
        today_new_users: todayNewUsers[0].count,
        today_active_users: todayActiveUsers[0].count,
        online_count: onlineCount,
        total_messages: totalMessages[0].count,
        total_groups: totalGroups[0].count,
        banned_users: bannedUsers[0].count,
        total_referrals: totalReferrals[0].count,
        referral_registrations: referralRegistrations[0].count
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 获取趋势数据
 * GET /api/admin/statistics/trends
 */
router.get('/trends', async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const daysInt = Math.min(parseInt(days), 90); // 最多90天

    // 生成日期列表
    const dates = [];
    for (let i = daysInt - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }

    // 每日新增用户
    const [newUsersData] = await pool.execute(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM users
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [daysInt]
    );

    // 每日活跃用户（发送消息的用户）
    const [activeUsersData] = await pool.execute(
      `SELECT DATE(created_at) as date, COUNT(DISTINCT sender_id) as count
       FROM messages
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [daysInt]
    );

    // 每日消息数
    const [messagesData] = await pool.execute(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM messages
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [daysInt]
    );

    // 将数据转换为日期索引的 Map
    const newUsersMap = new Map(newUsersData.map(r => [r.date.toISOString().split('T')[0], r.count]));
    const activeUsersMap = new Map(activeUsersData.map(r => [r.date.toISOString().split('T')[0], r.count]));
    const messagesMap = new Map(messagesData.map(r => [r.date.toISOString().split('T')[0], r.count]));

    // 填充缺失的日期
    const newUsers = dates.map(date => newUsersMap.get(date) || 0);
    const activeUsers = dates.map(date => activeUsersMap.get(date) || 0);
    const messages = dates.map(date => messagesMap.get(date) || 0);

    res.json({
      code: 200,
      data: {
        dates,
        new_users: newUsers,
        active_users: activeUsers,
        messages
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 获取当前在线用户列表
 * GET /api/admin/statistics/online
 */
router.get('/online', async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // 从 Redis 获取所有在线用户ID
    const onlineKeys = await redisClient.keys('online:*');
    const onlineUserIds = onlineKeys.map(key => parseInt(key.replace('online:', '')));

    if (onlineUserIds.length === 0) {
      return res.json({
        code: 200,
        data: {
          list: [],
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit)
        }
      });
    }

    // 获取在线用户信息
    const placeholders = onlineUserIds.map(() => '?').join(',');
    const [users] = await pool.execute(
      `SELECT id, account, nickname, avatar, created_at
       FROM users
       WHERE id IN (${placeholders})
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...onlineUserIds, parseInt(limit), offset]
    );

    res.json({
      code: 200,
      data: {
        list: users,
        total: onlineUserIds.length,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
