# 聊天应用性能优化方案

> 文档版本: v1.0
> 创建日期: 2026-01-14
> 项目: LT Chat Application

---

## 一、问题背景

通过对现有代码架构和压测结果的分析，识别出以下主要性能瓶颈：

| 优先级 | 问题 | 位置 | 严重程度 |
|--------|------|------|----------|
| P0 | **私聊会话并发竞态** | `Conversation.js:5-42` | 🔴 最严重 |
| P0 | 群聊消息逐个发送 | `socket/index.js:145-151` | 高 |
| P0 | 缺少关键数据库索引 | - | 高 |
| P1 | 会话列表 N+1 查询 | `Conversation.js:48-77` | 高 |
| P1 | Redis 仅存在线状态 | - | 中 |
| P2 | 消息搜索 LIKE 全表扫描 | `Message.js:96` | 中 |

**已完成配置**：
- ✅ MySQL 连接池扩大（生产环境）
- ✅ PM2 双进程部署（生产环境）
- ✅ Socket.io Redis Adapter（多进程消息同步）

---

## 二、P0 紧急优化

### 2.1 私聊会话并发竞态修复

**问题描述**

多人同时向同一用户发起私聊时，`getOrCreatePrivate()` 存在竞态条件：

```
时刻 | 用户A → 用户C           | 用户B → 用户C
-----|------------------------|-----------------------
t0   | 查询会话（不存在）      | 查询会话（不存在）
t1   | 开始事务，INSERT        | 开始事务，INSERT
t2   | 提交成功                | 提交成功
结果 | 创建了2个重复的私聊会话！消息被分散存储
```

**影响**：
- 消息分散在不同会话中，聊天记录被分割
- 用户无法看到完整的对话历史
- 数据库存储冗余数据

**解决方案：Redis 分布式锁**

修改文件：`server/src/models/Conversation.js`

```javascript
const redisClient = require('../config/redis');

// 辅助函数：等待
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
```

**预期效果**：彻底解决重复会话问题

---

### 2.2 群聊消息房间广播

**问题描述**

当前群消息使用 `memberIds.forEach()` 逐个发送：

```javascript
// 当前实现（低效）
memberIds.forEach(memberId => {
  io.to(`user_${memberId}`).emit('new_message', { ... });
});
```

100人群每条消息需要100次 `emit()` 调用。

**解决方案：Socket.io 房间机制**

修改文件：`server/src/socket/index.js`

```javascript
// 1. 用户连接时加入所有群房间
io.on('connection', async (socket) => {
  const userId = socket.userId;

  // 加入个人房间
  socket.join(`user_${userId}`);

  // 加入所有群房间
  try {
    const groups = await Group.getUserGroups(userId);
    for (const group of groups) {
      socket.join(`group_${group.id}`);
      console.log(`用户 ${userId} 加入群房间 group_${group.id}`);
    }
  } catch (error) {
    console.error('加入群房间失败:', error);
  }
});

// 2. 群消息使用房间广播（O(1) 复杂度）
socket.on('send_message', async (data, callback) => {
  // ... 消息创建逻辑 ...

  const group = await Group.findByConversationId(convId);
  if (group) {
    // 使用 socket.to() 广播给房间内所有人（除了发送者）
    socket.to(`group_${group.id}`).emit('new_message', {
      conversationId: convId,
      message
    });
  } else {
    // 私聊消息逻辑保持不变
    io.to(`user_${targetId}`).emit('new_message', {
      conversationId: convId,
      message
    });
  }
});

// 3. 用户加入群时同步更新房间
// 在 Group.invite() 后添加
const invitedSockets = await io.in(`user_${invitedUserId}`).fetchSockets();
for (const s of invitedSockets) {
  s.join(`group_${groupId}`);
}

// 4. 用户退出群时移除房间
// 在 Group.leave() 后添加
const leavingSockets = await io.in(`user_${leavingUserId}`).fetchSockets();
for (const s of leavingSockets) {
  s.leave(`group_${groupId}`);
}
```

**预期效果**：群聊消息延迟降低 90%+

---

### 2.3 添加关键数据库索引

**新建文件**：`server/sql/migrate_performance.sql`

