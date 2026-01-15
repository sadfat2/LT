const pool = require('../config/database');
const redisClient = require('../config/redis');

// 辅助函数：等待
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class Conversation {
  // 获取或创建私聊会话（使用 Redis 分布式锁防止并发竞态）
  static async getOrCreatePrivate(userId1, userId2) {
    // 保证用户ID顺序一致性，避免死锁
    const [smallId, bigId] = userId1 < userId2
      ? [userId1, userId2]
      : [userId2, userId1];

    const lockKey = `lock:private:${smallId}:${bigId}`;
    const maxRetries = 10;
    const retryDelay = 100; // ms

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // 尝试获取分布式锁（5秒过期，防止死锁）
      const lockAcquired = await redisClient.set(lockKey, '1', {
        NX: true,  // 仅当 key 不存在时设置
        EX: 5      // 5秒后自动过期
      });

      if (lockAcquired) {
        try {
          // 再次查询会话（double-check）
          const [existing] = await pool.execute(
            `SELECT c.id FROM conversations c
             JOIN conversation_participants cp1 ON c.id = cp1.conversation_id AND cp1.user_id = ?
             JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id = ?
             WHERE c.type = 'private'`,
            [smallId, bigId]
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
              [conversationId, smallId, conversationId, bigId]
            );

            await connection.commit();
            return { id: conversationId, isNew: true };
          } catch (error) {
            await connection.rollback();
            throw error;
          } finally {
            connection.release();
          }
        } finally {
          // 释放锁
          await redisClient.del(lockKey);
        }
      }

      // 未获取到锁，等待后重试
      await sleep(retryDelay);
    }

    // 重试次数用尽，使用降级方案：直接查询
    const [existing] = await pool.execute(
      `SELECT c.id FROM conversations c
       JOIN conversation_participants cp1 ON c.id = cp1.conversation_id AND cp1.user_id = ?
       JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id = ?
       WHERE c.type = 'private'`,
      [smallId, bigId]
    );

    if (existing.length > 0) {
      return { id: existing[0].id, isNew: false };
    }

    throw new Error('无法创建私聊会话：获取锁失败');
  }

  // 获取用户的会话列表（批量查询优化，避免 N+1 问题）
  static async getUserConversations(userId) {
    // 1. 主查询：获取会话基础信息
    const [conversations] = await pool.execute(`
      SELECT c.id, c.type, c.group_id, c.updated_at, cp.last_read_at,
             g.id as group_info_id, g.name as group_name, g.avatar as group_avatar
      FROM conversations c
      JOIN conversation_participants cp ON c.id = cp.conversation_id AND cp.user_id = ?
      LEFT JOIN \`groups\` g ON c.group_id = g.id
      ORDER BY c.updated_at DESC
    `, [userId]);

    if (conversations.length === 0) return [];

    const convIds = conversations.map(c => c.id);
    const placeholders = convIds.map(() => '?').join(',');

    // 2. 批量获取私聊对方信息
    const [otherUsers] = await pool.query(`
      SELECT cp.conversation_id, u.id, u.nickname, u.avatar
      FROM conversation_participants cp
      JOIN users u ON cp.user_id = u.id
      JOIN conversations c ON cp.conversation_id = c.id
      WHERE cp.conversation_id IN (${placeholders})
        AND cp.user_id != ?
        AND c.type = 'private'
    `, [...convIds, userId]);

    // 3. 批量获取最后消息（使用 ROW_NUMBER 窗口函数）
    const [lastMessages] = await pool.query(`
      SELECT m.* FROM (
        SELECT m.id, m.conversation_id, m.type, m.content, m.sender_id, m.created_at, m.status,
               ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY created_at DESC) as rn
        FROM messages m
        WHERE m.conversation_id IN (${placeholders})
      ) m WHERE m.rn = 1
    `, convIds);

    // 4. 批量获取未读数
    const [unreadCounts] = await pool.query(`
      SELECT m.conversation_id, COUNT(*) as count
      FROM messages m
      JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id AND cp.user_id = ?
      WHERE m.conversation_id IN (${placeholders})
        AND m.sender_id != ?
        AND m.status IN ('sent', 'delivered')
        AND m.created_at > COALESCE(cp.last_read_at, '1970-01-01')
      GROUP BY m.conversation_id
    `, [userId, ...convIds, userId]);

    // 5. 批量获取群成员头像（最多4个）
    const groupIds = conversations.filter(c => c.type === 'group' && c.group_id).map(c => c.group_id);
    let groupMembersMap = {};

    if (groupIds.length > 0) {
      const groupPlaceholders = groupIds.map(() => '?').join(',');
      const [members] = await pool.query(`
        SELECT gm.group_id, u.id, u.avatar, u.nickname
        FROM group_members gm
        JOIN users u ON gm.user_id = u.id
        WHERE gm.group_id IN (${groupPlaceholders})
        ORDER BY gm.group_id, gm.joined_at
      `, groupIds);

      // 按群组分组，每组最多取4个
      for (const member of members) {
        if (!groupMembersMap[member.group_id]) {
          groupMembersMap[member.group_id] = [];
        }
        if (groupMembersMap[member.group_id].length < 4) {
          groupMembersMap[member.group_id].push({
            id: member.id,
            avatar: member.avatar,
            nickname: member.nickname
          });
        }
      }
    }

    // 6. 应用层聚合
    const otherUsersMap = new Map(otherUsers.map(u => [u.conversation_id, u]));
    const lastMessagesMap = new Map(lastMessages.map(m => [m.conversation_id, m]));
    const unreadCountsMap = new Map(unreadCounts.map(c => [c.conversation_id, c.count]));

    return conversations.map(conv => {
      const otherUser = otherUsersMap.get(conv.id);
      const lastMsg = lastMessagesMap.get(conv.id);

      // 构建群聊信息
      let group_info = null;
      if (conv.type === 'group' && conv.group_id) {
        group_info = {
          id: conv.group_id,
          name: conv.group_name,
          avatar: conv.group_avatar,
          member_avatars: groupMembersMap[conv.group_id] || []
        };
      }

      return {
        id: conv.id,
        type: conv.type,
        group_id: conv.group_id,
        updated_at: conv.updated_at,
        other_user: conv.type === 'private' && otherUser ? {
          id: otherUser.id,
          nickname: otherUser.nickname,
          avatar: otherUser.avatar
        } : null,
        last_message: lastMsg ? {
          id: lastMsg.id,
          type: lastMsg.type,
          content: lastMsg.content,
          sender_id: lastMsg.sender_id,
          created_at: lastMsg.created_at,
          status: lastMsg.status
        } : null,
        unread_count: unreadCountsMap.get(conv.id) || 0,
        group_info
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

  // 获取私聊会话的另一方用户ID
  static async getOtherParticipant(conversationId, userId) {
    const [rows] = await pool.execute(
      `SELECT cp.user_id FROM conversation_participants cp
       JOIN conversations c ON cp.conversation_id = c.id
       WHERE c.id = ? AND c.type = 'private' AND cp.user_id != ?`,
      [conversationId, userId]
    );
    return rows[0]?.user_id || null;
  }

  // 搜索好友
  static async searchFriends(userId, keyword) {
    const searchKeyword = `%${keyword}%`;
    const [rows] = await pool.query(
      `SELECT u.id, u.account, u.nickname, u.avatar, f.remark
       FROM friendships f
       JOIN users u ON f.friend_id = u.id
       WHERE f.user_id = ?
       AND (u.nickname LIKE ? OR u.account LIKE ? OR f.remark LIKE ?)
       LIMIT 10`,
      [userId, searchKeyword, searchKeyword, searchKeyword]
    );
    return rows;
  }

  // 搜索群聊（按群名或群成员昵称）
  static async searchGroups(userId, keyword) {
    const searchKeyword = `%${keyword}%`;
    const [rows] = await pool.query(
      `SELECT DISTINCT g.id, g.name, g.avatar, g.owner_id,
              (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
              c.id as conversation_id,
              u.nickname as matched_member_nickname,
              u.avatar as matched_member_avatar,
              CASE
                WHEN g.name LIKE ? THEN 'group_name'
                ELSE 'member'
              END as match_type
       FROM \`groups\` g
       JOIN group_members gm ON g.id = gm.group_id AND gm.user_id = ?
       JOIN conversations c ON c.group_id = g.id
       LEFT JOIN group_members gm2 ON g.id = gm2.group_id
       LEFT JOIN users u ON gm2.user_id = u.id
       WHERE g.name LIKE ? OR u.nickname LIKE ? OR u.account LIKE ?
       LIMIT 10`,
      [searchKeyword, userId, searchKeyword, searchKeyword, searchKeyword]
    );
    return rows;
  }
}

module.exports = Conversation;
