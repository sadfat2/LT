const pool = require('../config/database');
const bcrypt = require('bcryptjs');

class Admin {
  /**
   * 通过用户名查找管理员
   */
  static async findByUsername(username) {
    const [rows] = await pool.execute(
      'SELECT * FROM admins WHERE username = ?',
      [username]
    );
    return rows[0];
  }

  /**
   * 通过ID查找管理员（不返回密码）
   */
  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT id, username, nickname, avatar, last_login_at, last_login_ip, created_at FROM admins WHERE id = ?',
      [id]
    );
    return rows[0];
  }

  /**
   * 获取所有管理员列表
   */
  static async findAll() {
    const [rows] = await pool.execute(
      'SELECT id, username, nickname, avatar, last_login_at, last_login_ip, created_at FROM admins ORDER BY created_at DESC'
    );
    return rows;
  }

  /**
   * 创建管理员
   */
  static async create(username, password, nickname = null) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO admins (username, password, nickname) VALUES (?, ?, ?)',
      [username, hashedPassword, nickname || username]
    );
    return result.insertId;
  }

  /**
   * 验证密码
   */
  static async verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * 更新管理员信息
   */
  static async update(id, data) {
    const fields = [];
    const values = [];

    if (data.nickname !== undefined) {
      fields.push('nickname = ?');
      values.push(data.nickname);
    }
    if (data.avatar !== undefined) {
      fields.push('avatar = ?');
      values.push(data.avatar);
    }
    if (data.password !== undefined) {
      fields.push('password = ?');
      values.push(await bcrypt.hash(data.password, 10));
    }

    if (fields.length === 0) return false;

    values.push(id);
    await pool.execute(
      `UPDATE admins SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    return true;
  }

  /**
   * 更新最后登录时间和IP
   */
  static async updateLoginInfo(id, ip) {
    await pool.execute(
      'UPDATE admins SET last_login_at = NOW(), last_login_ip = ? WHERE id = ?',
      [ip, id]
    );
  }

  /**
   * 删除管理员
   */
  static async delete(id) {
    const [result] = await pool.execute(
      'DELETE FROM admins WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }

  /**
   * 检查用户名是否已存在
   */
  static async isUsernameExists(username, excludeId = null) {
    let sql = 'SELECT id FROM admins WHERE username = ?';
    const params = [username];

    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }

    const [rows] = await pool.execute(sql, params);
    return rows.length > 0;
  }
}

module.exports = Admin;