```sql
-- ==============================================
-- 性能优化索引迁移脚本
-- 执行方式: docker exec -i chat-mysql mysql -uroot -proot123456 chat_app < migrate_performance.sql
-- ==============================================

-- 1. 会话更新时间索引（会话列表排序）
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at
ON conversations(updated_at DESC);

-- 2. 消息复合索引（消息分页查询）
CREATE INDEX IF NOT EXISTS idx_messages_conv_created
ON messages(conversation_id, created_at DESC);

-- 3. 未读消息计数索引
CREATE INDEX IF NOT EXISTS idx_messages_unread
ON messages(conversation_id, sender_id, status, created_at);

-- 4. 群成员索引优化
CREATE INDEX IF NOT EXISTS idx_group_members_group_user
ON group_members(group_id, user_id);

-- 5. 会话类型索引（快速定位私聊/群聊）
CREATE INDEX IF NOT EXISTS idx_conversations_type
ON conversations(type);

-- 6. 更新表统计信息
ANALYZE TABLE conversations;
ANALYZE TABLE messages;
ANALYZE TABLE group_members;
ANALYZE TABLE conversation_participants;
```

**执行方式**：

```bash
# 本地执行
docker exec -i chat-mysql mysql -uroot -proot123456 chat_app < chat-app/server/sql/migrate_performance.sql

# 生产环境执行
mysql -h your-host -u your-user -p chat_app < migrate_performance.sql
```

**预期效果**：查询性能提升 50-80%

---

## 三、P1 重要优化

### 3.1 会话列表 N+1 查询优化

**问题描述**

当前 `getUserConversations()` 每个会话包含 3 个相关子查询：
- 获取私聊对方信息
- 获取最后一条消息
- 计算未读消息数

10个会话 = 30次子查询，性能差。

**解决方案：批量查询 + 应用层聚合**

修改文件：`server/src/models/Conversation.js`

