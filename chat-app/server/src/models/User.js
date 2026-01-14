const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const { pinyin } = require('pinyin-pro');

class User {
  // 通过账号查找用户
  static async findByAccount(account) {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE account = ?',
      [account]
    );
    return rows[0];
  }

  // 通过ID查找用户
  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT id, account, nickname, avatar, signature, pinyin, status, created_at FROM users WHERE id = ?',
      [id]
    );
    return rows[0];
  }

  // 创建用户
  static async create(account, password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const defaultNickname = account;
    const pinyinStr = pinyin(defaultNickname, { toneType: 'none', type: 'array' }).join('');

    const [result] = await pool.execute(
      'INSERT INTO users (account, password, nickname, pinyin) VALUES (?, ?, ?, ?)',
      [account, hashedPassword, defaultNickname, pinyinStr]
    );
    return result.insertId;
  }

  // 验证密码
  static async verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  // 更新用户信息
  static async update(id, data) {
    const fields = [];
    const values = [];

    if (data.nickname !== undefined) {
      fields.push('nickname = ?');
      values.push(data.nickname);
      // 更新拼音
      const pinyinStr = pinyin(data.nickname, { toneType: 'none', type: 'array' }).join('');
      fields.push('pinyin = ?');
      values.push(pinyinStr);
    }
    if (data.avatar !== undefined) {
      fields.push('avatar = ?');
      values.push(data.avatar);
    }
    if (data.signature !== undefined) {
      fields.push('signature = ?');
      values.push(data.signature);
    }

    if (fields.length === 0) return false;

    values.push(id);
    await pool.execute(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    return true;
  }

  // 搜索用户
  static async search(keyword, currentUserId) {
    const [rows] = await pool.execute(
      `SELECT id, account, nickname, avatar, signature
       FROM users
       WHERE (account LIKE ? OR nickname LIKE ?) AND id != ?
       LIMIT 20`,
      [`%${keyword}%`, `%${keyword}%`, currentUserId]
    );
    return rows;
  }
}

module.exports = User;
