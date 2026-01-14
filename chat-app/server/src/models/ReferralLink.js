const pool = require('../config/database');

class ReferralLink {
  /**
   * 生成唯一推荐码
   */
  static generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * 通过ID查找推荐链接
   */
  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT rl.*, u.nickname as user_nickname, u.avatar as user_avatar, u.account as user_account
       FROM referral_links rl
       JOIN users u ON rl.user_id = u.id
       WHERE rl.id = ?`,
      [id]
    );
    return rows[0];
  }

  /**
   * 通过推荐码查找
   */
  static async findByCode(code) {
    const [rows] = await pool.execute(
      `SELECT rl.*, u.nickname as user_nickname, u.avatar as user_avatar, u.account as user_account
       FROM referral_links rl
       JOIN users u ON rl.user_id = u.id
       WHERE rl.code = ?`,
      [code]
    );
    return rows[0];
  }

  /**
   * 通过用户ID查找
   */
  static async findByUserId(userId) {
    const [rows] = await pool.execute(
      'SELECT * FROM referral_links WHERE user_id = ?',
      [userId]
    );
    return rows[0];
  }

  /**
   * 获取推荐链接列表（分页）
   */
  static async findAll(page = 1, limit = 20, userId = null) {
    const offset = (page - 1) * limit;
    let sql = `
      SELECT rl.*, u.nickname as user_nickname, u.avatar as user_avatar, u.account as user_account
      FROM referral_links rl
      JOIN users u ON rl.user_id = u.id
    `;
    const params = [];

    if (userId) {
      sql += ' WHERE rl.user_id = ?';
      params.push(userId);
    }

    // LIMIT/OFFSET 直接拼接，确保为整数防止注入
    const limitInt = parseInt(limit) || 20;
    const offsetInt = parseInt(offset) || 0;
    sql += ` ORDER BY rl.created_at DESC LIMIT ${limitInt} OFFSET ${offsetInt}`;

    const [rows] = await pool.execute(sql, params);

    // 获取总数
    let countSql = 'SELECT COUNT(*) as total FROM referral_links';
    const countParams = [];
    if (userId) {
      countSql += ' WHERE user_id = ?';
      countParams.push(userId);
    }
    const [countResult] = await pool.execute(countSql, countParams);

    return {
      list: rows,
      total: countResult[0].total,
      page,
      limit
    };
  }

  /**
   * 创建推荐链接
   */
  static async create(userId) {
    // 检查用户是否已有推荐链接
    const existing = await this.findByUserId(userId);
    if (existing) {
      throw new Error('该用户已有推荐链接');
    }

    // 生成唯一code
    let code;
    let attempts = 0;
    do {
      code = this.generateCode();
      const [existing] = await pool.execute(
        'SELECT id FROM referral_links WHERE code = ?',
        [code]
      );
      if (existing.length === 0) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      throw new Error('生成推荐码失败，请重试');
    }

    const [result] = await pool.execute(
      'INSERT INTO referral_links (user_id, code) VALUES (?, ?)',
      [userId, code]
    );

    return { id: result.insertId, code };
  }

  /**
   * 切换激活状态
   */
  static async toggleActive(id) {
    await pool.execute(
      'UPDATE referral_links SET is_active = NOT is_active WHERE id = ?',
      [id]
    );
    const link = await this.findById(id);
    return link;
  }

  /**
   * 增加点击次数
   */
  static async incrementClickCount(id) {
    await pool.execute(
      'UPDATE referral_links SET click_count = click_count + 1 WHERE id = ?',
      [id]
    );
  }

  /**
   * 增加注册次数
   */
  static async incrementRegisterCount(id) {
    await pool.execute(
      'UPDATE referral_links SET register_count = register_count + 1 WHERE id = ?',
      [id]
    );
  }

  /**
   * 删除推荐链接
   */
  static async delete(id) {
    const [result] = await pool.execute(
      'DELETE FROM referral_links WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }

  /**
   * 记录推荐注册
   */
  static async recordRegistration(referralLinkId, referrerId, refereeId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 创建注册记录
      await connection.execute(
        'INSERT INTO referral_registrations (referral_link_id, referrer_id, referee_id) VALUES (?, ?, ?)',
        [referralLinkId, referrerId, refereeId]
      );

      // 增加注册计数
      await connection.execute(
        'UPDATE referral_links SET register_count = register_count + 1 WHERE id = ?',
        [referralLinkId]
      );

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取通过该链接注册的用户列表
   */
  static async getRegistrations(referralLinkId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    // LIMIT/OFFSET 直接拼接，确保为整数防止注入
    const limitInt = parseInt(limit) || 20;
    const offsetInt = parseInt(offset) || 0;
    const [rows] = await pool.execute(
      `SELECT rr.*, u.id as user_id, u.account, u.nickname, u.avatar, u.created_at as user_created_at
       FROM referral_registrations rr
       JOIN users u ON rr.referee_id = u.id
       WHERE rr.referral_link_id = ?
       ORDER BY rr.created_at DESC
       LIMIT ${limitInt} OFFSET ${offsetInt}`,
      [referralLinkId]
    );

    const [countResult] = await pool.execute(
      'SELECT COUNT(*) as total FROM referral_registrations WHERE referral_link_id = ?',
      [referralLinkId]
    );

    return {
      list: rows,
      total: countResult[0].total,
      page,
      limit
    };
  }
}

module.exports = ReferralLink;
