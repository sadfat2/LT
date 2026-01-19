/**
 * 聊天功能测试脚本
 * 测试表情和快捷消息的发送/接收
 */

const io = require('socket.io-client')
const axios = require('axios')

const API_URL = 'http://localhost:4000/api'
const SOCKET_URL = 'http://localhost:4000'

// 测试用户
const users = [
  { account: 'chattest1', password: 'test123456' },
  { account: 'chattest2', password: 'test123456' },
  { account: 'chattest3', password: 'test123456' },
]

// 存储登录信息
const loggedInUsers = []
const sockets = []

// 注册用户
async function register(user) {
  try {
    const response = await axios.post(`${API_URL}/auth/register`, {
      ...user,
      nickname: `聊天测试${user.account.slice(-1)}`,
    })
    return response.data.data
  } catch (error) {
    // 如果用户已存在，忽略错误
    if (error.response?.data?.message?.includes('已存在')) {
      return null
    }
    throw error
  }
}

// 登录用户
async function login(user) {
  try {
    // 先尝试注册
    await register(user)
  } catch (e) {
    // 忽略注册错误
  }

  try {
    const response = await axios.post(`${API_URL}/auth/login`, user)
    return response.data.data
  } catch (error) {
    console.error(`登录失败 (${user.account}):`, error.response?.data || error.message)
    throw error
  }
}

// 连接 Socket
function connectSocket(token, nickname) {
  return new Promise((resolve, reject) => {
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    })

    socket.on('connect', () => {
      console.log(`✅ ${nickname} Socket 连接成功`)
      resolve(socket)
    })

    socket.on('connect_error', (error) => {
      console.error(`❌ ${nickname} Socket 连接失败:`, error.message)
      reject(error)
    })

    // 监听聊天事件
    socket.on('chat:emoji', (data) => {
      console.log(`📨 ${nickname} 收到表情:`, data.emoji.name, `来自玩家 ${data.playerId}`)
    })

    socket.on('chat:quick', (data) => {
      console.log(`📨 ${nickname} 收到消息:`, data.message.text, `来自玩家 ${data.playerId}`)
    })
  })
}

// 创建房间
function createRoom(socket) {
  return new Promise((resolve, reject) => {
    socket.emit('room:create', { name: '聊天测试房间', baseScore: 100 }, (response) => {
      if (response.error) {
        reject(new Error(response.error))
      } else {
        resolve(response.room)
      }
    })
  })
}

// 加入房间
function joinRoom(socket, roomId) {
  return new Promise((resolve, reject) => {
    socket.emit('room:join', { roomId }, (response) => {
      if (response.error) {
        reject(new Error(response.error))
      } else {
        resolve(response.room)
      }
    })
  })
}

// 发送表情
function sendEmoji(socket, emojiId) {
  return new Promise((resolve, reject) => {
    socket.emit('chat:emoji', { emojiId }, (response) => {
      if (response.error) {
        reject(new Error(response.error))
      } else {
        resolve(response)
      }
    })
  })
}

// 发送快捷消息
function sendQuickMessage(socket, messageId) {
  return new Promise((resolve, reject) => {
    socket.emit('chat:quick', { messageId }, (response) => {
      if (response.error) {
        reject(new Error(response.error))
      } else {
        resolve(response)
      }
    })
  })
}

// 获取表情列表
function getEmojis(socket) {
  return new Promise((resolve) => {
    socket.emit('chat:emojis', {}, (response) => {
      resolve(response.emojis)
    })
  })
}

// 获取快捷消息列表
function getQuickMessages(socket) {
  return new Promise((resolve) => {
    socket.emit('chat:quickMessages', {}, (response) => {
      resolve(response.messages)
    })
  })
}

