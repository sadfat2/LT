/**
 * K6 性能测试 - 场景3: 消息发送压测
 *
 * 测试目标：
 * - 100 用户并发发送消息
 * - 每用户 1 条/秒
 * - 持续 2 分钟
 * - 消息延迟 p95 < 500ms
 * - 成功率 > 99%
 *
 * 执行: k6 run scenarios/messaging.js
 */

import http from 'k6/http'
import { WebSocket } from 'k6/experimental/websockets'
import { check, sleep } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js'
import { BASE_URL, WS_URL, USERS, TEST_CONFIG } from '../config.js'
import { login, getFriends } from '../utils/socketio.js'

// 自定义指标
const messageSent = new Rate('message_sent')
const messageLatency = new Trend('message_latency', true)
const messageCount = new Counter('message_count')
const messageErrors = new Counter('message_errors')

// 测试配置
export const options = {
  scenarios: {
    messaging_load_test: {
      executor: 'constant-vus',
      vus: TEST_CONFIG.messaging.vus,
      duration: TEST_CONFIG.messaging.duration
    }
  },
  thresholds: {
    message_sent: ['rate>0.99'],         // 发送成功率大于 99%
    message_latency: ['p(95)<500'],      // 消息延迟 p95 小于 500ms
    message_errors: ['count<100']        // 错误数小于 100
  }
}

// 设置阶段
export function setup() {
  console.log('========================================')
  console.log('场景3: 消息发送压测')
  console.log('========================================')
  console.log(`目标服务器: ${BASE_URL}`)
  console.log(`并发用户数: ${TEST_CONFIG.messaging.vus}`)
  console.log(`消息速率: ${TEST_CONFIG.messaging.messageRate} 条/秒/用户`)
  console.log(`持续时间: ${TEST_CONFIG.messaging.duration}`)
  console.log('----------------------------------------')

  // 预先获取所有用户的 token 和好友列表
  const userContexts = []

  for (let i = 0; i < Math.min(USERS.length, TEST_CONFIG.messaging.vus); i++) {
    const result = login(BASE_URL, USERS[i].account, USERS[i].password)
    if (result.success) {
      // 获取好友列表
      const friendsResult = getFriends(BASE_URL, result.token)
      const friends = friendsResult.success ? friendsResult.friends : []

      userContexts.push({
        account: USERS[i].account,
        token: result.token,
        userId: result.user.id,
        friends: friends
      })
    } else {
      console.warn(`预登录失败: ${USERS[i].account}`)
    }
  }

  console.log(`预登录完成: ${userContexts.length}/${USERS.length} 用户`)

  // 统计好友数据
  const totalFriends = userContexts.reduce((sum, u) => sum + u.friends.length, 0)
  console.log(`总好友数: ${totalFriends}`)

  if (userContexts.length === 0) {
    console.error('错误: 无可用的用户凭证')
    return { userContexts: [], serverAvailable: false }
  }

  return { userContexts, serverAvailable: true }
}

