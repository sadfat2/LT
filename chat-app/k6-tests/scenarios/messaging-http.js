/**
 * K6 性能测试 - 消息发送压测（HTTP 版本）
 *
 * 通过 HTTP API 测试消息发送性能，避免 WebSocket 复杂性
 *
 * 执行: k6 run scenarios/messaging-http.js --vus 50 --duration 30s
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js'
import { BASE_URL, USERS } from '../config.js'

// 自定义指标
const messageSent = new Rate('message_sent')
const messageLatency = new Trend('message_latency', true)
const messageCount = new Counter('message_count')

// 测试配置
export const options = {
  thresholds: {
    message_sent: ['rate>0.95'],
    message_latency: ['p(95)<2000'],
    http_req_failed: ['rate<0.05']
  },
  setupTimeout: '120s'
}

// 设置阶段 - 预登录用户
export function setup() {
  console.log('========================================')
  console.log('消息发送压测 (HTTP API)')
  console.log('========================================')
  console.log(`目标服务器: ${BASE_URL}`)
  console.log('----------------------------------------')

  const VUS = parseInt(__ENV.VUS) || 50
  const usersToLogin = Math.min(USERS.length, VUS)
  console.log(`准备登录 ${usersToLogin} 个用户...`)

  const userContexts = []

  for (let i = 0; i < usersToLogin; i++) {
    const response = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({
        account: USERS[i].account,
        password: USERS[i].password
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )

    if (response.status === 200) {
      const data = JSON.parse(response.body)
      if (data.code === 200) {
        // 获取好友列表
        const friendsResp = http.get(`${BASE_URL}/api/friends`, {
          headers: { 'Authorization': `Bearer ${data.data.token}` }
        })

        let friends = []
        if (friendsResp.status === 200) {
          const friendsData = JSON.parse(friendsResp.body)
          friends = friendsData.data?.list || friendsData.data || []
        }

        userContexts.push({
          account: USERS[i].account,
          token: data.data.token,
          userId: data.data.user.id,
          friends: friends
        })
      }
    }

    // 每 10 个用户输出进度
    if ((i + 1) % 10 === 0) {
      console.log(`已登录: ${i + 1}/${usersToLogin}`)
    }
  }

  console.log(`预登录完成: ${userContexts.length} 用户`)

  const totalFriends = userContexts.reduce((sum, u) => sum + (u.friends?.length || 0), 0)
  console.log(`总好友数: ${totalFriends}`)

  return { userContexts }
}

// 主测试函数
export default function (data) {
  if (!data.userContexts || data.userContexts.length === 0) {
    console.error('无可用凭证')
    return
  }

  // 根据 VU ID 选择用户
  const userIndex = (__VU - 1) % data.userContexts.length
  const userCtx = data.userContexts[userIndex]

  if (!userCtx.friends || userCtx.friends.length === 0) {
    sleep(1)
    return
  }

  // 随机选择一个好友
  const friend = userCtx.friends[Math.floor(Math.random() * userCtx.friends.length)]

  // 先创建/获取会话
  const convResp = http.post(
    `${BASE_URL}/api/conversations/private`,
    JSON.stringify({ friendId: friend.id }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userCtx.token}`
      }
    }
  )

  if (convResp.status !== 200) {
    messageSent.add(false)
    return
  }

  const convData = JSON.parse(convResp.body)
  const conversationId = convData.data?.id || convData.data?.conversation?.id

  if (!conversationId) {
    messageSent.add(false)
    return
  }

  // 发送消息 (通过 HTTP API)
  const messageContent = `K6测试消息 [${userCtx.account}] @${Date.now()}`
  const startTime = Date.now()

  const msgResp = http.post(
    `${BASE_URL}/api/messages`,
    JSON.stringify({
      conversationId: conversationId,
      type: 'text',
      content: messageContent
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userCtx.token}`
      }
    }
  )

  const latency = Date.now() - startTime

  const success = check(msgResp, {
    'message sent': (r) => r.status === 200 || r.status === 201
  })

  if (success) {
    messageSent.add(true)
    messageLatency.add(latency)
    messageCount.add(1)
  } else {
    messageSent.add(false)
  }

  sleep(0.5)
}

// 生成报告
export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

  console.log('')
  console.log('========================================')
  console.log('消息发送压测结果摘要')
  console.log('========================================')
  console.log('')
  console.log(`发送成功率: ${(data.metrics.message_sent?.values?.rate * 100 || 0).toFixed(2)}%`)
  console.log('')
  console.log('消息延迟:')
  console.log(`  - 平均: ${(data.metrics.message_latency?.values?.avg || 0).toFixed(2)}ms`)
  console.log(`  - 最小: ${(data.metrics.message_latency?.values?.min || 0).toFixed(2)}ms`)
  console.log(`  - 最大: ${(data.metrics.message_latency?.values?.max || 0).toFixed(2)}ms`)
  console.log(`  - p90: ${(data.metrics.message_latency?.values?.['p(90)'] || 0).toFixed(2)}ms`)
  console.log(`  - p95: ${(data.metrics.message_latency?.values?.['p(95)'] || 0).toFixed(2)}ms`)
  console.log('')
  console.log(`总消息数: ${data.metrics.message_count?.values?.count || 0}`)
  console.log('')
  console.log('========================================')

  return {
    [`reports/messaging-${timestamp}.html`]: htmlReport(data),
    [`reports/messaging-${timestamp}.json`]: JSON.stringify(data, null, 2)
  }
}
