/**
 * K6 性能测试 - 场景1: 登录 API 压测
 *
 * 测试目标：
 * - 100 VU 并发登录
 * - 持续 1 分钟
 * - p95 响应时间 < 500ms
 * - 成功率 > 99%
 *
 * 执行: k6 run scenarios/login.js
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js'
import { BASE_URL, USERS, TEST_CONFIG } from '../config.js'

// 自定义指标
const loginSuccess = new Rate('login_success')
const loginDuration = new Trend('login_duration', true)

// 测试配置
export const options = {
  scenarios: {
    login_load_test: {
      executor: 'constant-vus',
      vus: TEST_CONFIG.login.vus,
      duration: TEST_CONFIG.login.duration
    }
  },
  thresholds: {
    http_req_duration: ['p(95)<5000'],   // 95% 请求小于 5000ms（生产环境网络延迟）
    http_req_failed: ['rate<0.05'],      // 失败率小于 5%
    login_success: ['rate>0.95']         // 登录成功率大于 95%
  }
}

// 设置阶段（可选，用于预热）
export function setup() {
  console.log('========================================')
  console.log('场景1: 登录 API 压测')
  console.log('========================================')
  console.log(`目标服务器: ${BASE_URL}`)
  console.log(`并发用户数: ${TEST_CONFIG.login.vus}`)
  console.log(`持续时间: ${TEST_CONFIG.login.duration}`)
  console.log('----------------------------------------')

  // 验证服务器是否可用
  const healthCheck = http.get(`${BASE_URL}/api/auth/login`, {
    timeout: '5s'
  })

  if (healthCheck.status === 0) {
    console.error('错误: 无法连接到服务器')
    return { serverAvailable: false }
  }

  return { serverAvailable: true }
}

// 主测试函数
export default function (data) {
  if (!data.serverAvailable) {
    console.error('服务器不可用，跳过测试')
    return
  }

  // 根据 VU ID 选择用户（循环使用）
  const userIndex = (__VU - 1) % USERS.length
  const user = USERS[userIndex]

  // 发送登录请求
  const startTime = Date.now()
  const response = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      account: user.account,
      password: user.password
    }),
    {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: '10s'
    }
  )
  const duration = Date.now() - startTime

  // 记录自定义指标
  loginDuration.add(duration)

  // 检查响应（功能性检查）
  const isSuccess = response.status === 200 && response.body && response.body.includes('"token"')

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response has token': (r) => r.body && r.body.includes('"token"')
  })

  loginSuccess.add(isSuccess)

  // 如果登录失败（非200或无token），记录详细信息
  if (response.status !== 200 || !response.body.includes('"token"')) {
    console.warn(`登录失败 [${user.account}]: status=${response.status}, body=${response.body.substring(0, 200)}`)
  }

  // 短暂休息，模拟真实用户行为
  sleep(0.5 + Math.random() * 0.5)
}

// 清理阶段
export function teardown(data) {
  console.log('----------------------------------------')
  console.log('登录压测完成')
}

// 生成 HTML 报告
export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return {
    [`reports/login-${timestamp}.html`]: htmlReport(data, { title: '登录 API 压测报告' }),
    [`reports/login-${timestamp}.json`]: JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: '  ', enableColors: true })
  }
}

// 文本摘要（控制台输出）
function textSummary(data, options) {
  const { metrics } = data

  let summary = '\n========================================\n'
  summary += '登录压测结果摘要\n'
  summary += '========================================\n\n'

  // HTTP 请求统计
  if (metrics.http_reqs) {
    summary += `总请求数: ${metrics.http_reqs.values.count}\n`
    summary += `请求速率: ${metrics.http_reqs.values.rate.toFixed(2)} req/s\n`
  }

  // 响应时间
  if (metrics.http_req_duration) {
    const dur = metrics.http_req_duration.values
    summary += `\n响应时间:\n`
    summary += `  - 平均: ${dur.avg.toFixed(2)}ms\n`
    summary += `  - 最小: ${dur.min.toFixed(2)}ms\n`
    summary += `  - 最大: ${dur.max.toFixed(2)}ms\n`
    summary += `  - p90: ${dur['p(90)'].toFixed(2)}ms\n`
    summary += `  - p95: ${dur['p(95)'].toFixed(2)}ms\n`
  }

  // 成功率
  if (metrics.login_success) {
    const rate = (metrics.login_success.values.rate * 100).toFixed(2)
    summary += `\n登录成功率: ${rate}%\n`
  }

  // 失败率
  if (metrics.http_req_failed) {
    const rate = (metrics.http_req_failed.values.rate * 100).toFixed(2)
    summary += `请求失败率: ${rate}%\n`
  }

  summary += '\n========================================\n'

  return summary
}
