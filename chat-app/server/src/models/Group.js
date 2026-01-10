const pool = require('../config/database');

class Group {
  // 创建群聊
  static async create(name, ownerId, memberIds) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 创建群组
      const [groupResult] = await connection.execute(
        'INSERT INTO `groups` (name, owner_id) VALUES (?, ?)',
        [name, ownerId]
      );
      const groupId = groupResult.insertId;

      // 添加群主为成员
      await connection.execute(
        'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
        [groupId, ownerId, 'owner']
      );

      // 添加其他成员
      if (memberIds && memberIds.length > 0) {
        const memberValues = memberIds
          .filter(id => id !== ownerId)
          .map(id => `(${groupId}, ${id}, 'member')`)
          .join(', ');
        if (memberValues) {
          await connection.execute(
            `INSERT INTO group_members (group_id, user_id, role) VALUES ${memberValues}`
          );
        }
      }

      // 创建群聊会话
      const [convResult] = await connection.execute(
        "INSERT INTO conversations (type, group_id) VALUES ('group', ?)",
        [groupId]
      );
      const conversationId = convResult.insertId;

      // 添加所有成员为会话参与者
      const allMemberIds = [ownerId, ...memberIds.filter(id => id !== ownerId)];
      const participantValues = allMemberIds.map(id => `(${conversationId}, ${id})`).join(', ');
      await connection.execute(
        `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ${participantValues}`
      );

      await connection.commit();
      return { groupId, conversationId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // 根据ID获取群组
  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT g.*,
              (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
       FROM \`groups\` g
       WHERE g.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  // 获取群组详情（含成员列表）
  static async getDetail(groupId) {
    const [groupRows] = await pool.execute(
      `SELECT g.*,
              (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
              (SELECT id FROM conversations WHERE group_id = g.id LIMIT 1) as conversation_id
       FROM \`groups\` g
       WHERE g.id = ?`,
      [groupId]
    );

    if (groupRows.length === 0) {
      return null;
    }

    const group = groupRows[0];

    // 获取成员列表
    const [members] = await pool.execute(
      `SELECT gm.*, u.id as user_id, u.account, u.nickname, u.avatar
       FROM group_members gm
       JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = ?
       ORDER BY gm.role = 'owner' DESC, gm.joined_at ASC`,
      [groupId]
    );

    return {
      ...group,
      members: members.map(m => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        joined_at: m.joined_at,
        user: {
          id: m.user_id,
          account: m.account,
          nickname: m.nickname,
          avatar: m.avatar
        }
      }))
    };
  }

  // 获取用户的群组列表
  static async getUserGroups(userId) {
    const [rows] = await pool.execute(
      `SELECT g.*,
              (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
              (SELECT id FROM conversations WHERE group_id = g.id LIMIT 1) as conversation_id
       FROM \`groups\` g
       JOIN group_members gm ON g.id = gm.group_id
       WHERE gm.user_id = ?
       ORDER BY g.updated_at DESC`,
      [userId]
    );
    return rows;
  }

  // 检查用户是否是群成员
  static async isMember(groupId, userId) {
    const [rows] = await pool.execute(
      'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );
    return rows.length > 0;
  }

  // 检查用户是否是群主
  static async isOwner(groupId, userId) {
    const [rows] = await pool.execute(
      "SELECT id FROM group_members WHERE group_id = ? AND user_id = ? AND role = 'owner'",
      [groupId, userId]
    );
    return rows.length > 0;
  }

  // 添加成员
  static async addMembers(groupId, userIds, inviterId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 获取会话ID
      const [convRows] = await connection.execute(
        'SELECT id FROM conversations WHERE group_id = ?',
        [groupId]
      );
      const conversationId = convRows[0]?.id;

      // 添加成员到群组
      for (const userId of userIds) {
        // 检查是否已存在
        const [existing] = await connection.execute(
          'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
          [groupId, userId]
        );
        if (existing.length === 0) {
          await connection.execute(
            "INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'member')",
            [groupId, userId]
          );
          // 添加会话参与者
          if (conversationId) {
            await connection.execute(
              'INSERT IGNORE INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)',
              [conversationId, userId]
            );
          }
        }
      }

      // 更新群组时间
      await connection.execute(
        'UPDATE `groups` SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [groupId]
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

  // 移除成员
  static async removeMember(groupId, userId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 获取会话ID
      const [convRows] = await connection.execute(
        'SELECT id FROM conversations WHERE group_id = ?',
        [groupId]
      );
      const conversationId = convRows[0]?.id;

      // 删除群成员
      await connection.execute(
        'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
        [groupId, userId]
      );

      // 删除会话参与者
      if (conversationId) {
        await connection.execute(
          'DELETE FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
          [conversationId, userId]
        );
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // 退出群聊
  static async leave(groupId, userId) {
    // 检查是否是群主
    const isOwner = await this.isOwner(groupId, userId);
    if (isOwner) {
      throw new Error('群主不能直接退出群聊，请先转让群主或解散群聊');
    }
    return this.removeMember(groupId, userId);
  }

  // 更新群信息
  static async update(groupId, data) {
    const fields = [];
    const values = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.avatar !== undefined) {
      fields.push('avatar = ?');
      values.push(data.avatar);
    }

    if (fields.length === 0) {
      return false;
    }

    values.push(groupId);
    await pool.execute(
      `UPDATE \`groups\` SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );
    return true;
  }

  // 解散群聊
  static async dissolve(groupId, userId) {
    // 检查是否是群主
    const isOwner = await this.isOwner(groupId, userId);
    if (!isOwner) {
      throw new Error('只有群主可以解散群聊');
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 获取会话ID
      const [convRows] = await connection.execute(
        'SELECT id FROM conversations WHERE group_id = ?',
        [groupId]
      );
      const conversationId = convRows[0]?.id;

      // 删除会话参与者
      if (conversationId) {
        await connection.execute(
          'DELETE FROM conversation_participants WHERE conversation_id = ?',
          [conversationId]
        );
        // 删除会话
        await connection.execute(
          'DELETE FROM conversations WHERE id = ?',
          [conversationId]
        );
      }

      // 删除群成员（外键级联会自动处理）
      // 删除群组
      await connection.execute(
        'DELETE FROM `groups` WHERE id = ?',
        [groupId]
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

  // 获取群成员ID列表
  static async getMemberIds(groupId) {
    const [rows] = await pool.execute(
      'SELECT user_id FROM group_members WHERE group_id = ?',
      [groupId]
    );
    return rows.map(r => r.user_id);
  }

  // 根据会话ID获取群组
  static async findByConversationId(conversationId) {
    const [rows] = await pool.execute(
      `SELECT g.* FROM \`groups\` g
       JOIN conversations c ON c.group_id = g.id
       WHERE c.id = ?`,
      [conversationId]
    );
    return rows[0] || null;
  }
}

module.exports = Group;