```javascript
static async getUserConversations(userId) {
  // 1. 主查询：获取会话基础信息
  const [conversations] = await pool.execute(`
    SELECT c.id, c.type, c.group_id, c.updated_at,
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

  // 3. 批量获取最后消息
  const [lastMessages] = await pool.query(`
    SELECT m.* FROM (
      SELECT m.id, m.conversation_id, m.type, m.content, m.created_at,
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

  // 5. 应用层聚合
  const otherUsersMap = new Map(otherUsers.map(u => [u.conversation_id, u]));
  const lastMessagesMap = new Map(lastMessages.map(m => [m.conversation_id, m]));
  const unreadCountsMap = new Map(unreadCounts.map(c => [c.conversation_id, c.count]));

  return conversations.map(conv => ({
    id: conv.id,
    type: conv.type,
    group_id: conv.group_id,
    updated_at: conv.updated_at,
    other_user: conv.type === 'private' ? otherUsersMap.get(conv.id) : null,
    group: conv.group_info_id ? {
      id: conv.group_info_id,
      name: conv.group_name,
      avatar: conv.group_avatar
    } : null,
    last_message: lastMessagesMap.get(conv.id) || null,
    unread_count: unreadCountsMap.get(conv.id) || 0
  }));
}
```

**预期效果**：
- 查询次数从 O(3n) 降到 O(4) 固定
- 会话列表加载速度提升 60-80%

---

### 3.2 Redis 缓存热点数据

**新建文件**：`server/src/config/cache.js`

```javascript
const redisClient = require('./redis');
const User = require('../models/User');
const Friend = require('../models/Friend');
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
    const cached = await redisClient.get(key);
    if (cached) {
      return JSON.parse(cached);
    }

    const user = await User.findById(userId);
    if (user) {
      await redisClient.setEx(key, CACHE_TTL.USER, JSON.stringify(user));
    }
    return user;
  }

  static async invalidateUser(userId) {
    await redisClient.del(`user:${userId}`);
  }

  // ==================== 好友列表缓存 ====================
  static async getFriends(userId) {
    const key = `friends:${userId}`;
    const cached = await redisClient.get(key);
    if (cached) {
      return JSON.parse(cached);
    }

    const friends = await Friend.getFriendList(userId);
    await redisClient.setEx(key, CACHE_TTL.FRIENDS, JSON.stringify(friends));
    return friends;
  }

  static async invalidateFriends(userId) {
    await redisClient.del(`friends:${userId}`);
  }

  // ==================== 群成员 ID 缓存（群消息广播用）====================
  static async getGroupMemberIds(groupId) {
    const key = `group_members:${groupId}`;
    const cached = await redisClient.sMembers(key);

    if (cached && cached.length > 0) {
      return cached.map(id => parseInt(id));
    }

    const memberIds = await Group.getMemberIds(groupId);
    if (memberIds.length > 0) {
      await redisClient.sAdd(key, memberIds.map(String));
      await redisClient.expire(key, CACHE_TTL.GROUP_MEMBERS);
    }
    return memberIds;
  }

  static async addGroupMember(groupId, userId) {
    const key = `group_members:${groupId}`;
    await redisClient.sAdd(key, String(userId));
  }

  static async removeGroupMember(groupId, userId) {
    const key = `group_members:${groupId}`;
    await redisClient.sRem(key, String(userId));
  }

  static async invalidateGroupMembers(groupId) {
    await redisClient.del(`group_members:${groupId}`);
  }

  // ==================== 群信息缓存 ====================
  static async getGroup(groupId) {
    const key = `group:${groupId}`;
    const cached = await redisClient.get(key);
    if (cached) {
      return JSON.parse(cached);
    }

    const group = await Group.findById(groupId);
    if (group) {
      await redisClient.setEx(key, CACHE_TTL.GROUP_INFO, JSON.stringify(group));
    }
    return group;
  }

  static async invalidateGroup(groupId) {
    await redisClient.del(`group:${groupId}`);
  }
}

module.exports = Cache;
```

**缓存失效策略**：

| 操作 | 需要失效的缓存 |
|------|----------------|
| 更新用户信息 | `user:{userId}` |
| 添加/删除好友 | `friends:{userId}`, `friends:{friendId}` |
| 加入/退出群聊 | `group_members:{groupId}` |
| 更新群信息 | `group:{groupId}` |

**预期效果**：减少 30-50% 数据库查询

---

### 3.3 TURN 凭据 Redis 缓存

修改文件：`server/src/routes/webrtc.js`

```javascript
const redisClient = require('../config/redis');

const TURN_CACHE_KEY = 'turn:credentials';
const TURN_CACHE_TTL = 300; // 5 分钟

router.get('/turn-credentials', authMiddleware, async (req, res) => {
  try {
    // 从 Redis 获取缓存
    const cached = await redisClient.get(TURN_CACHE_KEY);
    if (cached) {
      return res.json({ code: 200, data: JSON.parse(cached) });
    }

    // 从 Cloudflare 获取新凭据
    const response = await fetch('https://speed.cloudflare.com/turn-creds');
    if (!response.ok) {
      throw new Error('获取 TURN 凭据失败');
    }

    const data = await response.json();

    // 存入 Redis（多进程共享）
    await redisClient.setEx(TURN_CACHE_KEY, TURN_CACHE_TTL, JSON.stringify(data));

    res.json({ code: 200, data });
  } catch (error) {
    console.error('获取 TURN 凭据错误:', error);
    res.status(500).json({ code: 500, message: '获取 TURN 凭据失败' });
  }
});
```

---

## 四、P2 中期优化

### 4.1 消息搜索全文索引

添加到 `migrate_performance.sql`：

```sql
-- 消息内容全文索引（需要 MySQL 5.7.6+）
ALTER TABLE messages ADD FULLTEXT INDEX ft_content (content) WITH PARSER ngram;
```

修改 `server/src/models/Message.js`：

```javascript
static async search(userId, keyword, limit = 50) {
  const [rows] = await pool.query(`
    SELECT m.*, u.nickname as sender_nickname, u.avatar as sender_avatar
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    JOIN conversations c ON m.conversation_id = c.id
    JOIN conversation_participants cp ON c.id = cp.conversation_id AND cp.user_id = ?
    WHERE m.type = 'text'
      AND MATCH(m.content) AGAINST (? IN NATURAL LANGUAGE MODE)
      AND m.status != 'revoked'
    ORDER BY m.created_at DESC
    LIMIT ?
  `, [userId, keyword, limit]);

  return rows;
}
```

### 4.2 安装 WebSocket 原生模块

修改 `server/package.json`：

```json
{
  "dependencies": {
    "bufferutil": "^4.0.8",
    "utf-8-validate": "^6.0.3"
  }
}
```

执行：

```bash
cd chat-app/server
npm install bufferutil utf-8-validate
docker-compose up -d --build server
```

**预期效果**：WebSocket 消息处理性能提升约 20%

### 4.3 消息分页游标优化

修改 `server/src/models/Message.js`：

```javascript
static async getByConversationWithCursor(conversationId, cursor = null, limit = 20) {
  let query = `
    SELECT m.id, m.conversation_id, m.sender_id, m.type, m.content,
           m.media_url, m.thumbnail_url, m.duration, m.file_name, m.file_size,
           m.status, m.created_at,
           u.nickname as sender_nickname, u.avatar as sender_avatar
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.conversation_id = ?
  `;
  const params = [conversationId];

  if (cursor) {
    // 游标格式: "timestamp_id" 如 "2024-01-15T10:30:00.000Z_12345"
    const [cursorTime, cursorId] = cursor.split('_');
    query += ` AND (m.created_at < ? OR (m.created_at = ? AND m.id < ?))`;
    params.push(cursorTime, cursorTime, parseInt(cursorId));
  }

  query += ` ORDER BY m.created_at DESC, m.id DESC LIMIT ?`;
  params.push(parseInt(limit) + 1);

  const [rows] = await pool.query(query, params);

  const hasMore = rows.length > limit;
  const messages = hasMore ? rows.slice(0, -1) : rows;

  const nextCursor = hasMore && messages.length > 0
    ? `${messages[messages.length - 1].created_at}_${messages[messages.length - 1].id}`
    : null;

  return {
    messages: messages.reverse(),
    nextCursor,
    hasMore
  };
}
```

**预期效果**：深分页性能从 O(n) 降到 O(1)

---

## 五、P3 长期优化

### 5.1 bcrypt 替换原生版本

```bash
# 替换 bcryptjs 为原生 bcrypt
npm uninstall bcryptjs
npm install bcrypt
```

注意：需要在 Docker 中安装编译工具。

### 5.2 Socket.io msgpack 解析器

服务端和客户端需要同步升级：

```bash
npm install socket.io-msgpack-parser
```

```javascript
// server
const msgpackParser = require('socket.io-msgpack-parser');
const io = new Server(server, { parser: msgpackParser });

// client
import { io } from 'socket.io-client';
import { parser } from 'socket.io-msgpack-parser';
const socket = io(url, { parser });
```

---

## 六、实施顺序

```
阶段1 (最高优先): 并发问题修复
  └── 私聊会话 Redis 分布式锁

阶段2: 通信层优化
  ├── 群聊房间广播机制
  ├── WebSocket 原生模块
  └── Redis 缓存群成员ID

阶段3: 数据库优化
  ├── 添加关键索引
  ├── 连接池配置
  └── 会话列表 N+1 优化

阶段4: 深度优化
  ├── Redis 完整缓存层
  ├── TURN 凭据缓存
  ├── 消息全文索引
  └── 游标分页

阶段5: 进阶优化
  ├── 原生 bcrypt
  └── msgpack 解析器
```

---

## 七、验证方法

### 7.1 并发竞态测试

```bash
# 检查是否有重复的私聊会话
docker exec -it chat-mysql mysql -uroot -proot123456 chat_app -e "
  SELECT user_id, COUNT(*) as conversation_count
  FROM conversation_participants
  WHERE conversation_id IN (
    SELECT id FROM conversations WHERE type = 'private'
  )
  GROUP BY user_id
  HAVING conversation_count > 1
  ORDER BY conversation_count DESC;
"
```

### 7.2 索引验证

```bash
docker exec -it chat-mysql mysql -uroot -proot123456 chat_app -e "
  EXPLAIN SELECT * FROM conversations ORDER BY updated_at DESC LIMIT 50;
  EXPLAIN SELECT * FROM messages WHERE conversation_id = 1 ORDER BY created_at DESC LIMIT 20;
"
```

### 7.3 Redis 缓存监控

```bash
# 监控命中率
docker exec -it chat-redis redis-cli INFO stats | grep -E "keyspace_hits|keyspace_misses"

# 查看缓存 key
docker exec -it chat-redis redis-cli KEYS "*"
```

### 7.4 Socket.io 监控

```javascript
// 添加到 socket/index.js
setInterval(() => {
  const sockets = io.sockets.sockets.size;
  const rooms = io.sockets.adapter.rooms.size;
  console.log(`[Socket.io] 连接数: ${sockets}, 房间数: ${rooms}`);
}, 60000);
```

---

## 八、参考资料

- [Socket.io Performance Tuning](https://socket.io/docs/v4/performance-tuning/)
- [Scaling Socket.IO: Real-world challenges](https://ably.com/topic/scaling-socketio)
- [How To Scale Socket.IO for High-Performance](https://medium.com/devmap/how-to-scale-socket-io-for-high-performance-real-time-systems-7da745f69202)
- [MySQL 10M+ Tables Optimization](https://medium.com/chat2db/optimisation-tips-for-10-million-mysql-tables-ab49b0f0d087)
- [Node.js Real-Time Apps 2025](https://medium.com/@tuteja_lovish/node-js-in-2025-build-ultra-fast-real-time-apps-with-websockets-edge-computing-6bf8a400769d)
- [Password Hashing Algorithms 2025](https://clxon.com/en/blog/password-security-hashing-algorithms-2025)
