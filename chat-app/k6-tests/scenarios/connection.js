/**
 * K6 性能测试 - 场景2: Socket.io 连接压测
 *
 * 测试目标：
 * - 100 用户并发建立 WebSocket 连接
 * - 持续 2 分钟（维持连接）
 * - 连接成功率 > 99%
 * - 握手延迟 < 200ms
 *
 * 执行: k6 run scenarios/connection.js
 */

import http from 'k6/http'
import { WebSocket } from 'k6/experimental/websockets'
import { check, sleep } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js'
import { BASE_URL, WS_URL, USERS, TEST_CONFIG } from '../config.js'
import { login } from '../utils/socketio.js'

// 自定义指标
const connectionSuccess = new Rate('connection_success')
const handshakeDuration = new Trend('handshake_duration', true)
const activeConnections = new Counter('active_connections')
const connectionErrors = new Counter('connection_errors')

// 获取实际 VU 数量（环境变量优先）
const ACTUAL_VUS = parseInt(__ENV.VUS) || TEST_CONFIG.connection.vus

// 测试配置
export const options = {
  scenarios: {
    connection_load_test: {
      executor: 'constant-vus',
      vus: TEST_CONFIG.connection.vus,
      duration: TEST_CONFIG.connection.duration
    }
  },
  thresholds: {
    connection_success: ['rate>0.99'],    // 连接成功率大于 99%
    handshake_duration: ['p(95)<200'],    // 握手延迟 p95 小于 200ms
    connection_errors: ['count<10']       // 错误数小于 10
  },
  setupTimeout: '120s'
}

// 设置阶段
export function setup() {
  console.log('========================================')
  console.log('场景2: Socket.io 连接压测')
  console.log('========================================')
  console.log(`目标服务器: ${BASE_URL}`)
  console.log(`WebSocket: ${WS_URL}`)
  console.log(`并发连接数: ${ACTUAL_VUS}`)
  console.log(`持续时间: ${TEST_CONFIG.connection.duration}`)
  console.log('----------------------------------------')

  // 预先获取所有用户的 token（只登录实际需要的数量）
  const tokens = []
  console.log(`准备登录 ${ACTUAL_VUS} 个用户...`)
  for (let i = 0; i < Math.min(USERS.length, ACTUAL_VUS); i++) {
    const result = login(BASE_URL, USERS[i].account, USERS[i].password)
    if (result.success) {
      tokens.push({
        account: USERS[i].account,
        token: result.token,
        userId: result.user.id
      })
    } else {
      console.warn(`预登录失败: ${USERS[i].account}`)
    }
  }

  console.log(`预登录完成: ${tokens.length}/${USERS.length} 用户`)

  if (tokens.length === 0) {
    console.error('错误: 无可用的登录凭证')
    return { tokens: [], serverAvailable: false }
  }

  return { tokens, serverAvailable: true }
}

