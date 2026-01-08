const pool = require('../config/database');

class Message {
  // 创建消息
  static async create(conversationId, senderId, type, content, mediaUrl = null, duration = null) {
    const [result] = await pool.execute(
      `INSERT INTO messages (conversation_id, sender_id, type, content, media_url, duration)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [conversationId, senderId, type, content, mediaUrl, duration]
    );
    return result.insertId;
  }

  // 根据ID获取消息
  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT m.*, u.nickname as sender_nickname, u.avatar as sender_avatar
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.id = ?`,
      [id]
    );
    return rows[0];
  }

  // 获取会话消息（分页）
  static async getByConversation(conversationId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    // 使用 query 而非 execute，因为 LIMIT/OFFSET 在 prepared statement 中有兼容性问题
    const [rows] = await pool.query(
      `SELECT m.*, u.nickname as sender_nickname, u.avatar as sender_avatar
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = ?
       ORDER BY m.created_at DESC
       LIMIT ? OFFSET ?`,
      [conversationId, parseInt(limit), parseInt(offset)]
    );
    return rows.reverse();
  }

  // 更新消息状态
  static async updateStatus(id, status) {
    await pool.execute(
      'UPDATE messages SET status = ? WHERE id = ?',
      [status, id]
    );
  }

  // 批量更新已读状态
  static async markAsRead(conversationId, userId) {
    await pool.execute(
      `UPDATE messages SET status = 'read'
       WHERE conversation_id = ? AND sender_id != ? AND status != 'read' AND status != 'revoked'`,
      [conversationId, userId]
    );
  }

  // 撤回消息
  static async revoke(id, senderId) {
    const [result] = await pool.execute(
      `UPDATE messages SET status = 'revoked', content = '此消息已撤回'
       WHERE id = ? AND sender_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 2 MINUTE)`,
      [id, senderId]
    );
    return result.affectedRows > 0;
  }
}

module.exports = Message;
