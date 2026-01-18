/**
 * 模拟第三个玩家加入房间并准备
 */

const { io } = require('socket.io-client')

const SERVER_URL = 'http://localhost:4000'
const ROOM_ID = process.argv[2] || '2efe86a9-4f8f-48d8-b571-0749a782f01a'

async function login(account, password) {
  const res = await fetch(`${SERVER_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account, password })
  })
  const data = await res.json()
  if (data.code !== 200) {
    throw new Error(data.message)
  }
  return data.data.token
}

async function main() {
  console.log('登录 testuser2...')
  const token = await login('testuser2', '123456')
  console.log('登录成功')

  console.log('连接 Socket.io...')
  const socket = io(SERVER_URL, {
    auth: { token }
  })

  socket.on('connect', () => {
    console.log('Socket 连接成功')

    // 加入房间
    console.log(`加入房间 ${ROOM_ID}...`)
    socket.emit('room:join', { roomId: ROOM_ID }, (res) => {
      if (res.error) {
        console.error('加入房间失败:', res.error)
        return
      }
      console.log('加入房间成功，当前玩家:', res.room.players.length)

      // 准备
      setTimeout(() => {
        console.log('点击准备...')
        socket.emit('room:ready', {}, (readyRes) => {
          if (readyRes.error) {
            console.error('准备失败:', readyRes.error)
          } else {
            console.log('准备成功，isReady:', readyRes.isReady)
          }
        })
      }, 1000)
    })
  })

  socket.on('room:joined', (data) => {
    console.log('有玩家加入:', data.player.nickname)
  })

  socket.on('room:ready', (data) => {
    console.log('玩家准备状态变化:', data)
  })

  socket.on('game:starting', (data) => {
    console.log('游戏即将开始!')
  })

  socket.on('game:started', (data) => {
    console.log('游戏已开始!', data.gameState?.phase)
  })

  socket.on('game:dealt', (data) => {
    console.log('收到手牌:', data.cards?.length, '张')
  })

  socket.on('game:bid_turn', (data) => {
    console.log('叫地主回合，座位:', data.seat)
    // 自动叫1分
    if (data.seat === 1) { // testuser2 的座位
      setTimeout(() => {
        socket.emit('game:bid', { score: 1 }, (res) => {
          console.log('叫分结果:', res)
        })
      }, 500)
    }
  })

  socket.on('connect_error', (err) => {
    console.error('连接失败:', err.message)
  })

  // 保持运行
  process.on('SIGINT', () => {
    console.log('退出')
    socket.disconnect()
    process.exit(0)
  })
}

main().catch(console.error)