// 延迟函数
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// 主测试流程
async function runTest() {
  console.log('🎮 开始聊天功能测试\n')

  try {
    // 1. 登录所有用户
    console.log('📝 步骤1: 登录用户')
    for (const user of users) {
      const data = await login(user)
      loggedInUsers.push(data)
      console.log(`  ✅ ${data.user.nickname} 登录成功`)
    }
    console.log('')

    // 2. 连接 Socket
    console.log('🔌 步骤2: 连接 Socket')
    for (const userData of loggedInUsers) {
      const socket = await connectSocket(userData.token, userData.user.nickname)
      sockets.push({ socket, user: userData.user })
    }
    console.log('')

    // 3. 获取表情和消息列表
    console.log('📋 步骤3: 获取表情和消息列表')
    const emojis = await getEmojis(sockets[0].socket)
    const messages = await getQuickMessages(sockets[0].socket)
    console.log(`  表情列表: ${emojis.map((e) => e.name).join(', ')}`)
    console.log(`  消息列表: ${messages.map((m) => m.text.substring(0, 10) + '...').join(', ')}`)
    console.log('')

    // 4. 创建房间并加入
    console.log('🏠 步骤4: 创建房间')
    const room = await createRoom(sockets[0].socket)
    console.log(`  ✅ 房间创建成功: ${room.name} (${room.id.substring(0, 8)}...)`)

    // 其他玩家加入
    for (let i = 1; i < sockets.length; i++) {
      await joinRoom(sockets[i].socket, room.id)
      console.log(`  ✅ ${sockets[i].user.nickname} 加入房间`)
    }
    console.log('')

    // 5. 测试发送表情
    console.log('😄 步骤5: 测试发送表情')
    await delay(500)

    await sendEmoji(sockets[0].socket, 'laugh')
    console.log(`  ✅ ${sockets[0].user.nickname} 发送表情: 哈哈`)
    await delay(500)

    await sendEmoji(sockets[1].socket, 'angry')
    console.log(`  ✅ ${sockets[1].user.nickname} 发送表情: 生气`)
    await delay(500)

    await sendEmoji(sockets[2].socket, 'cool')
    console.log(`  ✅ ${sockets[2].user.nickname} 发送表情: 酷`)
    console.log('')

    // 6. 测试发送快捷消息
    console.log('💬 步骤6: 测试发送快捷消息')
    await delay(500)

    await sendQuickMessage(sockets[0].socket, 'hurry')
    console.log(`  ✅ ${sockets[0].user.nickname} 发送消息: 快点啊...`)
    await delay(500)

    await sendQuickMessage(sockets[1].socket, 'nice')
    console.log(`  ✅ ${sockets[1].user.nickname} 发送消息: 打得真好...`)
    console.log('')

    // 7. 测试频率限制
    console.log('⏱️ 步骤7: 测试频率限制')
    let rateLimitHit = false
    for (let i = 0; i < 6; i++) {
      try {
        await sendEmoji(sockets[0].socket, 'laugh')
        console.log(`  发送第 ${i + 1} 条: 成功`)
      } catch (error) {
        console.log(`  发送第 ${i + 1} 条: ❌ ${error.message}`)
        rateLimitHit = true
        break
      }
      await delay(100)
    }
    if (rateLimitHit) {
      console.log('  ✅ 频率限制生效！')
    } else {
      console.log('  ⚠️ 频率限制可能未生效')
    }
    console.log('')

    // 8. 测试无效表情/消息
    console.log('❌ 步骤8: 测试无效输入')
    try {
      await sendEmoji(sockets[0].socket, 'invalid_emoji')
      console.log('  ⚠️ 无效表情应该被拒绝')
    } catch (error) {
      console.log(`  ✅ 无效表情被拒绝: ${error.message}`)
    }

    try {
      await sendQuickMessage(sockets[0].socket, 'invalid_message')
      console.log('  ⚠️ 无效消息应该被拒绝')
    } catch (error) {
      console.log(`  ✅ 无效消息被拒绝: ${error.message}`)
    }
    console.log('')

    console.log('✅ 聊天功能测试完成！')
  } catch (error) {
    console.error('❌ 测试失败:', error.message)
  } finally {
    // 清理：断开所有连接
    console.log('\n🧹 清理连接...')
    for (const { socket, user } of sockets) {
      socket.disconnect()
      console.log(`  ${user.nickname} 断开连接`)
    }
    process.exit(0)
  }
}

// 运行测试
runTest()
