const pool = require('../config/database');

class Friend {
  // 获取好友列表（按拼音排序）
  static async getFriendList(userId) {
    const [rows] = await pool.execute(
      `SELECT u.id, u.account, u.nickname, u.avatar, u.signature, u.pinyin
       FROM friendships f
       JOIN users u ON f.friend_id = u.id
       WHERE f.user_id = ?
       ORDER BY u.pinyin ASC`,
      [userId]
    );
    return rows;
  }

  // 检查是否已是好友
  static async isFriend(userId, friendId) {
    const [rows] = await pool.execute(
      'SELECT id FROM friendships WHERE user_id = ? AND friend_id = ?',
      [userId, friendId]
    );
    return rows.length > 0;
  }

  // 添加好友关系（双向）
  static async addFriend(userId, friendId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.execute(
        'INSERT INTO friendships (user_id, friend_id) VALUES (?, ?)',
        [userId, friendId]
      );
      await connection.execute(
        'INSERT INTO friendships (user_id, friend_id) VALUES (?, ?)',
        [friendId, userId]
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

  // 删除好友关系（双向）
  static async removeFriend(userId, friendId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.execute(
        'DELETE FROM friendships WHERE user_id = ? AND friend_id = ?',
        [userId, friendId]
      );
      await connection.execute(
        'DELETE FROM friendships WHERE user_id = ? AND friend_id = ?',
        [friendId, userId]
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
}

class FriendRequest {
  // 创建好友申请
  static async create(fromUserId, toUserId, message = '') {
    // 检查是否已有待处理的申请
    const [existing] = await pool.execute(
      `SELECT id FROM friend_requests
       WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'`,
      [fromUserId, toUserId]
    );

    if (existing.length > 0) {
      return { id: existing[0].id, isNew: false };
    }

    const [result] = await pool.execute(
      'INSERT INTO friend_requests (from_user_id, to_user_id, message) VALUES (?, ?, ?)',
      [fromUserId, toUserId, message]
    );
    return { id: result.insertId, isNew: true };
  }

  // 获取收到的好友申请列表
  static async getReceivedRequests(userId) {
    const [rows] = await pool.execute(
      `SELECT fr.id, fr.from_user_id, fr.message, fr.status, fr.created_at,
              u.account, u.nickname, u.avatar
       FROM friend_requests fr
       JOIN users u ON fr.from_user_id = u.id
       WHERE fr.to_user_id = ?
       ORDER BY fr.created_at DESC`,
      [userId]
    );
    return rows;
  }

  // 获取发出的好友申请列表
  static async getSentRequests(userId) {
    const [rows] = await pool.execute(
      `SELECT fr.id, fr.to_user_id, fr.message, fr.status, fr.created_at,
              u.account, u.nickname, u.avatar
       FROM friend_requests fr
       JOIN users u ON fr.to_user_id = u.id
       WHERE fr.from_user_id = ?
       ORDER BY fr.created_at DESC`,
      [userId]
    );
    return rows;
  }

  // 根据ID获取申请
  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM friend_requests WHERE id = ?',
      [id]
    );
    return rows[0];
  }

  // 更新申请状态
  static async updateStatus(id, status) {
    await pool.execute(
      'UPDATE friend_requests SET status = ? WHERE id = ?',
      [status, id]
    );
  }

  // 获取待处理申请数量
  static async getPendingCount(userId) {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) as count FROM friend_requests
       WHERE to_user_id = ? AND status = 'pending'`,
      [userId]
    );
    return rows[0].count;
  }
}

module.exports = { Friend, FriendRequest };