// 主测试函数
export default function (data) {
  if (!data.serverAvailable || data.userContexts.length === 0) {
    console.error('无可用凭证，跳过测试')
    return
  }

  // 根据 VU ID 选择用户
  const userIndex = (__VU - 1) % data.userContexts.length
  const userCtx = data.userContexts[userIndex]
  const { token, account, userId, friends } = userCtx

  if (friends.length === 0) {
    console.warn(`用户 ${account} 没有好友，跳过`)
    sleep(1)
    return
  }

  // Step 1: HTTP 轮询握手
  const handshakeUrl = `${BASE_URL}/socket.io/?EIO=4&transport=polling&token=${token}`
  const handshakeResponse = http.get(handshakeUrl, { timeout: '5s' })

  if (handshakeResponse.status !== 200) {
    messageErrors.add(1)
    messageSent.add(false)
    return
  }

  let openData
  try {
    openData = JSON.parse(handshakeResponse.body.substring(1))
  } catch (e) {
    messageErrors.add(1)
    messageSent.add(false)
    return
  }

  const sid = openData.sid

  // Step 2: WebSocket 连接
  const wsUrl = `${WS_URL}/socket.io/?EIO=4&transport=websocket&sid=${sid}&token=${token}`
  const ws = new WebSocket(wsUrl)

  let connected = false
  let ackId = 0
  const pendingAcks = new Map()

  ws.onopen = () => {
    ws.send('2probe')
  }

  ws.onmessage = (e) => {
    const msg = e.data

    if (msg === '3probe') {
      ws.send('5')
      ws.send('40')
    } else if (msg.startsWith('40')) {
      connected = true
    } else if (msg === '2') {
      ws.send('3')
    } else if (msg.startsWith('43')) {
      // Socket.io ACK 响应
      // 格式: 43<ackId>[{"success":true,...}]
      const match = msg.match(/^43(\d+)(.*)/)
      if (match) {
        const respAckId = parseInt(match[1])
        const respData = match[2] ? JSON.parse(match[2]) : null

        const pending = pendingAcks.get(respAckId)
        if (pending) {
          const latency = Date.now() - pending.startTime
          messageLatency.add(latency)

          if (respData && respData[0] && respData[0].success) {
            messageSent.add(true)
            messageCount.add(1)
          } else {
            messageSent.add(false)
            messageErrors.add(1)
          }

          pendingAcks.delete(respAckId)
        }
      }
    }
  }

  ws.onerror = (e) => {
    messageErrors.add(1)
    console.error(`WebSocket 错误 [${account}]: ${e.message || e}`)
  }

  // 等待连接
  let waitTime = 0
  while (!connected && waitTime < 10000) {
    sleep(0.1)
    waitTime += 100
  }

  if (!connected) {
    messageErrors.add(1)
    messageSent.add(false)
    ws.close()
    return
  }

  // Step 3: 发送消息
  const messagesToSend = 10  // 每个 VU 发送的消息数
  const messageInterval = 1000 / TEST_CONFIG.messaging.messageRate  // ms

  for (let i = 0; i < messagesToSend; i++) {
    if (!connected) break

    // 随机选择一个好友
    const friend = friends[Math.floor(Math.random() * friends.length)]
    const currentAckId = ackId++

    // 构造消息
    const messageContent = `K6测试消息 [${account}] #${i + 1} @${Date.now()}`
    const messageData = {
      receiverId: friend.id,
      type: 'text',
      content: messageContent
    }

    // 记录发送时间
    pendingAcks.set(currentAckId, {
      startTime: Date.now(),
      receiverId: friend.id
    })

    // 发送 Socket.io 事件（带 ACK）
    // 格式: 42<ackId>["send_message",{...}]
    const packet = `42${currentAckId}${JSON.stringify(['send_message', messageData])}`

    try {
      ws.send(packet)
    } catch (e) {
      messageErrors.add(1)
      messageSent.add(false)
      pendingAcks.delete(currentAckId)
    }

    // 等待下一条消息
    sleep(messageInterval / 1000)
  }

  // 等待所有 ACK 响应
  let ackWaitTime = 0
  while (pendingAcks.size > 0 && ackWaitTime < 5000) {
    sleep(0.1)
    ackWaitTime += 100
  }

  // 处理超时的消息
  for (const [aid, pending] of pendingAcks) {
    messageErrors.add(1)
    messageSent.add(false)
    console.warn(`消息 ACK 超时 [${account}] ackId=${aid}`)
  }

  // 关闭连接
  try {
    ws.send('41')
    ws.close()
  } catch (e) {
    // 忽略
  }
}

// 清理阶段
export function teardown(data) {
  console.log('----------------------------------------')
  console.log('消息发送压测完成')
}

// 生成 HTML 报告
export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return {
    [`reports/messaging-${timestamp}.html`]: htmlReport(data, { title: '消息发送压测报告' }),
    [`reports/messaging-${timestamp}.json`]: JSON.stringify(data, null, 2),
    stdout: textSummary(data)
  }
}

// 文本摘要
function textSummary(data) {
  const { metrics } = data

  let summary = '\n========================================\n'
  summary += '消息发送压测结果摘要\n'
  summary += '========================================\n\n'

  if (metrics.message_count) {
    summary += `总发送消息数: ${metrics.message_count.values.count}\n`
  }

  if (metrics.message_sent) {
    const rate = (metrics.message_sent.values.rate * 100).toFixed(2)
    summary += `发送成功率: ${rate}%\n`
  }

  if (metrics.message_latency) {
    const lat = metrics.message_latency.values
    summary += `\n消息延迟:\n`
    summary += `  - 平均: ${lat.avg.toFixed(2)}ms\n`
    summary += `  - 最小: ${lat.min.toFixed(2)}ms\n`
    summary += `  - 最大: ${lat.max.toFixed(2)}ms\n`
    summary += `  - p90: ${lat['p(90)'].toFixed(2)}ms\n`
    summary += `  - p95: ${lat['p(95)'].toFixed(2)}ms\n`
  }

  if (metrics.message_errors) {
    summary += `\n错误数: ${metrics.message_errors.values.count}\n`
  }

  summary += '\n========================================\n'

  return summary
}
