/**
 * K6 性能测试 - 综合测试入口
 *
 * 按顺序执行所有测试场景：
 * 1. 登录 API 压测
 * 2. Socket.io 连接压测
 * 3. 消息发送压测
 * 4. 群聊广播压测
 *
 * 执行: k6 run run-all.js
 */

import http from 'k6/http'
import { WebSocket } from 'k6/experimental/websockets'
import { check, sleep, group } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js'
import { BASE_URL, WS_URL, USERS, TEST_CONFIG } from './config.js'
import { login, getFriends, getGroups } from './utils/socketio.js'

// 自定义指标 - 登录
const loginSuccess = new Rate('login_success')
const loginDuration = new Trend('login_duration', true)

// 自定义指标 - 连接
const connectionSuccess = new Rate('connection_success')
const handshakeDuration = new Trend('handshake_duration', true)

// 自定义指标 - 消息
const messageSent = new Rate('message_sent')
const messageLatency = new Trend('message_latency', true)
const messageCount = new Counter('message_count')

// 自定义指标 - 广播
const broadcastSuccess = new Rate('broadcast_success')
const broadcastLatency = new Trend('broadcast_latency', true)

// 测试配置 - 分阶段执行
export const options = {
  scenarios: {
    // 阶段1: 登录压测 (0-60s)
    login_test: {
      executor: 'constant-vus',
      vus: 50,
      duration: '30s',
      startTime: '0s',
      tags: { scenario: 'login' }
    },
    // 阶段2: 连接压测 (30-90s)
    connection_test: {
      executor: 'constant-vus',
      vus: 50,
      duration: '30s',
      startTime: '30s',
      tags: { scenario: 'connection' }
    },
    // 阶段3: 消息发送压测 (60-120s)
    messaging_test: {
      executor: 'constant-vus',
      vus: 50,
      duration: '30s',
      startTime: '60s',
      tags: { scenario: 'messaging' }
    },
    // 阶段4: 群聊广播压测 (90-150s)
    broadcast_test: {
      executor: 'constant-vus',
      vus: 50,
      duration: '30s',
      startTime: '90s',
      tags: { scenario: 'broadcast' }
    }
  },
  thresholds: {
    // 登录指标
    'login_success': ['rate>0.95'],
    'login_duration{scenario:login}': ['p(95)<500'],

    // 连接指标
    'connection_success': ['rate>0.95'],
    'handshake_duration': ['p(95)<300'],

    // 消息指标
    'message_sent': ['rate>0.95'],
    'message_latency': ['p(95)<500'],

    // 广播指标
    'broadcast_success': ['rate>0.95'],
    'broadcast_latency': ['p(95)<1000']
  }
}

// 全局设置
export function setup() {
  console.log('========================================')
  console.log('K6 聊天系统综合性能测试')
  console.log('========================================')
  console.log(`目标服务器: ${BASE_URL}`)
  console.log(`WebSocket: ${WS_URL}`)
  console.log('----------------------------------------')
  console.log('测试阶段:')
  console.log('  1. 登录压测 (0-30s)')
  console.log('  2. 连接压测 (30-60s)')
  console.log('  3. 消息压测 (60-90s)')
  console.log('  4. 广播压测 (90-120s)')
  console.log('----------------------------------------')

  // 预热：验证服务器可用
  const healthCheck = http.get(`${BASE_URL}/api/auth/login`, { timeout: '5s' })
  if (healthCheck.status === 0) {
    console.error('错误: 无法连接到服务器')
    return { serverAvailable: false }
  }

  // 预先获取用户上下文
  const userContexts = []
  for (let i = 0; i < Math.min(USERS.length, 100); i++) {
    const result = login(BASE_URL, USERS[i].account, USERS[i].password)
    if (result.success) {
      const friendsResult = getFriends(BASE_URL, result.token)
      const groupsResult = getGroups(BASE_URL, result.token)

      userContexts.push({
        account: USERS[i].account,
        token: result.token,
        userId: result.user.id,
        friends: friendsResult.success ? friendsResult.friends : [],
        groups: (groupsResult.success ? groupsResult.groups : []).filter(g => g.name.startsWith('K6测试群'))
      })
    }
  }

  console.log(`预登录完成: ${userContexts.length} 用户`)
  return { serverAvailable: true, userContexts }
}

// 主测试函数
export default function (data) {
  if (!data.serverAvailable) {
    console.error('服务器不可用')
    return
  }

  const scenario = __ENV.scenario || exec.scenario.name

  // 根据场景执行不同测试
  if (scenario === 'login_test') {
    runLoginTest(data)
  } else if (scenario === 'connection_test') {
    runConnectionTest(data)
  } else if (scenario === 'messaging_test') {
    runMessagingTest(data)
  } else if (scenario === 'broadcast_test') {
    runBroadcastTest(data)
  } else {
    // 默认执行所有测试
    runLoginTest(data)
  }
}

