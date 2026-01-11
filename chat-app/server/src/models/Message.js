const pool = require('../config/database');

class Message {
  // 创建消息
  static async create(conversationId, senderId, type, content, mediaUrl = null, duration = null, fileName = null, fileSize = null, thumbnailUrl = null) {
    const [result] = await pool.execute(
      `INSERT INTO messages (conversation_id, sender_id, type, content, media_url, duration, file_name, file_size, thumbnail_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [conversationId, senderId, type, content, mediaUrl, duration, fileName, fileSize, thumbnailUrl]
    );
    return result.insertId;
  }

  // 根据ID获取消息
  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT m.id, m.conversation_id, m.sender_id, m.type, m.content,
              m.media_url, m.thumbnail_url, m.duration, m.file_name, m.file_size,
              m.status, m.created_at,
              u.nickname as sender_nickname, u.avatar as sender_avatar
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
      `SELECT m.id, m.conversation_id, m.sender_id, m.type, m.content,
              m.media_url, m.thumbnail_url, m.duration, m.file_name, m.file_size,
              m.status, m.created_at,
              u.nickname as sender_nickname, u.avatar as sender_avatar
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

  // 搜索消息
  static async search(userId, keyword, limit = 50) {
    const searchKeyword = `%${keyword}%`;
    // 确保 limit 是有效的正整数
    const safeLimit = Math.max(1, Math.min(100, parseInt(limit) || 50));
    const [rows] = await pool.query(
      `SELECT m.id, m.conversation_id, m.sender_id, m.type, m.content,
              m.media_url, m.duration, m.file_name, m.file_size, m.status, m.created_at,
              u.nickname as sender_nickname, u.avatar as sender_avatar,
              c.type as conversation_type,
              -- 私聊对方信息
              ou.id as other_user_id, ou.nickname as other_user_nickname, ou.avatar as other_user_avatar,
              -- 群聊信息
              g.id as group_id, g.name as group_name, g.avatar as group_avatar
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       JOIN conversations c ON m.conversation_id = c.id
       JOIN conversation_participants cp ON c.id = cp.conversation_id AND cp.user_id = ?
       LEFT JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id != ? AND c.type = 'private'
       LEFT JOIN users ou ON cp2.user_id = ou.id
       LEFT JOIN \`groups\` g ON c.group_id = g.id
       WHERE m.type = 'text' AND m.content LIKE ? AND m.status != 'revoked'
       ORDER BY m.created_at DESC
       LIMIT ?`,
      [userId, userId, searchKeyword, safeLimit]
    );
    return rows;
  }
}

module.exports = Message;
