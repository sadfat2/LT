const redis = require('../models/redis')
const { v4: uuidv4 } = require('uuid')

function handleRoomEvents(io, socket) {
  const user = socket.user

  // 创建房间
  socket.on('room:create', async (data, callback) => {
    try {
      const { name, baseScore = 100 } = data

      // 检查用户是否已在房间中
      const existingRoomId = await redis.get(`user_room:${user.id}`)
      if (existingRoomId) {
        return callback({ error: '您已在房间中' })
      }

      const roomId = uuidv4()
      const room = {
        id: roomId,
        name: name || `${user.nickname}的房间`,
        baseScore,
        players: [
          {
            id: user.id,
            nickname: user.nickname,
            avatar: user.avatar,
            coins: user.coins,
            seat: 0,
            isReady: false,
            isOnline: true,
            cardCount: 0,
          },
        ],
        maxPlayers: 3,
        status: 'waiting',
        ownerId: user.id,
        createdAt: new Date().toISOString(),
      }

      // 保存房间
      await redis.setJSON(`room:${roomId}`, room, { EX: 3600 })
      await redis.set(`user_room:${user.id}`, roomId, { EX: 3600 })

      // 加入 Socket 房间
      socket.join(roomId)

      callback({ room })
    } catch (error) {
      console.error('创建房间失败:', error)
      callback({ error: '创建房间失败' })
    }
  })

  // 加入房间
  socket.on('room:join', async (data, callback) => {
    try {
      const { roomId } = data

      // 检查用户是否已在房间中
      const existingRoomId = await redis.get(`user_room:${user.id}`)
      if (existingRoomId) {
        return callback({ error: '您已在房间中' })
      }

      // 获取房间信息
      const room = await redis.getJSON(`room:${roomId}`)
      if (!room) {
        return callback({ error: '房间不存在' })
      }

      if (room.status !== 'waiting') {
        return callback({ error: '房间已开始游戏' })
      }

      if (room.players.length >= room.maxPlayers) {
        return callback({ error: '房间已满' })
      }

      // 分配座位
      const usedSeats = new Set(room.players.map((p) => p.seat))
      let seat = 0
      while (usedSeats.has(seat)) seat++

      const player = {
        id: user.id,
        nickname: user.nickname,
        avatar: user.avatar,
        coins: user.coins,
        seat,
        isReady: false,
        isOnline: true,
        cardCount: 0,
      }

      room.players.push(player)

      // 更新房间
      await redis.setJSON(`room:${roomId}`, room, { EX: 3600 })
      await redis.set(`user_room:${user.id}`, roomId, { EX: 3600 })

      // 加入 Socket 房间
      socket.join(roomId)

      // 通知其他玩家
      socket.to(roomId).emit('room:joined', { room, player })

      callback({ room })
    } catch (error) {
      console.error('加入房间失败:', error)
      callback({ error: '加入房间失败' })
    }
  })

  // 离开房间
  socket.on('room:leave', async (data, callback) => {
    try {
      const roomId = await redis.get(`user_room:${user.id}`)
      if (!roomId) {
        return callback({ error: '您不在任何房间中' })
      }

      const room = await redis.getJSON(`room:${roomId}`)
      if (!room) {
        await redis.del(`user_room:${user.id}`)
        return callback({ success: true })
      }

      if (room.status === 'playing') {
        return callback({ error: '游戏进行中不能离开' })
      }

      // 移除玩家
      room.players = room.players.filter((p) => p.id !== user.id)

      // 离开 Socket 房间
      socket.leave(roomId)

      if (room.players.length === 0) {
        // 房间空了，删除
        await redis.del(`room:${roomId}`)
      } else {
        // 如果是房主离开，转移房主
        if (room.ownerId === user.id) {
          room.ownerId = room.players[0].id
        }
        await redis.setJSON(`room:${roomId}`, room, { EX: 3600 })
      }

      await redis.del(`user_room:${user.id}`)

      // 通知其他玩家
      io.to(roomId).emit('room:left', { roomId, playerId: user.id })

      callback({ success: true })
    } catch (error) {
      console.error('离开房间失败:', error)
      callback({ error: '离开房间失败' })
    }
  })

  // 准备
  socket.on('room:ready', async (data, callback) => {
    try {
      const roomId = await redis.get(`user_room:${user.id}`)
      if (!roomId) {
        return callback({ error: '您不在任何房间中' })
      }

      const room = await redis.getJSON(`room:${roomId}`)
      if (!room) {
        return callback({ error: '房间不存在' })
      }

      if (room.status !== 'waiting') {
        return callback({ error: '游戏已开始' })
      }

      // 更新准备状态
      const playerIndex = room.players.findIndex((p) => p.id === user.id)
      if (playerIndex === -1) {
        return callback({ error: '您不在房间中' })
      }

      room.players[playerIndex].isReady = !room.players[playerIndex].isReady
      await redis.setJSON(`room:${roomId}`, room, { EX: 3600 })

      // 通知所有玩家
      io.to(roomId).emit('room:ready', {
        roomId,
        playerId: user.id,
        isReady: room.players[playerIndex].isReady,
      })

      // 检查是否可以开始游戏
      if (room.players.length === 3 && room.players.every((p) => p.isReady)) {
        // 所有人都准备好了，开始游戏
        io.to(roomId).emit('game:starting', { roomId })
      }

      callback({ success: true, isReady: room.players[playerIndex].isReady })
    } catch (error) {
      console.error('准备失败:', error)
      callback({ error: '准备失败' })
    }
  })

  // 踢人
  socket.on('room:kick', async (data, callback) => {
    try {
      const { playerId } = data

      const roomId = await redis.get(`user_room:${user.id}`)
      if (!roomId) {
        return callback({ error: '您不在任何房间中' })
      }

      const room = await redis.getJSON(`room:${roomId}`)
      if (!room) {
        return callback({ error: '房间不存在' })
      }

      if (room.ownerId !== user.id) {
        return callback({ error: '只有房主可以踢人' })
      }

      if (room.status !== 'waiting') {
        return callback({ error: '游戏进行中不能踢人' })
      }

      // 移除玩家
      const kickedPlayer = room.players.find((p) => p.id === playerId)
      if (!kickedPlayer) {
        return callback({ error: '玩家不在房间中' })
      }

      room.players = room.players.filter((p) => p.id !== playerId)
      await redis.setJSON(`room:${roomId}`, room, { EX: 3600 })
      await redis.del(`user_room:${playerId}`)

      // 通知被踢玩家
      const kickedSocketId = await redis.get(`online:${playerId}`)
      if (kickedSocketId) {
        io.to(kickedSocketId).emit('room:kicked', { roomId, playerId })
        io.sockets.sockets.get(kickedSocketId)?.leave(roomId)
      }

      // 通知房间其他玩家
      io.to(roomId).emit('room:left', { roomId, playerId })

      callback({ success: true })
    } catch (error) {
      console.error('踢人失败:', error)
      callback({ error: '踢人失败' })
    }
  })

  // 快速匹配
  socket.on('room:quickMatch', async (data, callback) => {
    try {
      const { baseScore = 100 } = data || {}

      // 检查用户是否已在房间中
      const existingRoomId = await redis.get(`user_room:${user.id}`)
      if (existingRoomId) {
        const existingRoom = await redis.getJSON(`room:${existingRoomId}`)
        if (existingRoom) {
          return callback({ room: existingRoom })
        }
        // 房间不存在，清除关联
        await redis.del(`user_room:${user.id}`)
      }

      // 查找可加入的房间
      const roomKeys = await redis.getClient().keys('room:*')
      let matchedRoom = null

      for (const key of roomKeys) {
        const room = await redis.getJSON(key)
        if (
          room &&
          room.status === 'waiting' &&
          room.players.length < room.maxPlayers &&
          room.baseScore === baseScore
        ) {
          matchedRoom = room
          break
        }
      }

      if (matchedRoom) {
        // 加入已有房间
        const usedSeats = new Set(matchedRoom.players.map((p) => p.seat))
        let seat = 0
        while (usedSeats.has(seat)) seat++

        const player = {
          id: user.id,
          nickname: user.nickname,
          avatar: user.avatar,
          coins: user.coins,
          seat,
          isReady: false,
          isOnline: true,
          cardCount: 0,
        }

        matchedRoom.players.push(player)
        await redis.setJSON(`room:${matchedRoom.id}`, matchedRoom, { EX: 3600 })
        await redis.set(`user_room:${user.id}`, matchedRoom.id, { EX: 3600 })

        socket.join(matchedRoom.id)
        socket.to(matchedRoom.id).emit('room:joined', { room: matchedRoom, player })

        callback({ room: matchedRoom })
      } else {
        // 创建新房间
        const roomId = uuidv4()
        const newRoom = {
          id: roomId,
          name: `${user.nickname}的房间`,
          baseScore,
          players: [
            {
              id: user.id,
              nickname: user.nickname,
              avatar: user.avatar,
              coins: user.coins,
              seat: 0,
              isReady: false,
              isOnline: true,
              cardCount: 0,
            },
          ],
          maxPlayers: 3,
          status: 'waiting',
          ownerId: user.id,
          createdAt: new Date().toISOString(),
        }

        await redis.setJSON(`room:${roomId}`, newRoom, { EX: 3600 })
        await redis.set(`user_room:${user.id}`, roomId, { EX: 3600 })
        socket.join(roomId)

        callback({ room: newRoom })
      }
    } catch (error) {
      console.error('快速匹配失败:', error)
      callback({ error: '快速匹配失败' })
    }
  })

  // 获取房间列表
  socket.on('room:list', async (data, callback) => {
    try {
      const roomKeys = await redis.getClient().keys('room:*')
      const rooms = []

      for (const key of roomKeys) {
        const room = await redis.getJSON(key)
        if (room && room.status === 'waiting') {
          rooms.push({
            id: room.id,
            name: room.name,
            baseScore: room.baseScore,
            playerCount: room.players.length,
            maxPlayers: room.maxPlayers,
            ownerId: room.ownerId,
          })
        }
      }

      callback({ rooms })
    } catch (error) {
      console.error('获取房间列表失败:', error)
      callback({ error: '获取房间列表失败' })
    }
  })
}

module.exports = handleRoomEvents
