const redis = require('../models/redis')
const config = require('../config')

// TODO: 在阶段七实现完整的游戏逻辑

function handleGameEvents(io, socket) {
  const user = socket.user

  // 开始游戏（所有人准备后触发）
  socket.on('game:start', async (data, callback) => {
    try {
      const roomId = await redis.get(`user_room:${user.id}`)
      if (!roomId) {
        return callback({ error: '您不在任何房间中' })
      }

      const room = await redis.getJSON(`room:${roomId}`)
      if (!room) {
        return callback({ error: '房间不存在' })
      }

      if (room.ownerId !== user.id) {
        return callback({ error: '只有房主可以开始游戏' })
      }

      if (room.players.length !== 3) {
        return callback({ error: '需要3名玩家才能开始游戏' })
      }

      if (!room.players.every((p) => p.isReady)) {
        return callback({ error: '还有玩家未准备' })
      }

      // 更新房间状态
      room.status = 'playing'
      await redis.setJSON(`room:${roomId}`, room, { EX: 7200 }) // 游戏中延长到2小时

      // TODO: 实现发牌逻辑
      // 这里先返回占位数据
      io.to(roomId).emit('game:started', {
        roomId,
        message: '游戏开始！（游戏逻辑开发中...）',
      })

      callback({ success: true })
    } catch (error) {
      console.error('开始游戏失败:', error)
      callback({ error: '开始游戏失败' })
    }
  })

  // 叫地主
  socket.on('game:bid', async (data, callback) => {
    try {
      const { score } = data // 0=不叫, 1-3=叫分

      // TODO: 实现叫地主逻辑
      callback({ success: true, message: '叫地主功能开发中...' })
    } catch (error) {
      console.error('叫地主失败:', error)
      callback({ error: '叫地主失败' })
    }
  })

  // 出牌
  socket.on('game:play', async (data, callback) => {
    try {
      const { cards } = data

      // TODO: 实现出牌逻辑
      callback({ success: true, message: '出牌功能开发中...' })
    } catch (error) {
      console.error('出牌失败:', error)
      callback({ error: '出牌失败' })
    }
  })

  // 不出
  socket.on('game:pass', async (data, callback) => {
    try {
      // TODO: 实现不出逻辑
      callback({ success: true, message: '不出功能开发中...' })
    } catch (error) {
      console.error('不出失败:', error)
      callback({ error: '不出失败' })
    }
  })

  // 重连
  socket.on('game:reconnect', async (data, callback) => {
    try {
      const roomId = await redis.get(`user_room:${user.id}`)
      if (!roomId) {
        return callback({ error: '没有进行中的游戏' })
      }

      const room = await redis.getJSON(`room:${roomId}`)
      if (!room || room.status !== 'playing') {
        return callback({ error: '没有进行中的游戏' })
      }

      // 更新玩家在线状态
      const playerIndex = room.players.findIndex((p) => p.id === user.id)
      if (playerIndex === -1) {
        return callback({ error: '您不在游戏中' })
      }

      room.players[playerIndex].isOnline = true
      room.players[playerIndex].disconnectTime = null
      await redis.setJSON(`room:${roomId}`, room, { EX: 7200 })

      // 重新加入 Socket 房间
      socket.join(roomId)

      // 通知其他玩家
      socket.to(roomId).emit('player:online', { playerId: user.id })

      // TODO: 返回完整游戏状态
      callback({ success: true, room, message: '重连成功' })
    } catch (error) {
      console.error('重连失败:', error)
      callback({ error: '重连失败' })
    }
  })
}

module.exports = handleGameEvents
