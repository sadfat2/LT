const pool = require('../config/database');

class IpRegisterLimit {
  /**
   * 检查 IP 是否可以通过指定推荐链接注册
   * @param {string} ip IP地址
   * @param {number} referralLinkId 推荐链接ID
   * @param {number} maxCount 最大允许次数
   * @returns {boolean} 是否允许注册
   */
  static async canRegister(ip, referralLinkId, maxCount = 1) {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) as count FROM ip_register_limits
       WHERE ip_address = ? AND referral_link_id = ?`,
      [ip, referralLinkId]
    );
    return rows[0].count < maxCount;
  }

  /**
   * 记录 IP 注册
   * @param {string} ip IP地址
   * @param {number} referralLinkId 推荐链接ID
   * @param {number} userId 用户ID
   */
  static async record(ip, referralLinkId, userId) {
    await pool.execute(
      `INSERT INTO ip_register_limits (ip_address, referral_link_id, user_id) VALUES (?, ?, ?)`,
      [ip, referralLinkId, userId]
    );
  }

  /**
   * 获取 IP 通过某推荐链接的注册次数
   * @param {string} ip IP地址
   * @param {number} referralLinkId 推荐链接ID
   * @returns {number} 注册次数
   */
  static async getCount(ip, referralLinkId) {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) as count FROM ip_register_limits
       WHERE ip_address = ? AND referral_link_id = ?`,
      [ip, referralLinkId]
    );
    return rows[0].count;
  }

  /**
   * 获取某推荐链接的所有 IP 注册记录
   * @param {number} referralLinkId 推荐链接ID
   * @returns {Array} 注册记录列表
   */
  static async getByReferralLink(referralLinkId) {
    const [rows] = await pool.execute(
      `SELECT irl.*, u.account, u.nickname
       FROM ip_register_limits irl
       JOIN users u ON irl.user_id = u.id
       WHERE irl.referral_link_id = ?
       ORDER BY irl.created_at DESC`,
      [referralLinkId]
    );
    return rows;
  }
}

module.exports = IpRegisterLimit;
