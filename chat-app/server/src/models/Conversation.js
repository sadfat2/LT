const pool = require('../config/database');

class Conversation {
  // 获取或创建私聊会话
  static async getOrCreatePrivate(userId1, userId2) {
    // 查找是否存在私聊会话
    const [existing] = await pool.execute(
      `SELECT c.id FROM conversations c
       JOIN conversation_participants cp1 ON c.id = cp1.conversation_id AND cp1.user_id = ?
       JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id = ?
       WHERE c.type = 'private'`,
      [userId1, userId2]
    );

    if (existing.length > 0) {
      return { id: existing[0].id, isNew: false };
    }

    // 创建新会话
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.execute(
        "INSERT INTO conversations (type) VALUES ('private')"
      );
      const conversationId = result.insertId;

      await connection.execute(
        'INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)',
        [conversationId, userId1, conversationId, userId2]
      );

      await connection.commit();
      return { id: conversationId, isNew: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // 获取用户的会话列表
  static async getUserConversations(userId) {
    const [rows] = await pool.execute(
      `SELECT c.id, c.type, c.updated_at,
              (SELECT JSON_OBJECT(
                'id', u.id,
                'nickname', u.nickname,
                'avatar', u.avatar
              )
              FROM conversation_participants cp2
              JOIN users u ON cp2.user_id = u.id
              WHERE cp2.conversation_id = c.id AND cp2.user_id != ?
              LIMIT 1) as other_user,
              (SELECT JSON_OBJECT(
                'id', m.id,
                'type', m.type,
                'content', m.content,
                'sender_id', m.sender_id,
                'created_at', m.created_at
              )
              FROM messages m
              WHERE m.conversation_id = c.id
              ORDER BY m.created_at DESC
              LIMIT 1) as last_message,
              (SELECT COUNT(*)
               FROM messages m
               WHERE m.conversation_id = c.id
               AND m.sender_id != ?
               AND (m.status = 'sent' OR m.status = 'delivered')
               AND m.created_at > COALESCE(cp.last_read_at, '1970-01-01')) as unread_count
       FROM conversations c
       JOIN conversation_participants cp ON c.id = cp.conversation_id AND cp.user_id = ?
       ORDER BY c.updated_at DESC`,
      [userId, userId, userId]
    );

    return rows.map(row => {
      let other_user = row.other_user;
      let last_message = row.last_message;

      // 处理 JSON 字段（可能是字符串或对象）
      if (other_user && typeof other_user === 'string') {
        try {
          other_user = JSON.parse(other_user);
        } catch (e) {
          other_user = null;
        }
      }
      if (last_message && typeof last_message === 'string') {
        try {
          last_message = JSON.parse(last_message);
        } catch (e) {
          last_message = null;
        }
      }

      return {
        ...row,
        other_user,
        last_message
      };
    });
  }

  // 删除会话
  static async delete(id, userId) {
    // 只删除参与者记录，不删除实际会话
    await pool.execute(
      'DELETE FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
      [id, userId]
    );
  }

  // 更新会话时间
  static async updateTime(id) {
    await pool.execute(
      'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
  }

  // 更新已读时间
  static async updateLastRead(conversationId, userId) {
    await pool.execute(
      'UPDATE conversation_participants SET last_read_at = CURRENT_TIMESTAMP WHERE conversation_id = ? AND user_id = ?',
      [conversationId, userId]
    );
  }
}

module.exports = Conversation;
