/**
 * 斗地主游戏 Socket 事件处理
 */

const redis = require('../models/redis')
const GameEngine = require('../game/GameEngine')
const config = require('../config')
const axios = require('axios')

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
      // 获取重连信息
      const reconnectInfo = await redis.getJSON(`reconnect:${user.id}`)
      const roomId = await redis.get(`user_room:${user.id}`)

      if (!roomId && !reconnectInfo) {
        return callback({ error: '没有进行中的游戏' })
      }

      const targetRoomId = roomId || reconnectInfo?.roomId

      const room = await redis.getJSON(`room:${targetRoomId}`)
      if (!room || room.status !== 'playing') {
        // 清除过期的重连信息
        await redis.del(`reconnect:${user.id}`)
        return callback({ error: '没有进行中的游戏' })
      }

      const game = activeGames.get(targetRoomId)
      if (!game) {
        return callback({ error: '游戏实例不存在' })
      }

      // 取消断线超时定时器
      const { cancelDisconnectTimer } = require('./index')
      cancelDisconnectTimer(user.id)

      // 清除重连信息
      await redis.del(`reconnect:${user.id}`)

      // 更新玩家在线状态
      game.playerReconnect(user.id)

      const playerIndex = room.players.findIndex((p) => p.id === user.id)
      if (playerIndex !== -1) {
        room.players[playerIndex].isOnline = true
        room.players[playerIndex].disconnectTime = null
        room.players[playerIndex].reconnectToken = null
        await redis.setJSON(`room:${targetRoomId}`, room, { EX: 7200 })
      }

      // 确保 user_room 映射存在
      await redis.set(`user_room:${user.id}`, targetRoomId, { EX: 7200 })

      // 重新加入 Socket 房间
      socket.join(targetRoomId)

      // 通知其他玩家
      socket.to(targetRoomId).emit('player:online', { playerId: user.id })

      // 返回完整游戏状态
      const gameState = game.getGameState(user.id)
      const playerCards = game.getPlayerCards(user.id)

      console.log(`玩家 ${user.nickname} (${user.id}) 重连成功`)

      callback({
        success: true,
        gameState,
        cards: playerCards,
        roomId: targetRoomId,
      })
    } catch (error) {
      console.error('重连失败:', error)
      callback({ error: '重连失败' })
    }
  })

  /**
   * 退出游戏
   */
  socket.on('game:quit', async (data, callback) => {
    try {
      const roomId = await redis.get(`user_room:${user.id}`)
      if (!roomId) {
        return callback({ success: true }) // 本来就不在房间中
      }

      const room = await redis.getJSON(`room:${roomId}`)
      if (!room) {
        // 房间不存在，清理用户映射
        await redis.del(`user_room:${user.id}`)
        return callback({ success: true })
      }

      const game = activeGames.get(roomId)

      if (game && room.status === 'playing') {
        // 游戏进行中，触发断线判负
        console.log(`玩家 ${user.nickname} (${user.id}) 主动退出游戏，触发判负`)

        // 清除计时器
        if (game.turnTimeout) {
          clearTimeout(game.turnTimeout)
          game.turnTimeout = null
        }

        // 调用断线判负处理
        await handleDisconnectForceEnd(io, roomId, user.id, game)
      } else {
        // 游戏未开始或已结束，正常离开房间
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

          // 通知其他玩家
          io.to(roomId).emit('room:left', { roomId, playerId: user.id })
        }

        await redis.del(`user_room:${user.id}`)
      }

      callback({ success: true })
    } catch (error) {
      console.error('退出游戏失败:', error)
      callback({ error: '退出游戏失败' })
    }
  })

  /**
   * 检查是否有未完成的游戏
   */
  socket.on('game:check-pending', async (data, callback) => {
    try {
      // 检查重连信息
      const reconnectInfo = await redis.getJSON(`reconnect:${user.id}`)
      const roomId = await redis.get(`user_room:${user.id}`)

      if (!roomId && !reconnectInfo) {
        return callback({ hasPendingGame: false })
      }

      const targetRoomId = roomId || reconnectInfo?.roomId
      const room = await redis.getJSON(`room:${targetRoomId}`)

      if (!room || room.status !== 'playing') {
        return callback({ hasPendingGame: false })
      }

      const game = activeGames.get(targetRoomId)
      if (!game) {
        return callback({ hasPendingGame: false })
      }

      // 计算剩余重连时间
      const playerIndex = room.players.findIndex((p) => p.id === user.id)
      let remainingTime = 60

      if (playerIndex !== -1 && room.players[playerIndex].disconnectTime) {
        const elapsed = (Date.now() - room.players[playerIndex].disconnectTime) / 1000
        remainingTime = Math.max(0, 60 - Math.floor(elapsed))
      }

      callback({
        hasPendingGame: true,
        roomId: targetRoomId,
        remainingTime,
      })
    } catch (error) {
      console.error('检查未完成游戏失败:', error)
      callback({ hasPendingGame: false })
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

  // 收集玩家信息用于同步到聊天服务
  const playersForSync = []

  for (const playerResult of result.results) {
    try {
      // 更新金币
      await User.updateCoins(playerResult.playerId, playerResult.coinChange)

      // 更新战绩
      await User.updateStats(playerResult.playerId, playerResult.isWin)

      // 记录游戏记录
      await recordGameResult(roomId, game.gameId, playerResult, result.multiplier)

      // 获取用户完整信息用于同步
      const userInfo = await User.findById(playerResult.playerId)
      if (userInfo && userInfo.chat_user_id) {
        playersForSync.push({
          chatUserId: userInfo.chat_user_id,
          nickname: userInfo.nickname,
          role: playerResult.role,
          isWin: playerResult.isWin,
          coinChange: playerResult.coinChange,
        })
      }
    } catch (error) {
      console.error('更新玩家数据失败:', error)
    }
  }

  // 同步游戏结果到聊天服务（异步，不阻塞主流程）
  syncGameResultToChat(game.gameId, roomId, playersForSync, result.multiplier, game.baseScore)

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
 * 同步游戏结果到聊天服务
 */
async function syncGameResultToChat(gameId, roomId, players, multiplier, baseScore) {
  // 只有当有玩家关联了聊天用户时才同步
  if (players.length === 0) {
    return
  }

  try {
    const chatServiceUrl = config.chatService.url
    const apiKey = config.chatService.apiKey

    await axios.post(
      `${chatServiceUrl}/api/integration/game-result`,
      {
        gameId,
        roomId,
        players,
        multiplier,
        baseScore,
        createdAt: new Date().toISOString(),
      },
      {
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 5000, // 5秒超时
      }
    )

    console.log(`游戏结果已同步到聊天服务: gameId=${gameId}`)
  } catch (error) {
    // 同步失败不影响主流程，只记录日志
    console.error('同步游戏结果到聊天服务失败:', error.message)
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

/**
 * 处理断线判负（60秒超时）
 */
async function handleDisconnectForceEnd(io, roomId, userId, game) {
  console.log(`处理断线判负: 房间=${roomId}, 玩家=${userId}`)

  // 清除计时器
  if (game.turnTimeout) {
    clearTimeout(game.turnTimeout)
    game.turnTimeout = null
  }

  // 找到断线玩家
  const disconnectedPlayer = game.players.find((p) => p.id === userId)
  if (!disconnectedPlayer) {
    console.log('找不到断线玩家')
    return
  }

  // 确定获胜方（断线玩家的对立方获胜）
  let winners = []
  if (disconnectedPlayer.role === 'landlord') {
    // 地主断线，农民获胜
    winners = game.players.filter((p) => p.role === 'farmer')
  } else {
    // 农民断线，需要判断情况
    // 如果另一个农民也在线，则农民方整体判负，地主获胜
    const landlord = game.players.find((p) => p.role === 'landlord')
    winners = landlord ? [landlord] : []
  }

  if (winners.length === 0) {
    console.log('无法确定获胜方')
    return
  }

  // 计算积分变化（断线方输掉全部积分）
  const baseChange = game.baseScore * game.multiplier
  const results = []

  for (const player of game.players) {
    let coinChange = 0
    let isWin = false

    if (disconnectedPlayer.role === 'landlord') {
      // 地主断线，地主输双倍，农民各赢单倍
      if (player.role === 'landlord') {
        coinChange = -baseChange * 2
        isWin = false
      } else {
        coinChange = baseChange
        isWin = true
      }
    } else {
      // 农民断线，地主赢双倍，农民各输单倍
      if (player.role === 'landlord') {
        coinChange = baseChange * 2
        isWin = true
      } else {
        coinChange = -baseChange
        isWin = false
      }
    }

    results.push({
      playerId: player.id,
      role: player.role,
      isWin,
      coinChange,
    })
  }

  // 广播游戏结束（标注为断线判负）
  io.to(roomId).emit('game:ended', {
    winnerId: winners[0].id,
    winnerRole: winners[0].role,
    results,
    multiplier: game.multiplier,
    isSpring: false,
    bombCount: game.bombCount,
    reason: 'disconnect_timeout',
    disconnectedPlayerId: userId,
  })

  // 更新玩家金币和战绩
  const User = require('../models/User')
  const playersForSync = []

  for (const playerResult of results) {
    try {
      // 更新金币
      await User.updateCoins(playerResult.playerId, playerResult.coinChange)

      // 更新战绩
      await User.updateStats(playerResult.playerId, playerResult.isWin)

      // 记录游戏记录
      await recordGameResult(roomId, game.gameId, playerResult, game.multiplier)

      // 获取用户完整信息用于同步
      const userInfo = await User.findById(playerResult.playerId)
      if (userInfo && userInfo.chat_user_id) {
        playersForSync.push({
          chatUserId: userInfo.chat_user_id,
          nickname: userInfo.nickname,
          role: playerResult.role,
          isWin: playerResult.isWin,
          coinChange: playerResult.coinChange,
        })
      }
    } catch (error) {
      console.error('更新玩家数据失败:', error)
    }
  }

  // 同步游戏结果到聊天服务
  syncGameResultToChat(game.gameId, roomId, playersForSync, game.multiplier, game.baseScore)

  // 清理游戏实例
  activeGames.delete(roomId)

  // 清理房间和用户映射
  for (const player of game.players) {
    await redis.del(`user_room:${player.id}`)
    await redis.del(`reconnect:${player.id}`)
  }
  await redis.del(`room:${roomId}`)

  console.log(`断线判负处理完成: 房间=${roomId}`)
}

/**
 * 处理所有玩家断线（立即结束游戏，无需等待超时）
 */
async function handleAllPlayersDisconnected(io, roomId, game) {
  console.log(`所有玩家都已离线，立即结束游戏: 房间=${roomId}`)

  // 清除游戏计时器
  if (game.turnTimeout) {
    clearTimeout(game.turnTimeout)
    game.turnTimeout = null
  }

  // 删除游戏实例
  activeGames.delete(roomId)

  // 清理所有玩家的 Redis 映射和断线超时定时器
  const { cancelDisconnectTimer } = require('./index')
  for (const player of game.players) {
    await redis.del(`user_room:${player.id}`)
    await redis.del(`reconnect:${player.id}`)
    cancelDisconnectTimer(player.id)
  }

  // 删除房间
  await redis.del(`room:${roomId}`)

  console.log(`所有玩家断线，游戏已清理: 房间=${roomId}`)
}

module.exports = handleGameEvents
module.exports.handlePlayerDisconnect = handlePlayerDisconnect
module.exports.handleDisconnectForceEnd = handleDisconnectForceEnd
module.exports.handleAllPlayersDisconnected = handleAllPlayersDisconnected
module.exports.handleGameEnd = handleGameEnd
module.exports.activeGames = activeGames