// 登录测试
function runLoginTest(data) {
  const userIndex = (__VU - 1) % USERS.length
  const user = USERS[userIndex]

  const startTime = Date.now()
  const response = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ account: user.account, password: user.password }),
    { headers: { 'Content-Type': 'application/json' }, timeout: '10s' }
  )
  const duration = Date.now() - startTime

  loginDuration.add(duration)

  const success = check(response, {
    'login status 200': (r) => r.status === 200,
    'login has token': (r) => {
      try {
        const body = JSON.parse(r.body)
        return body.code === 200 && body.data?.token
      } catch { return false }
    }
  })

  loginSuccess.add(success)
  sleep(0.5 + Math.random() * 0.5)
}

// 连接测试
function runConnectionTest(data) {
  if (data.userContexts.length === 0) return

  const userIndex = (__VU - 1) % data.userContexts.length
  const { token, account } = data.userContexts[userIndex]

  const handshakeStart = Date.now()
  const handshakeUrl = `${BASE_URL}/socket.io/?EIO=4&transport=polling&token=${token}`
  const response = http.get(handshakeUrl, { timeout: '5s' })

  if (response.status !== 200) {
    connectionSuccess.add(false)
    return
  }

  handshakeDuration.add(Date.now() - handshakeStart)

  let sid
  try {
    const openData = JSON.parse(response.body.substring(1))
    sid = openData.sid
  } catch {
    connectionSuccess.add(false)
    return
  }

  const wsUrl = `${WS_URL}/socket.io/?EIO=4&transport=websocket&sid=${sid}&token=${token}`
  const ws = new WebSocket(wsUrl)

  let connected = false

  ws.onopen = () => ws.send('2probe')
  ws.onmessage = (e) => {
    if (e.data === '3probe') {
      ws.send('5')
      ws.send('40')
    } else if (e.data.startsWith('40')) {
      connected = true
      connectionSuccess.add(true)
    } else if (e.data === '2') {
      ws.send('3')
    }
  }
  ws.onerror = () => connectionSuccess.add(false)

  let waitTime = 0
  while (!connected && waitTime < 5000) {
    sleep(0.1)
    waitTime += 100
  }

  if (!connected) connectionSuccess.add(false)

  sleep(5)
  try { ws.close() } catch {}
}