// 主测试函数
export default function (data) {
  if (!data.serverAvailable || data.tokens.length === 0) {
    console.error('无可用凭证，跳过测试')
    return
  }

  // 根据 VU ID 选择 token
  const tokenIndex = (__VU - 1) % data.tokens.length
  const { token, account } = data.tokens[tokenIndex]

  // Step 1: HTTP 轮询握手
  const handshakeStart = Date.now()
  const handshakeUrl = `${BASE_URL}/socket.io/?EIO=4&transport=polling&token=${token}`
  const handshakeResponse = http.get(handshakeUrl, { timeout: '5s' })

  if (handshakeResponse.status !== 200) {
    connectionErrors.add(1)
    connectionSuccess.add(false)
    console.error(`握手失败 [${account}]: status=${handshakeResponse.status}`)
    return
  }

  // 解析 sid
  const body = handshakeResponse.body
  if (!body || !body.startsWith('0')) {
    connectionErrors.add(1)
    connectionSuccess.add(false)
    console.error(`无效握手响应 [${account}]: ${body.substring(0, 100)}`)
    return
  }

  let openData
  try {
    openData = JSON.parse(body.substring(1))
  } catch (e) {
    connectionErrors.add(1)
    connectionSuccess.add(false)
    console.error(`解析握手响应失败 [${account}]: ${e.message}`)
    return
  }

  const sid = openData.sid
  const handshakeDur = Date.now() - handshakeStart
  handshakeDuration.add(handshakeDur)

  // Step 2: WebSocket 升级
  const wsUrl = `${WS_URL}/socket.io/?EIO=4&transport=websocket&sid=${sid}&token=${token}`

  const ws = new WebSocket(wsUrl)

  let connected = false
  let upgradeComplete = false

  ws.onopen = () => {
    // 发送 upgrade probe
    ws.send('2probe')
  }

  ws.onmessage = (e) => {
    const msg = e.data

    if (msg === '3probe') {
      // 收到 pong probe，发送 upgrade
      ws.send('5')
      // 发送 Socket.io connect
      ws.send('40')
    } else if (msg.startsWith('40')) {
      // Socket.io 连接成功
      connected = true
      upgradeComplete = true
      activeConnections.add(1)
      connectionSuccess.add(true)
    } else if (msg === '2') {
      // Engine.io ping，回复 pong
      ws.send('3')
    }
  }

  ws.onerror = (e) => {
    connectionErrors.add(1)
    if (!connected) {
      connectionSuccess.add(false)
    }
    console.error(`WebSocket 错误 [${account}]: ${e.message || e}`)
  }

  ws.onclose = () => {
    if (connected) {
      activeConnections.add(-1)
    }
  }

  // 等待连接建立
  let waitTime = 0
  while (!upgradeComplete && waitTime < 10000) {
    sleep(0.1)
    waitTime += 100
  }

  if (!upgradeComplete) {
    connectionErrors.add(1)
    connectionSuccess.add(false)
    console.error(`连接超时 [${account}]`)
    ws.close()
    return
  }

  // 维持连接一段时间
  // k6 不支持长时间等待，使用短循环模拟
  const holdDuration = 30 // 秒
  let elapsed = 0
  while (elapsed < holdDuration) {
    sleep(5)
    elapsed += 5

    // 检查连接状态
    if (!connected) {
      console.warn(`连接断开 [${account}]`)
      break
    }
  }

  // 关闭连接
  if (ws) {
    try {
      ws.send('41')  // Socket.io disconnect
      ws.close()
    } catch (e) {
      // 忽略关闭错误
    }
  }
}

// 清理阶段
export function teardown(data) {
  console.log('----------------------------------------')
  console.log('连接压测完成')
}

// 生成 HTML 报告
export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return {
    [`reports/connection-${timestamp}.html`]: htmlReport(data, { title: 'Socket.io 连接压测报告' }),
    [`reports/connection-${timestamp}.json`]: JSON.stringify(data, null, 2),
    stdout: textSummary(data)
  }
}

// 文本摘要
function textSummary(data) {
  const { metrics } = data

  let summary = '\n========================================\n'
  summary += 'Socket.io 连接压测结果摘要\n'
  summary += '========================================\n\n'

  if (metrics.connection_success) {
    const rate = (metrics.connection_success.values.rate * 100).toFixed(2)
    summary += `连接成功率: ${rate}%\n`
  }

  if (metrics.handshake_duration) {
    const dur = metrics.handshake_duration.values
    summary += `\n握手延迟:\n`
    summary += `  - 平均: ${dur.avg.toFixed(2)}ms\n`
    summary += `  - p95: ${dur['p(95)'].toFixed(2)}ms\n`
  }

  if (metrics.connection_errors) {
    summary += `\n连接错误数: ${metrics.connection_errors.values.count}\n`
  }

  if (metrics.active_connections) {
    summary += `活跃连接峰值: ${metrics.active_connections.values.count}\n`
  }

  summary += '\n========================================\n'

  return summary
}
