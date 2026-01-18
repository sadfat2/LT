/**
 * 完整游戏流程测试
 * 模拟3个玩家进行一局斗地主
 */

const { io } = require('socket.io-client')
const redis = require('redis')

const SERVER_URL = 'http://localhost:4000'
const REDIS_URL = 'redis://localhost:6379'

// 清理 Redis 中的旧房间数据
async function cleanupRedis(userIds) {
  const client = redis.createClient({ url: REDIS_URL })
  await client.connect()

  console.log('清理旧的 Redis 数据...')

  for (const userId of userIds) {
    const key = `user_room:${userId}`
    const roomId = await client.get(key)
    if (roomId) {
      console.log(`  删除 ${key} -> ${roomId}`)
      await client.del(key)
      await client.del(`room:${roomId}`)
    }
  }

  // 清理所有测试房间
  const roomKeys = await client.keys('room:*')
  for (const key of roomKeys) {
    const room = await client.get(key)
    if (room && room.includes('测试房间')) {
      console.log(`  删除房间 ${key}`)
      await client.del(key)
    }
  }

  await client.quit()
  console.log('清理完成\n')
}

async function login(account, password) {
  const res = await fetch(`${SERVER_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account, password })
  })
  const data = await res.json()
  if (data.code !== 200) throw new Error(data.message)
  return data.data
}

function createPlayer(name, token) {
  return new Promise((resolve) => {
    const socket = io(SERVER_URL, { auth: { token } })
    const player = { name, socket, cards: [], seat: -1, ready: false }

    socket.on('connect', () => {
      console.log(`[${name}] Socket 连接成功`)
      resolve(player)
    })

    socket.on('connect_error', (err) => {
      console.error(`[${name}] 连接失败:`, err.message)
    })

    socket.on('room:joined', (data) => {
      console.log(`[${name}] 有玩家加入: ${data.player.nickname}`)
    })

    socket.on('room:ready', (data) => {
      console.log(`[${name}] 玩家准备状态: ${data.playerId} -> ${data.isReady}`)
    })

    socket.on('game:started', (data) => {
      console.log(`[${name}] 游戏开始! 阶段: ${data.gameState.phase}`)
      // 座位已在 game:dealt 中设置，这里不再覆盖
    })

    socket.on('game:dealt', (data) => {
      player.cards = data.cards
      player.seat = data.seat
      console.log(`[${name}] 收到 ${data.cards.length} 张牌, 座位: ${data.seat}`)
    })

    socket.on('game:bid_turn', (data) => {
      console.log(`[${name}] 叫地主回合, 当前座位: ${data.seat}, 我的座位: ${player.seat}`)
    })

    socket.on('game:bid', (data) => {
      console.log(`[${name}] 有人叫分: 座位${data.bidInfo.seat} 叫${data.bidInfo.score}分`)
    })

    socket.on('game:landlord_decided', (data) => {
      console.log(`[${name}] 地主确定! 座位: ${data.seat}, 叫分: ${data.bidScore}`)
      console.log(`[${name}] 底牌:`, data.bottomCards.map(c => `${c.suit}${c.rank}`).join(' '))
    })

    socket.on('game:play_turn', (data) => {
      console.log(`[${name}] 出牌回合, 当前座位: ${data.seat}`)
    })

    socket.on('game:played', (data) => {
      const { playInfo } = data
      if (playInfo.isPass) {
        console.log(`[${name}] 座位${playInfo.seat} 不出`)
      } else {
        console.log(`[${name}] 座位${playInfo.seat} 出牌: ${playInfo.pattern.type}`)
      }
    })

    socket.on('game:ended', (data) => {
      console.log(`[${name}] 游戏结束! 赢家ID: ${data.winnerId}`)
      console.log(`[${name}] 结果:`, JSON.stringify(data.results))
    })
  })
}

async function main() {
  console.log('=== 斗地主游戏流程测试 ===\n')

  // 登录3个玩家
  console.log('1. 登录玩家...')
  const [user1, user2, user3] = await Promise.all([
    login('player1', '123456'),
    login('testuser2', '123456'),
    login('testuser3', '123456')
  ])
  console.log('登录成功: player1, testuser2, testuser3')
  console.log(`   用户ID: ${user1.user.id}, ${user2.user.id}, ${user3.user.id}\n`)

  // 清理旧的 Redis 数据
  await cleanupRedis([user1.user.id, user2.user.id, user3.user.id])

  // 创建 Socket 连接
  console.log('2. 创建 Socket 连接...')
  const [p1, p2, p3] = await Promise.all([
    createPlayer('玩家1', user1.token),
    createPlayer('玩家2', user2.token),
    createPlayer('玩家3', user3.token)
  ])
  console.log('')

  // 玩家1创建房间
  console.log('3. 玩家1创建房间...')
  const roomResult = await new Promise(resolve => {
    p1.socket.emit('room:create', { name: '测试房间', baseScore: 100 }, resolve)
  })
  if (roomResult.error) {
    console.error('创建房间失败:', roomResult.error)
    process.exit(1)
  }
  const roomId = roomResult.room.id
  console.log('房间创建成功:', roomId, '\n')

  // 玩家2、3依次加入房间（避免并发竞态）
  console.log('4. 玩家2、3加入房间...')

  const joinResult2 = await new Promise(resolve => p2.socket.emit('room:join', { roomId }, resolve))
  if (joinResult2.error) {
    console.error('玩家2加入失败:', joinResult2.error)
    process.exit(1)
  }
  console.log(`   玩家2加入成功, 房间人数: ${joinResult2.room.players.length}`)

  const joinResult3 = await new Promise(resolve => p3.socket.emit('room:join', { roomId }, resolve))
  if (joinResult3.error) {
    console.error('玩家3加入失败:', joinResult3.error)
    process.exit(1)
  }
  console.log(`   玩家3加入成功, 房间人数: ${joinResult3.room.players.length}\n`)

  // 所有人依次准备（避免并发竞态）
  console.log('5. 所有玩家准备...')
  const ready1 = await new Promise(resolve => p1.socket.emit('room:ready', {}, resolve))
  console.log(`   玩家1准备: ${ready1.isReady}`)
  const ready2 = await new Promise(resolve => p2.socket.emit('room:ready', {}, resolve))
  console.log(`   玩家2准备: ${ready2.isReady}`)
  const ready3 = await new Promise(resolve => p3.socket.emit('room:ready', {}, resolve))
  console.log(`   玩家3准备: ${ready3.isReady}\n`)

  // 等待 game:starting 事件
  await new Promise(resolve => setTimeout(resolve, 500))

  // 房主开始游戏
  console.log('6. 开始游戏...')
  const startResult = await new Promise(resolve => {
    p1.socket.emit('game:start', {}, resolve)
  })
  if (startResult.error) {
    console.error('开始游戏失败:', startResult.error)
    process.exit(1)
  }
  console.log('游戏已开始!\n')

  // 等待发牌
  await new Promise(resolve => setTimeout(resolve, 1000))

  // 显示每个玩家的手牌数量
  console.log('7. 手牌情况:')
  console.log(`   玩家1: ${p1.cards.length} 张, 座位: ${p1.seat}`)
  console.log(`   玩家2: ${p2.cards.length} 张, 座位: ${p2.seat}`)
  console.log(`   玩家3: ${p3.cards.length} 张, 座位: ${p3.seat}`)
  console.log('')

  // 自动叫地主测试
  console.log('8. 叫地主阶段 (自动)...')
  const players = [p1, p2, p3]

  // 设置叫地主自动响应
  players.forEach((p, idx) => {
    p.socket.on('game:bid_turn', (data) => {
      if (data.seat === p.seat) {
        const score = idx === 0 ? 3 : 0 // 玩家1叫3分，其他人不叫
        setTimeout(() => {
          p.socket.emit('game:bid', { score }, (res) => {
            console.log(`   ${p.name} 叫分: ${score}, 结果:`, res.success ? '成功' : res.error)
          })
        }, 300)
      }
    })
  })

  // 设置出牌自动响应
  players.forEach((p) => {
    p.socket.on('game:play_turn', (data) => {
      if (data.seat === p.seat && p.cards.length > 0) {
        // 自动出最小的一张牌
        const card = p.cards[p.cards.length - 1]
        setTimeout(() => {
          p.socket.emit('game:play', { cards: [card] }, (res) => {
            if (res.success) {
              p.cards = p.cards.filter(c => c.id !== card.id)
              console.log(`   ${p.name} 出牌成功, 剩余 ${p.cards.length} 张`)
            } else {
              // 出牌失败，尝试不出
              p.socket.emit('game:pass', {}, (passRes) => {
                console.log(`   ${p.name} 不出, 结果:`, passRes.success ? '成功' : passRes.error)
              })
            }
          })
        }, 300)
      }
    })
  })

  // 等待游戏结束
  console.log('9. 等待游戏进行... (最长60秒)\n')

  let gameEnded = false
  players.forEach(p => {
    p.socket.on('game:ended', () => {
      gameEnded = true
    })
  })

  // 等待最多60秒
  for (let i = 0; i < 60 && !gameEnded; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000))
    if (i > 0 && i % 10 === 0) {
      console.log(`   已等待 ${i} 秒...`)
    }
  }

  console.log('\n=== 测试完成 ===')

  // 断开连接
  players.forEach(p => p.socket.disconnect())
  process.exit(0)
}

main().catch(err => {
  console.error('测试失败:', err)
  process.exit(1)
})