// 消息测试
function runMessagingTest(data) {
  if (data.userContexts.length === 0) return

  const userIndex = (__VU - 1) % data.userContexts.length
  const { token, account, friends } = data.userContexts[userIndex]

  if (friends.length === 0) {
    sleep(1)
    return
  }

  // 建立连接
  const handshakeUrl = `${BASE_URL}/socket.io/?EIO=4&transport=polling&token=${token}`
  const response = http.get(handshakeUrl, { timeout: '5s' })
  if (response.status !== 200) return

  let sid
  try {
    sid = JSON.parse(response.body.substring(1)).sid
  } catch { return }

  const wsUrl = `${WS_URL}/socket.io/?EIO=4&transport=websocket&sid=${sid}&token=${token}`
  const ws = new WebSocket(wsUrl)

  let connected = false
  let ackId = 0
  const pendingAcks = new Map()

  ws.onopen = () => ws.send('2probe')
  ws.onmessage = (e) => {
    const msg = e.data
    if (msg === '3probe') { ws.send('5'); ws.send('40') }
    else if (msg.startsWith('40')) connected = true
    else if (msg === '2') ws.send('3')
    else if (msg.startsWith('43')) {
      const match = msg.match(/^43(\d+)(.*)/)
      if (match) {
        const respAckId = parseInt(match[1])
        const pending = pendingAcks.get(respAckId)
        if (pending) {
          messageLatency.add(Date.now() - pending.startTime)
          const respData = match[2] ? JSON.parse(match[2]) : null
          messageSent.add(respData?.[0]?.success || false)
          if (respData?.[0]?.success) messageCount.add(1)
          pendingAcks.delete(respAckId)
        }
      }
    }
  }

  let waitTime = 0
  while (!connected && waitTime < 5000) { sleep(0.1); waitTime += 100 }
  if (!connected) { ws.close(); return }

  // 发送消息
  for (let i = 0; i < 5; i++) {
    const friend = friends[Math.floor(Math.random() * friends.length)]
    const currentAckId = ackId++
    pendingAcks.set(currentAckId, { startTime: Date.now() })

    const packet = `42${currentAckId}${JSON.stringify(['send_message', {
      receiverId: friend.id,
      type: 'text',
      content: `K6测试 [${account}] #${i + 1}`
    }])}`

    try { ws.send(packet) } catch { pendingAcks.delete(currentAckId) }
    sleep(0.5)
  }

  // 等待 ACK
  let ackWait = 0
  while (pendingAcks.size > 0 && ackWait < 3000) { sleep(0.1); ackWait += 100 }

  try { ws.close() } catch {}
}

// 广播测试
function runBroadcastTest(data) {
  if (data.userContexts.length === 0) return

  const userIndex = (__VU - 1) % data.userContexts.length
  const { token, account, groups } = data.userContexts[userIndex]

  if (groups.length === 0) {
    sleep(1)
    return
  }

  // 建立连接
  const handshakeUrl = `${BASE_URL}/socket.io/?EIO=4&transport=polling&token=${token}`
  const response = http.get(handshakeUrl, { timeout: '5s' })
  if (response.status !== 200) return

  let sid
  try {
    sid = JSON.parse(response.body.substring(1)).sid
  } catch { return }

  const wsUrl = `${WS_URL}/socket.io/?EIO=4&transport=websocket&sid=${sid}&token=${token}`
  const ws = new WebSocket(wsUrl)

  let connected = false
  let ackId = 0

  ws.onopen = () => ws.send('2probe')
  ws.onmessage = (e) => {
    const msg = e.data
    if (msg === '3probe') { ws.send('5'); ws.send('40') }
    else if (msg.startsWith('40')) connected = true
    else if (msg === '2') ws.send('3')
    else if (msg.startsWith('42')) {
      // 收到群消息
      try {
        const eventData = JSON.parse(msg.substring(2))
        if (eventData[0] === 'new_message' && eventData[1]?.message?.content) {
          const match = eventData[1].message.content.match(/@(\d+)$/)
          if (match) {
            broadcastLatency.add(Date.now() - parseInt(match[1]))
          }
        }
      } catch {}
    }
    else if (msg.startsWith('43')) {
      const match = msg.match(/^43(\d+)(.*)/)
      if (match) {
        const respData = match[2] ? JSON.parse(match[2]) : null
        broadcastSuccess.add(respData?.[0]?.success || false)
      }
    }
  }

  let waitTime = 0
  while (!connected && waitTime < 5000) { sleep(0.1); waitTime += 100 }
  if (!connected) { ws.close(); return }

  // 发送群消息（部分用户）
  if (__VU % 5 === 0) {
    const group = groups[0]
    const packet = `42${ackId}${JSON.stringify(['send_message', {
      conversationId: group.conversation_id,
      type: 'text',
      content: `K6群消息 [${account}] @${Date.now()}`
    }])}`
    try { ws.send(packet) } catch {}
  }

  sleep(10)
  try { ws.close() } catch {}
}

// 清理
export function teardown(data) {
  console.log('----------------------------------------')
  console.log('综合性能测试完成')
  console.log('========================================')
}

// 生成报告
export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return {
    [`reports/all-${timestamp}.html`]: htmlReport(data, { title: 'K6 聊天系统综合性能测试报告' }),
    [`reports/all-${timestamp}.json`]: JSON.stringify(data, null, 2),
    stdout: generateSummary(data)
  }
}

function generateSummary(data) {
  const { metrics } = data

  let summary = `
========================================
K6 聊天系统综合性能测试报告
========================================

【登录测试】
`
  if (metrics.login_success) {
    summary += `  成功率: ${(metrics.login_success.values.rate * 100).toFixed(2)}%\n`
  }
  if (metrics.login_duration) {
    summary += `  响应时间 p95: ${metrics.login_duration.values['p(95)'].toFixed(2)}ms\n`
  }

  summary += `
【连接测试】
`
  if (metrics.connection_success) {
    summary += `  成功率: ${(metrics.connection_success.values.rate * 100).toFixed(2)}%\n`
  }
  if (metrics.handshake_duration) {
    summary += `  握手延迟 p95: ${metrics.handshake_duration.values['p(95)'].toFixed(2)}ms\n`
  }

  summary += `
【消息测试】
`
  if (metrics.message_sent) {
    summary += `  成功率: ${(metrics.message_sent.values.rate * 100).toFixed(2)}%\n`
  }
  if (metrics.message_latency) {
    summary += `  消息延迟 p95: ${metrics.message_latency.values['p(95)'].toFixed(2)}ms\n`
  }
  if (metrics.message_count) {
    summary += `  发送总数: ${metrics.message_count.values.count}\n`
  }

  summary += `
【广播测试】
`
  if (metrics.broadcast_success) {
    summary += `  成功率: ${(metrics.broadcast_success.values.rate * 100).toFixed(2)}%\n`
  }
  if (metrics.broadcast_latency) {
    summary += `  广播延迟 p95: ${metrics.broadcast_latency.values['p(95)'].toFixed(2)}ms\n`
  }

  summary += `
========================================
`

  return summary
}

// 需要引入 exec 模块
import exec from 'k6/execution'
