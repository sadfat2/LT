/**
 * K6 性能测试 - 场景4: 群聊广播压测
 *
 * 测试目标：
 * - 5 个群同时测试，每群 20 人
 * - 测试群消息广播性能
 * - 广播完成时间 < 1s
 * - 消息到达率 100%
 *
 * 执行: k6 run scenarios/broadcast.js
 */

import http from 'k6/http'
import { WebSocket } from 'k6/experimental/websockets'
import { check, sleep } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js'
import { BASE_URL, WS_URL, USERS, TEST_CONFIG } from '../config.js'
import { login, getGroups } from '../utils/socketio.js'

// 自定义指标
const broadcastSuccess = new Rate('broadcast_success')
const broadcastLatency = new Trend('broadcast_latency', true)
const messagesReceived = new Counter('messages_received')
const broadcastErrors = new Counter('broadcast_errors')

// 测试配置
export const options = {
  scenarios: {
    broadcast_load_test: {
      executor: 'constant-vus',
      vus: TEST_CONFIG.broadcast.groupCount * TEST_CONFIG.broadcast.membersPerGroup,  // 5群 * 20人 = 100
      duration: TEST_CONFIG.broadcast.duration
    }
  },
  thresholds: {
    broadcast_success: ['rate>0.99'],     // 广播成功率大于 99%
    broadcast_latency: ['p(95)<1000'],    // 广播延迟 p95 小于 1s
    broadcast_errors: ['count<50']        // 错误数小于 50
  }
}

// 设置阶段
export function setup() {
  console.log('========================================')
  console.log('场景4: 群聊广播压测')
  console.log('========================================')
  console.log(`目标服务器: ${BASE_URL}`)
  console.log(`测试群数: ${TEST_CONFIG.broadcast.groupCount}`)
  console.log(`每群成员: ${TEST_CONFIG.broadcast.membersPerGroup}`)
  console.log(`持续时间: ${TEST_CONFIG.broadcast.duration}`)
  console.log('----------------------------------------')

  // 获取测试群信息
  const userContexts = []

  // 先登录第一个用户获取群列表
  const firstUser = USERS[0]
  const loginResult = login(BASE_URL, firstUser.account, firstUser.password)

  if (!loginResult.success) {
    console.error('登录失败，无法获取群列表')
    return { userContexts: [], groups: [], serverAvailable: false }
  }

  const groupsResult = getGroups(BASE_URL, loginResult.token)
  if (!groupsResult.success) {
    console.error('获取群列表失败')
    return { userContexts: [], groups: [], serverAvailable: false }
  }

  // 过滤出 K6 测试群
  const testGroups = groupsResult.groups.filter(g => g.name.startsWith('K6测试群'))
  console.log(`找到 ${testGroups.length} 个测试群`)

  if (testGroups.length === 0) {
    console.error('没有找到测试群，请先运行 setup/create-users.js')
    return { userContexts: [], groups: [], serverAvailable: false }
  }

  // 为每个测试用户准备上下文
  for (let i = 0; i < Math.min(USERS.length, TEST_CONFIG.broadcast.groupCount * TEST_CONFIG.broadcast.membersPerGroup); i++) {
    const result = login(BASE_URL, USERS[i].account, USERS[i].password)
    if (result.success) {
      // 获取用户所在的群
      const userGroups = getGroups(BASE_URL, result.token)
      const groups = userGroups.success ? userGroups.groups.filter(g => g.name.startsWith('K6测试群')) : []

      userContexts.push({
        account: USERS[i].account,
        token: result.token,
        userId: result.user.id,
        groups: groups
      })
    }
  }

  console.log(`预登录完成: ${userContexts.length} 用户`)

  return {
    userContexts,
    groups: testGroups,
    serverAvailable: true
  }
}

