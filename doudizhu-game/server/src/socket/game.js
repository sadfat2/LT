/**
 * 斗地主游戏 Socket 事件处理
 */

const redis = require('../models/redis')
const GameEngine = require('../game/GameEngine')

// 存储活跃的游戏实例
const activeGames = new Map()

// 回合超时时间（毫秒）
const TURN_TIMEOUT = 30000

function handleGameEvents(io, socket) {
  const user = socket.user

  /**
   * 开始游戏（所有人准备后触发）
   */
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

      // 创建游戏实例
      const game = new GameEngine(roomId, room.players, room.baseScore)
      game.dealCards()

      // 保存游戏实例
      activeGames.set(roomId, game)

      // 更新房间状态
      room.status = 'playing'
      room.gameId = game.gameId
      await redis.setJSON(`room:${roomId}`, room, { EX: 7200 })

      // 向每个玩家发送他们的手牌
      for (const player of game.players) {
        const socketId = await redis.get(`online:${player.id}`)
        if (socketId) {
          io.to(socketId).emit('game:dealt', {
            cards: player.cards,
            seat: player.seat,
          })
        }
      }

      // 广播游戏开始
      io.to(roomId).emit('game:started', {
        gameState: game.getGameState(),
      })

      // 开始叫地主回合
      startBidTurn(io, roomId, game)

      callback({ success: true })
    } catch (error) {
      console.error('开始游戏失败:', error)
      callback({ error: '开始游戏失败' })
    }
  })

  /**
   * 叫地主
   */
  socket.on('game:bid', async (data, callback) => {
    try {
      const { score } = data

      const roomId = await redis.get(`user_room:${user.id}`)
      if (!roomId) {
        return callback({ error: '您不在任何房间中' })
      }

      const game = activeGames.get(roomId)
      if (!game) {
        return callback({ error: '游戏不存在' })
      }

      // 清除超时计时器
      if (game.turnTimeout) {
        clearTimeout(game.turnTimeout)
        game.turnTimeout = null
      }

      const result = game.bid(user.id, score)
      if (!result.success) {
        return callback({ error: result.error })
      }

      // 广播叫分信息
      io.to(roomId).emit('game:bid', {
        bidInfo: {
          seat: game.players.find((p) => p.id === user.id).seat,
          score,
        },
      })

      if (result.decided) {
        if (result.redeal) {
          // 重新发牌
          await handleRedeal(io, roomId, game)
        } else {
          // 地主确定，开始出牌
          io.to(roomId).emit('game:landlord_decided', {
            seat: result.landlordSeat,
            bottomCards: result.bottomCards,
            bidScore: result.bidScore,
          })

          // 开始出牌回合
          startPlayTurn(io, roomId, game)
        }
      } else {
        // 继续叫地主
        startBidTurn(io, roomId, game)
      }

      callback({ success: true })
    } catch (error) {
      console.error('叫地主失败:', error)
      callback({ error: '叫地主失败' })
    }
  })

  /**
   * 出牌
   */
  socket.on('game:play', async (data, callback) => {
    try {
      const { cards } = data

      const roomId = await redis.get(`user_room:${user.id}`)
      if (!roomId) {
        return callback({ error: '您不在任何房间中' })
      }

      const game = activeGames.get(roomId)
      if (!game) {
        return callback({ error: '游戏不存在' })
      }

      // 清除超时计时器
      if (game.turnTimeout) {
        clearTimeout(game.turnTimeout)
        game.turnTimeout = null
      }

      const cardIds = cards.map((c) => c.id)
      const result = game.playCards(user.id, cardIds)

      if (!result.success) {
        return callback({ error: result.error })
      }

      // 广播出牌信息
      io.to(roomId).emit('game:played', {
        playInfo: {
          seat: game.players.find((p) => p.id === user.id).seat,
          cards: result.cards,
          pattern: result.pattern,
          isPass: false,
        },
      })

      if (result.gameOver) {
        // 游戏结束
        await handleGameEnd(io, roomId, game, result)
      } else {
        // 继续出牌
        startPlayTurn(io, roomId, game)
      }

      callback({ success: true })
    } catch (error) {
      console.error('出牌失败:', error)
      callback({ error: '出牌失败' })
    }
  })

  /**
   * 不出
   */
  socket.on('game:pass', async (data, callback) => {
    try {
      const roomId = await redis.get(`user_room:${user.id}`)
      if (!roomId) {
        return callback({ error: '您不在任何房间中' })
      }

      const game = activeGames.get(roomId)
      if (!game) {
        return callback({ error: '游戏不存在' })
      }

      // 清除超时计时器
      if (game.turnTimeout) {
        clearTimeout(game.turnTimeout)
        game.turnTimeout = null
      }

      const result = game.pass(user.id)
      if (!result.success) {
        return callback({ error: result.error })
      }

      // 广播不出信息
      io.to(roomId).emit('game:played', {
        playInfo: {
          seat: game.players.find((p) => p.id === user.id).seat,
          cards: [],
          pattern: null,
          isPass: true,
        },
      })

      // 继续出牌
      startPlayTurn(io, roomId, game)

      callback({ success: true })
    } catch (error) {
      console.error('不出失败:', error)
      callback({ error: '不出失败' })
    }
  })

  /**
   * 获取提示
   */
  socket.on('game:hint', async (data, callback) => {
    try {
      const roomId = await redis.get(`user_room:${user.id}`)
      if (!roomId) {
        return callback({ error: '您不在任何房间中' })
      }

      const game = activeGames.get(roomId)
      if (!game) {
        return callback({ error: '游戏不存在' })
      }

      const hintCards = game.getHint(user.id)
      callback({ cards: hintCards || [] })
    } catch (error) {
      console.error('获取提示失败:', error)
      callback({ error: '获取提示失败' })
    }
  })

  /**
   * 重连
   */
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

      const game = activeGames.get(roomId)
      if (!game) {
        return callback({ error: '游戏实例不存在' })
      }

      // 更新玩家在线状态
      game.playerReconnect(user.id)

      const playerIndex = room.players.findIndex((p) => p.id === user.id)
      if (playerIndex !== -1) {
        room.players[playerIndex].isOnline = true
        room.players[playerIndex].disconnectTime = null
        await redis.setJSON(`room:${roomId}`, room, { EX: 7200 })
      }

      // 重新加入 Socket 房间
      socket.join(roomId)

      // 通知其他玩家
      socket.to(roomId).emit('player:online', { playerId: user.id })

      // 返回完整游戏状态
      const gameState = game.getGameState(user.id)
      const playerCards = game.getPlayerCards(user.id)

      callback({
        success: true,
        gameState,
        cards: playerCards,
      })
    } catch (error) {
      console.error('重连失败:', error)
      callback({ error: '重连失败' })
    }
  })
}

