const { verifyToken } = require('../middlewares/auth')
const redis = require('../models/redis')
const User = require('../models/User')

// 房间事件处理
const handleRoomEvents = require('./room')
const handleGameEvents = require('./game')

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
            // 游戏中断线，标记为离线
            const playerIndex = room.players.findIndex((p) => p.id === user.id)
            if (playerIndex !== -1) {
              room.players[playerIndex].isOnline = false
              room.players[playerIndex].disconnectTime = Date.now()
              await redis.setJSON(`room:${roomId}`, room, { EX: 3600 })

              // 通知其他玩家
              socket.to(roomId).emit('player:offline', { playerId: user.id })
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

module.exports = initSocket
