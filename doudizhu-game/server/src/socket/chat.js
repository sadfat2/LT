const redis = require('../models/redis')

// 表情列表
const EMOJIS = {
  laugh: { id: 'laugh', name: '哈哈' },
  angry: { id: 'angry', name: '生气' },
  cry: { id: 'cry', name: '哭' },
  think: { id: 'think', name: '思考' },
  cool: { id: 'cool', name: '酷' },
  surprise: { id: 'surprise', name: '惊讶' },
  sweat: { id: 'sweat', name: '流汗' },
  love: { id: 'love', name: '喜欢' },
}

// 快捷消息列表
const QUICK_MESSAGES = {
  hurry: { id: 'hurry', text: '快点啊，等得花儿都谢了！' },
  nice: { id: 'nice', text: '打得真好！' },
  bomb: { id: 'bomb', text: '炸弹炸死你！' },
  sorry: { id: 'sorry', text: '不好意思，我断线了' },
  lucky: { id: 'lucky', text: '运气真好！' },
  gg: { id: 'gg', text: 'GG，下次再来！' },
  again: { id: 'again', text: '再来一局？' },
  thanks: { id: 'thanks', text: '谢谢配合！' },
}

// 频率限制配置
const RATE_LIMIT = {
  maxMessages: 5, // 最大消息数
  windowMs: 10000, // 时间窗口（10秒）
}

/**
 * 检查频率限制
 * @param {number} userId - 用户ID
 * @returns {Promise<boolean>} - 是否允许发送
 */
async function checkRateLimit(userId) {
  const key = `chat_rate:${userId}`
  const now = Date.now()
  const windowStart = now - RATE_LIMIT.windowMs

  // 使用 Redis 排序集合存储消息时间戳
  const client = redis.getClient()

  // 移除过期的记录
  await client.zRemRangeByScore(key, 0, windowStart)

  // 获取当前窗口内的消息数
  const count = await client.zCard(key)

  if (count >= RATE_LIMIT.maxMessages) {
    return false
  }

  // 添加新记录
  await client.zAdd(key, { score: now, value: String(now) })
  // 设置过期时间
  await client.expire(key, Math.ceil(RATE_LIMIT.windowMs / 1000) + 1)

  return true
}

function handleChatEvents(io, socket) {
  const user = socket.user

  // 发送表情
  socket.on('chat:emoji', async (data, callback) => {
    try {
      const { emojiId } = data

      // 验证表情ID
      if (!EMOJIS[emojiId]) {
        return callback({ error: '无效的表情' })
      }

      // 检查用户是否在房间中
      const roomId = await redis.get(`user_room:${user.id}`)
      if (!roomId) {
        return callback({ error: '您不在任何房间中' })
      }

      // 检查频率限制
      const allowed = await checkRateLimit(user.id)
      if (!allowed) {
        return callback({ error: '发送太频繁，请稍后再试' })
      }

      // 广播表情到房间
      io.to(roomId).emit('chat:emoji', {
        roomId,
        playerId: user.id,
        emojiId,
        emoji: EMOJIS[emojiId],
      })

      callback({ success: true })
    } catch (error) {
      console.error('发送表情失败:', error)
      callback({ error: '发送表情失败' })
    }
  })

  // 发送快捷消息
  socket.on('chat:quick', async (data, callback) => {
    try {
      const { messageId } = data

      // 验证消息ID
      if (!QUICK_MESSAGES[messageId]) {
        return callback({ error: '无效的快捷消息' })
      }

      // 检查用户是否在房间中
      const roomId = await redis.get(`user_room:${user.id}`)
      if (!roomId) {
        return callback({ error: '您不在任何房间中' })
      }

      // 检查频率限制
      const allowed = await checkRateLimit(user.id)
      if (!allowed) {
        return callback({ error: '发送太频繁，请稍后再试' })
      }

      // 广播快捷消息到房间
      io.to(roomId).emit('chat:quick', {
        roomId,
        playerId: user.id,
        messageId,
        message: QUICK_MESSAGES[messageId],
      })

      callback({ success: true })
    } catch (error) {
      console.error('发送快捷消息失败:', error)
      callback({ error: '发送快捷消息失败' })
    }
  })

  // 获取表情列表
  socket.on('chat:emojis', async (data, callback) => {
    callback({ emojis: Object.values(EMOJIS) })
  })

  // 获取快捷消息列表
  socket.on('chat:quickMessages', async (data, callback) => {
    callback({ messages: Object.values(QUICK_MESSAGES) })
  })
}

module.exports = handleChatEvents
module.exports.EMOJIS = EMOJIS
module.exports.QUICK_MESSAGES = QUICK_MESSAGES