/**
 * 开始叫地主回合
 */
function startBidTurn(io, roomId, game) {
  const currentPlayer = game.players[game.currentSeat]

  // 广播当前回合
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
        await handleGameEnd(io, roomId, game, result)
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

/**
 * 处理游戏结束
 */
async function handleGameEnd(io, roomId, game, result) {
  // 清除计时器
  if (game.turnTimeout) {
    clearTimeout(game.turnTimeout)
    game.turnTimeout = null
  }

  // 广播游戏结束
  io.to(roomId).emit('game:ended', {
    winnerId: result.winnerId,
    results: result.results,
    multiplier: result.multiplier,
    isSpring: result.isSpring,
    bombCount: result.bombCount,
  })

  // 更新玩家金币和战绩
  const User = require('../models/User')

  for (const playerResult of result.results) {
    try {
      // 更新金币
      await User.updateCoins(playerResult.playerId, playerResult.coinChange)

      // 更新战绩
      await User.updateStats(playerResult.playerId, playerResult.isWin)

      // 记录游戏记录
      await recordGameResult(roomId, game.gameId, playerResult, result.multiplier)
    } catch (error) {
      console.error('更新玩家数据失败:', error)
    }
  }

  // 清理游戏实例
  activeGames.delete(roomId)

  // 重置房间状态
  const room = await redis.getJSON(`room:${roomId}`)
  if (room) {
    room.status = 'waiting'
    room.gameId = null
    room.players.forEach((p) => {
      p.isReady = false
      p.cardCount = 0
    })
    await redis.setJSON(`room:${roomId}`, room, { EX: 3600 })
  }
}

/**
 * 记录游戏结果到数据库
 */
async function recordGameResult(roomId, gameId, playerResult, multiplier) {
  const db = require('../models/db')

  // 记录游戏记录
  await db.query(
    `INSERT INTO game_records
     (user_id, room_id, role, is_win, coin_change, multiplier, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [playerResult.playerId, roomId, playerResult.role, playerResult.isWin ? 1 : 0, playerResult.coinChange, multiplier]
  )

  // 记录交易记录
  const type = playerResult.coinChange >= 0 ? 'game_win' : 'game_lose'
  const description = playerResult.isWin
    ? `斗地主胜利 (${playerResult.role === 'landlord' ? '地主' : '农民'})，${multiplier}倍`
    : `斗地主失败 (${playerResult.role === 'landlord' ? '地主' : '农民'})，${multiplier}倍`

  await db.query(
    `INSERT INTO transactions
     (user_id, type, amount, description, created_at)
     VALUES (?, ?, ?, ?, NOW())`,
    [playerResult.playerId, type, playerResult.coinChange, description]
  )
}

/**
 * 处理玩家断线
 */
function handlePlayerDisconnect(io, roomId, userId) {
  const game = activeGames.get(roomId)
  if (game) {
    game.playerDisconnect(userId)

    // 通知其他玩家
    io.to(roomId).emit('player:offline', { playerId: userId })

    // 如果是当前玩家的回合，设置断线超时
    const currentPlayer = game.players[game.currentSeat]
    if (currentPlayer && currentPlayer.id === userId) {
      // 断线后30秒自动处理
      setTimeout(() => {
        const player = game.players.find((p) => p.id === userId)
        if (player && !player.isOnline) {
          game.handleTimeout()
        }
      }, 30000)
    }
  }
}

module.exports = handleGameEvents
module.exports.handlePlayerDisconnect = handlePlayerDisconnect
module.exports.activeGames = activeGames
