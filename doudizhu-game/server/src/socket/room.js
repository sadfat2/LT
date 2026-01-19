const redis = require('../models/redis')
const { v4: uuidv4 } = require('uuid')
const GameEngine = require('../game/GameEngine')
const { activeGames } = require('./game')

// 回合超时时间（毫秒）
const TURN_TIMEOUT = 30000

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
        // 所有人都准备好了，自动开始游戏
        try {
          // 创建游戏实例
          const game = new GameEngine(roomId, room.players, room.baseScore)
          game.dealCards()

          // 保存游戏实例
          activeGames.set(roomId, game)

          // 更新房间状态
          room.status = 'playing'
          room.gameId = game.gameId
          await redis.setJSON(`room:${roomId}`, room, { EX: 7200 })

          // 通知所有人游戏即将开始
          console.log(`[游戏] 发送 game:starting 事件`)
          io.to(roomId).emit('game:starting', { roomId })

          // 先广播游戏开始（设置 gameState）
          const gameState = game.getGameState()
          console.log(`[游戏] 发送 game:started 事件, phase=${gameState.phase}, currentSeat=${gameState.currentSeat}`)
          io.to(roomId).emit('game:started', { gameState })

          // 向每个玩家发送他们的手牌
          for (const player of game.players) {
            const socketId = await redis.get(`online:${player.id}`)
            console.log(`[游戏] 发牌给玩家 ${player.id}, socketId=${socketId}, 牌数=${player.cards.length}`)
            if (socketId) {
              io.to(socketId).emit('game:dealt', {
                cards: player.cards,
                seat: player.seat,
              })
            }
          }

          // 开始叫地主回合
          console.log(`[游戏] 开始叫地主回合, currentSeat=${game.currentSeat}`)
          startBidTurn(io, roomId, game)

          console.log(`游戏自动开始: 房间=${roomId}`)
        } catch (error) {
          console.error('自动开始游戏失败:', error)
        }
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

/**
 * 开始叫地主回合
 */
function startBidTurn(io, roomId, game) {
  const currentPlayer = game.players[game.currentSeat]
  console.log(`[叫地主] startBidTurn 被调用, currentSeat=${game.currentSeat}, player=${currentPlayer?.id}`)

  // 广播当前回合
  console.log(`[叫地主] 发送 game:bid_turn 事件, seat=${game.currentSeat}`)
  io.to(roomId).emit('game:bid_turn', {
    seat: game.currentSeat,
    timeout: TURN_TIMEOUT,
  })

  // 设置超时
  game.turnStartTime = Date.now()
  game.turnTimeout = setTimeout(async () => {
    // 超时自动不叫
    const result = game.bid(currentPlayer.id, 0)

    io.to(roomId).emit('game:bid', {
      bidInfo: { seat: game.currentSeat, score: 0 },
    })

    if (result.decided) {
      if (result.redeal) {
        await handleRedeal(io, roomId, game)
      } else {
        io.to(roomId).emit('game:landlord_decided', {
          seat: result.landlordSeat,
          bottomCards: result.bottomCards,
          bidScore: result.bidScore,
        })
        startPlayTurn(io, roomId, game)
      }
    } else {
      startBidTurn(io, roomId, game)
    }
  }, TURN_TIMEOUT)
}

/**
 * 开始出牌回合
 */
function startPlayTurn(io, roomId, game) {
  const currentPlayer = game.players[game.currentSeat]

  // 广播当前回合
  io.to(roomId).emit('game:play_turn', {
    seat: game.currentSeat,
    timeout: TURN_TIMEOUT,
  })

  // 设置超时
  game.turnStartTime = Date.now()
  game.turnTimeout = setTimeout(async () => {
    // 超时自动处理
    const result = game.handleTimeout()

    if (result.success) {
      if (result.isPass) {
        io.to(roomId).emit('game:played', {
          playInfo: {
            seat: game.players.find((p) => p.id === currentPlayer.id).seat,
            cards: [],
            pattern: null,
            isPass: true,
          },
        })
      } else if (result.pattern) {
        io.to(roomId).emit('game:played', {
          playInfo: {
            seat: game.players.find((p) => p.id === currentPlayer.id).seat,
            cards: result.cards,
            pattern: result.pattern,
            isPass: false,
          },
        })
      }

      if (result.gameOver) {
        // 游戏结束逻辑由 game.js 处理
        const { handleGameEnd } = require('./game')
        if (handleGameEnd) {
          await handleGameEnd(io, roomId, game, result)
        }
      } else {
        startPlayTurn(io, roomId, game)
      }
    }
  }, TURN_TIMEOUT)
}

/**
 * 处理重新发牌
 */
async function handleRedeal(io, roomId, game) {
  // 重新创建游戏实例
  const room = await redis.getJSON(`room:${roomId}`)
  const newGame = new GameEngine(roomId, room.players, room.baseScore)
  newGame.dealCards()

  activeGames.set(roomId, newGame)

  // 向每个玩家发送新手牌
  for (const player of newGame.players) {
    const socketId = await redis.get(`online:${player.id}`)
    if (socketId) {
      io.to(socketId).emit('game:dealt', {
        cards: player.cards,
        seat: player.seat,
      })
    }
  }

  // 广播重新开始
  io.to(roomId).emit('game:redeal', {
    gameState: newGame.getGameState(),
  })

  // 重新开始叫地主
  startBidTurn(io, roomId, newGame)
}

module.exports = handleRoomEvents