// 主测试函数
export default function (data) {
  if (!data.serverAvailable || data.userContexts.length === 0) {
    console.error('无可用数据，跳过测试')
    return
  }

  // 根据 VU ID 选择用户
  const userIndex = (__VU - 1) % data.userContexts.length
  const userCtx = data.userContexts[userIndex]
  const { token, account, userId, groups } = userCtx

  if (groups.length === 0) {
    console.warn(`用户 ${account} 不在任何测试群中`)
    sleep(1)
    return
  }

  // Step 1: 建立 WebSocket 连接
  const handshakeUrl = `${BASE_URL}/socket.io/?EIO=4&transport=polling&token=${token}`
  const handshakeResponse = http.get(handshakeUrl, { timeout: '5s' })

  if (handshakeResponse.status !== 200) {
    broadcastErrors.add(1)
    broadcastSuccess.add(false)
    return
  }

  let openData
  try {
    openData = JSON.parse(handshakeResponse.body.substring(1))
  } catch (e) {
    broadcastErrors.add(1)
    broadcastSuccess.add(false)
    return
  }

  const sid = openData.sid
  const wsUrl = `${WS_URL}/socket.io/?EIO=4&transport=websocket&sid=${sid}&token=${token}`
  const ws = new WebSocket(wsUrl)

  let connected = false
  let ackId = 0
  const pendingAcks = new Map()
  const receivedMessages = new Set()

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
    } else if (msg.startsWith('42')) {
      // 收到事件（群消息）
      // 格式: 42["new_message",{...}]
      try {
        const eventData = JSON.parse(msg.substring(2))
        if (eventData[0] === 'new_message') {
          const messageData = eventData[1]
          if (messageData.message) {
            messagesReceived.add(1)

            // 计算广播延迟
            const content = messageData.message.content || ''
            const match = content.match(/@(\d+)$/)
            if (match) {
              const sendTime = parseInt(match[1])
              const latency = Date.now() - sendTime
              broadcastLatency.add(latency)
            }

            receivedMessages.add(messageData.message.id)
          }
        }
      } catch (e) {
        // 忽略解析错误
      }
    } else if (msg.startsWith('43')) {
      // ACK 响应
      const match = msg.match(/^43(\d+)(.*)/)
      if (match) {
        const respAckId = parseInt(match[1])
        const respData = match[2] ? JSON.parse(match[2]) : null

        const pending = pendingAcks.get(respAckId)
        if (pending) {
          if (respData && respData[0] && respData[0].success) {
            broadcastSuccess.add(true)
          } else {
            broadcastSuccess.add(false)
            broadcastErrors.add(1)
          }
          pendingAcks.delete(respAckId)
        }
      }
    }
  }

  ws.onerror = (e) => {
    broadcastErrors.add(1)
    console.error(`WebSocket 错误 [${account}]: ${e.message || e}`)
  }

  // 等待连接
  let waitTime = 0
  while (!connected && waitTime < 10000) {
    sleep(0.1)
    waitTime += 100
  }

  if (!connected) {
    broadcastErrors.add(1)
    broadcastSuccess.add(false)
    ws.close()
    return
  }

  // Step 2: 发送群消息
  // 只有部分用户发送消息（模拟真实场景）
  const shouldSend = (__VU % 5 === 0)  // 每5个用户中有1个发送消息

  if (shouldSend) {
    // 随机选择一个群
    const group = groups[Math.floor(Math.random() * groups.length)]
    const currentAckId = ackId++

    const messageContent = `K6群消息测试 [${account}] @${Date.now()}`
    const messageData = {
      conversationId: group.conversation_id,
      type: 'text',
      content: messageContent
    }

    pendingAcks.set(currentAckId, { startTime: Date.now() })

    const packet = `42${currentAckId}${JSON.stringify(['send_message', messageData])}`
    try {
      ws.send(packet)
    } catch (e) {
      broadcastErrors.add(1)
      broadcastSuccess.add(false)
      pendingAcks.delete(currentAckId)
    }
  }

  // Step 3: 保持连接接收消息
  const holdDuration = 20  // 秒
  let elapsed = 0
  while (elapsed < holdDuration && connected) {
    sleep(1)
    elapsed += 1
  }

  // 等待 ACK
  let ackWaitTime = 0
  while (pendingAcks.size > 0 && ackWaitTime < 3000) {
    sleep(0.1)
    ackWaitTime += 100
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
  console.log('群聊广播压测完成')
}

// 生成 HTML 报告
export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return {
    [`reports/broadcast-${timestamp}.html`]: htmlReport(data, { title: '群聊广播压测报告' }),
    [`reports/broadcast-${timestamp}.json`]: JSON.stringify(data, null, 2),
    stdout: textSummary(data)
  }
}

// 文本摘要
function textSummary(data) {
  const { metrics } = data

  let summary = '\n========================================\n'
  summary += '群聊广播压测结果摘要\n'
  summary += '========================================\n\n'

  if (metrics.broadcast_success) {
    const rate = (metrics.broadcast_success.values.rate * 100).toFixed(2)
    summary += `广播成功率: ${rate}%\n`
  }

  if (metrics.messages_received) {
    summary += `接收消息总数: ${metrics.messages_received.values.count}\n`
  }

  if (metrics.broadcast_latency) {
    const lat = metrics.broadcast_latency.values
    summary += `\n广播延迟:\n`
    summary += `  - 平均: ${lat.avg.toFixed(2)}ms\n`
    summary += `  - 最小: ${lat.min.toFixed(2)}ms\n`
    summary += `  - 最大: ${lat.max.toFixed(2)}ms\n`
    summary += `  - p95: ${lat['p(95)'].toFixed(2)}ms\n`
  }

  if (metrics.broadcast_errors) {
    summary += `\n错误数: ${metrics.broadcast_errors.values.count}\n`
  }

  summary += '\n========================================\n'

  return summary
}
