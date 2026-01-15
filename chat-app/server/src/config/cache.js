const redisClient = require('./redis');
const User = require('../models/User');
const { Friend } = require('../models/Friend');
const Group = require('../models/Group');

const CACHE_TTL = {
  USER: 300,           // 用户信息 5 分钟
  FRIENDS: 600,        // 好友列表 10 分钟
  GROUP_MEMBERS: 300,  // 群成员 5 分钟
  GROUP_INFO: 600      // 群信息 10 分钟
};

class Cache {
  // ==================== 用户信息缓存 ====================
  static async getUser(userId) {
    const key = `user:${userId}`;
    try {
      const cached = await redisClient.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error('Redis get user error:', error);
    }

    const user = await User.findById(userId);
    if (user) {
      try {
        await redisClient.setEx(key, CACHE_TTL.USER, JSON.stringify(user));
      } catch (error) {
        console.error('Redis set user error:', error);
      }
    }
    return user;
  }

  static async invalidateUser(userId) {
    try {
      await redisClient.del(`user:${userId}`);
    } catch (error) {
      console.error('Redis invalidate user error:', error);
    }
  }

  // ==================== 好友列表缓存 ====================
  static async getFriends(userId) {
    const key = `friends:${userId}`;
    try {
      const cached = await redisClient.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error('Redis get friends error:', error);
    }

    const friends = await Friend.getFriendList(userId);
    try {
      await redisClient.setEx(key, CACHE_TTL.FRIENDS, JSON.stringify(friends));
    } catch (error) {
      console.error('Redis set friends error:', error);
    }
    return friends;
  }

  static async invalidateFriends(userId) {
    try {
      await redisClient.del(`friends:${userId}`);
    } catch (error) {
      console.error('Redis invalidate friends error:', error);
    }
  }

  // ==================== 群成员 ID 缓存（群消息广播用）====================
  static async getGroupMemberIds(groupId) {
    const key = `group_members:${groupId}`;
    try {
      const cached = await redisClient.sMembers(key);

      if (cached && cached.length > 0) {
        return cached.map(id => parseInt(id));
      }
    } catch (error) {
      console.error('Redis get group members error:', error);
    }

    const memberIds = await Group.getMemberIds(groupId);
    if (memberIds.length > 0) {
      try {
        await redisClient.sAdd(key, memberIds.map(String));
        await redisClient.expire(key, CACHE_TTL.GROUP_MEMBERS);
      } catch (error) {
        console.error('Redis set group members error:', error);
      }
    }
    return memberIds;
  }

  static async addGroupMember(groupId, userId) {
    const key = `group_members:${groupId}`;
    try {
      // 只有当缓存存在时才添加，避免创建不完整的缓存
      const exists = await redisClient.exists(key);
      if (exists) {
        await redisClient.sAdd(key, String(userId));
      }
    } catch (error) {
      console.error('Redis add group member error:', error);
    }
  }

  static async removeGroupMember(groupId, userId) {
    const key = `group_members:${groupId}`;
    try {
      await redisClient.sRem(key, String(userId));
    } catch (error) {
      console.error('Redis remove group member error:', error);
    }
  }

  static async invalidateGroupMembers(groupId) {
    try {
      await redisClient.del(`group_members:${groupId}`);
    } catch (error) {
      console.error('Redis invalidate group members error:', error);
    }
  }

  // ==================== 群信息缓存 ====================
  static async getGroup(groupId) {
    const key = `group:${groupId}`;
    try {
      const cached = await redisClient.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error('Redis get group error:', error);
    }

    const group = await Group.findById(groupId);
    if (group) {
      try {
        await redisClient.setEx(key, CACHE_TTL.GROUP_INFO, JSON.stringify(group));
      } catch (error) {
        console.error('Redis set group error:', error);
      }
    }
    return group;
  }

  static async invalidateGroup(groupId) {
    try {
      await redisClient.del(`group:${groupId}`);
    } catch (error) {
      console.error('Redis invalidate group error:', error);
    }
  }

  // ==================== 批量失效 ====================
  static async invalidateFriendsPair(userId1, userId2) {
    await Promise.all([
      this.invalidateFriends(userId1),
      this.invalidateFriends(userId2)
    ]);
  }
}

module.exports = Cache;
