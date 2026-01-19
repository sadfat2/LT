const crypto = require('crypto')
const { verifyToken } = require('../middlewares/auth')
const redis = require('../models/redis')
const User = require('../models/User')

// 房间事件处理
const handleRoomEvents = require('./room')
const handleGameEvents = require('./game')
const handleChatEvents = require('./chat')

// 断线超时时间（毫秒）
const RECONNECT_TIMEOUT = 60000

// 存储断线超时定时器
const disconnectTimers = new Map()

function initSocket(io) {
  // JWT 认证中间件
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token

    if (!token) {
      return next(new Error('认证失败：未提供 token'))
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return next(new Error('认证失败：无效的 token'))
    }

    // 获取用户信息
    const user = await User.findById(decoded.id)
    if (!user) {
      return next(new Error('认证失败：用户不存在'))
    }

    socket.user = User.formatUser(user)
    next()
  })

  io.on('connection', async (socket) => {
    const user = socket.user
    console.log(`用户连接: ${user.nickname} (${user.id})`)

    // 存储在线状态
    await redis.set(`online:${user.id}`, socket.id, { EX: 86400 })

    // 添加到在线用户集合
    await redis.sAdd('online_users', String(user.id))

    // 广播用户上线
    socket.broadcast.emit('user:online', { userId: user.id, nickname: user.nickname })

    // 获取在线用户列表
    socket.on('online:list', async (callback) => {
      try {
        const onlineUserIds = await redis.sMembers('online_users')
        callback({ userIds: onlineUserIds.map(id => parseInt(id)) })
      } catch (error) {
        callback({ error: '获取在线用户列表失败' })
      }
    })

    // 检查用户是否在线
    socket.on('online:check', async (data, callback) => {
      try {
        const { userId } = data
        const isOnline = await redis.sIsMember('online_users', String(userId))
        callback({ userId, isOnline })
      } catch (error) {
        callback({ error: '检查在线状态失败' })
      }
    })

    // 绑定房间事件
    handleRoomEvents(io, socket)

    // 绑定游戏事件
    handleGameEvents(io, socket)

    // 绑定聊天事件
    handleChatEvents(io, socket)

    // 断开连接
    socket.on('disconnect', async () => {
      console.log(`用户断开: ${user.nickname} (${user.id})`)

      // 清除在线状态
      await redis.del(`online:${user.id}`)

      // 从在线用户集合移除
      await redis.sRem('online_users', String(user.id))

      // 广播用户下线
      socket.broadcast.emit('user:offline', { userId: user.id })

      // 检查用户是否在房间中
      const roomId = await redis.get(`user_room:${user.id}`)
      if (roomId) {
        // 处理断线逻辑
        const room = await redis.getJSON(`room:${roomId}`)
        if (room) {
          if (room.status === 'playing') {
            // 游戏中断线，标记为离线并生成重连 token
            const playerIndex = room.players.findIndex((p) => p.id === user.id)
            if (playerIndex !== -1) {
              // 生成重连 token
              const reconnectToken = crypto.randomBytes(16).toString('hex')

              room.players[playerIndex].isOnline = false
              room.players[playerIndex].disconnectTime = Date.now()
              room.players[playerIndex].reconnectToken = reconnectToken
              await redis.setJSON(`room:${roomId}`, room, { EX: 3600 })

              // 存储重连信息到 Redis（60秒过期）
              await redis.setJSON(`reconnect:${user.id}`, {
                roomId,
                token: reconnectToken,
                disconnectTime: Date.now(),
              }, { EX: 60 })

              // 通知其他玩家
              socket.to(roomId).emit('player:offline', {
                playerId: user.id,
                timeout: RECONNECT_TIMEOUT / 1000, // 告知前端超时时间（秒）
              })

              console.log(`玩家 ${user.nickname} 断线，60秒内可重连，token: ${reconnectToken}`)

              // 检查是否所有玩家都已离线
              const { activeGames, handleAllPlayersDisconnected } = require('./game')
              const game = activeGames.get(roomId)

              // 调试日志
              const playersStatus = room.players.map(p => ({ id: p.id, nickname: p.nickname, isOnline: p.isOnline }))
              console.log(`[断线检测] 房间=${roomId}, 游戏存在=${!!game}, 玩家状态:`, JSON.stringify(playersStatus))

              const allOffline = room.players.every((p) => !p.isOnline)
              console.log(`[断线检测] 所有玩家离线=${allOffline}`)

              if (allOffline) {
                console.log(`所有玩家都已离线，立即清理: 房间=${roomId}`)
                if (game) {
                  // 游戏实例存在，调用完整清理
                  await handleAllPlayersDisconnected(io, roomId, game)
                } else {
                  // 游戏实例不存在（可能服务器重启过），直接清理房间数据
                  console.log(`游戏实例不存在，直接清理房间数据`)
                  for (const player of room.players) {
                    await redis.del(`user_room:${player.id}`)
                    await redis.del(`reconnect:${player.id}`)
                    // 取消断线超时定时器
                    const timerId = disconnectTimers.get(player.id)
                    if (timerId) {
                      clearTimeout(timerId)
                      disconnectTimers.delete(player.id)
                    }
                  }
                  await redis.del(`room:${roomId}`)
                  console.log(`房间数据已清理: 房间=${roomId}`)
                }
                return // 不再设置超时定时器
              }

              // 设置60秒超时定时器
              const timerId = setTimeout(async () => {
                await handleDisconnectTimeout(io, roomId, user.id)
              }, RECONNECT_TIMEOUT)

              // 存储定时器以便重连时取消
              disconnectTimers.set(user.id, timerId)
            }
          } else {
            // 等待中断线，直接离开房间
            room.players = room.players.filter((p) => p.id !== user.id)
            if (room.players.length === 0) {
              await redis.del(`room:${roomId}`)
            } else {
              await redis.setJSON(`room:${roomId}`, room, { EX: 3600 })
              io.to(roomId).emit('room:left', { roomId, playerId: user.id })
            }
            await redis.del(`user_room:${user.id}`)
          }
        }
      }
    })
  })
}

/**
 * 处理断线超时（60秒未重连）
 */
async function handleDisconnectTimeout(io, roomId, userId) {
  console.log(`玩家 ${userId} 断线超时，处理游戏结束`)

  // 清除定时器引用
  disconnectTimers.delete(userId)

  // 清除重连信息
  await redis.del(`reconnect:${userId}`)

  // 获取游戏实例
  const { activeGames, handleDisconnectForceEnd } = require('./game')
  const game = activeGames.get(roomId)

  if (!game) {
    console.log(`游戏实例不存在，跳过超时处理`)
    return
  }

  // 检查玩家是否仍然离线
  const player = game.players.find((p) => p.id === userId)
  if (!player || player.isOnline) {
    console.log(`玩家已重连，跳过超时处理`)
    return
  }

  // 处理断线判负
  await handleDisconnectForceEnd(io, roomId, userId, game)
}

/**
 * 取消断线超时定时器（玩家重连时调用）
 */
function cancelDisconnectTimer(userId) {
  const timerId = disconnectTimers.get(userId)
  if (timerId) {
    clearTimeout(timerId)
    disconnectTimers.delete(userId)
    console.log(`已取消玩家 ${userId} 的断线超时定时器`)
  }
}

module.exports = initSocket
module.exports.cancelDisconnectTimer = cancelDisconnectTimer
