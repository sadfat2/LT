/**
 * K6 性能测试 - 通过 API 创建测试数据（本地运行）
 *
 * 功能：
 * 1. 通过注册 API 创建 testuser1 ~ testuser100
 * 2. 通过好友 API 建立好友关系
 * 3. 通过群组 API 创建测试群
 *
 * 执行: node create-users-api.js
 */

const https = require('https')
const http = require('http')

// 服务器配置
const BASE_URL = process.env.BASE_URL || 'https://chat.laoyegong.xyz'

// 测试配置
const USER_COUNT = 100
const PASSWORD = 'password123'
const FRIENDS_PER_USER = 5
const GROUP_COUNT = 5
const MEMBERS_PER_GROUP = 20

// 并发控制
const CONCURRENCY = 5  // 同时并发请求数
const DELAY_MS = 100   // 请求间隔

/**
 * HTTP 请求封装
 */
function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL)
    const isHttps = url.protocol === 'https:'
    const lib = isHttps ? https : http

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'K6-Test-Setup/1.0'
      },
      rejectUnauthorized: false  // 允许自签名证书
    }

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`
    }

    const req = lib.request(options, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(body)
          resolve({ status: res.statusCode, data: json })
        } catch {
          resolve({ status: res.statusCode, data: body })
        }
      })
    })

    req.on('error', reject)
    req.setTimeout(30000, () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })

    if (data) {
      req.write(JSON.stringify(data))
    }
    req.end()
  })
}

/**
 * 延迟函数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 批量执行（控制并发）
 */
async function batchExecute(items, fn, concurrency = CONCURRENCY) {
  const results = []
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map(fn))
    results.push(...batchResults)
    if (i + concurrency < items.length) {
      await sleep(DELAY_MS)
    }
  }
  return results
}

/**
 * 注册用户
 */
async function registerUser(account, password) {
  try {
    const res = await request('POST', '/api/auth/register', { account, password })
    if (res.status === 200 || res.status === 201) {
      return { success: true, account }
    }
    // 如果用户已存在，尝试登录
    if (res.data?.message?.includes('已存在') || res.data?.message?.includes('exist')) {
      return { success: true, account, existed: true }
    }
    return { success: false, account, error: res.data?.message || res.status }
  } catch (e) {
    return { success: false, account, error: e.message }
  }
}

/**
 * 登录用户
 */
async function loginUser(account, password) {
  try {
    const res = await request('POST', '/api/auth/login', { account, password })
    if (res.status === 200 && res.data?.data?.token) {
      return { success: true, token: res.data.data.token, user: res.data.data.user }
    }
    return { success: false, error: res.data?.message || res.status }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

/**
 * 发送好友申请
 */
async function sendFriendRequest(token, toUserId) {
  try {
    const res = await request('POST', '/api/friends/request', { toUserId, message: 'K6测试好友' }, token)
    return res.status === 200 || res.status === 201
  } catch {
    return false
  }
}

/**
 * 获取好友申请列表
 */
async function getFriendRequests(token) {
  try {
    const res = await request('GET', '/api/friends/requests', null, token)
    if (res.status === 200 && res.data?.data) {
      // 可能返回 { received: [], sent: [] } 或直接数组
      const data = res.data.data
      if (Array.isArray(data)) {
        return data
      }
      if (data.received) {
        return data.received
      }
      return []
    }
    return []
  } catch {
    return []
  }
}

/**
 * 接受好友申请
 */
async function acceptFriendRequest(token, requestId) {
  try {
    const res = await request('POST', `/api/friends/accept/${requestId}`, {}, token)
    return res.status === 200
  } catch {
    return false
  }
}

/**
 * 创建群组
 */
async function createGroup(token, name, memberIds) {
  try {
    const res = await request('POST', '/api/groups', { name, memberIds }, token)
    if (res.status === 200 || res.status === 201) {
      return { success: true, group: res.data?.data }
    }
    return { success: false, error: res.data?.message }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

/**
 * 获取好友列表
 */
async function getFriends(token) {
  try {
    const res = await request('GET', '/api/friends', null, token)
    if (res.status === 200 && res.data?.data) {
      return res.data.data
    }
    return []
  } catch {
    return []
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================')
  console.log('K6 性能测试 - 通过 API 创建测试数据')
  console.log('========================================')
  console.log(`\n目标服务器: ${BASE_URL}`)
  console.log(`用户数量: ${USER_COUNT}`)
  console.log(`密码: ${PASSWORD}`)
  console.log(`每用户好友数: ${FRIENDS_PER_USER}`)
  console.log(`测试群数量: ${GROUP_COUNT}`)

  // Step 1: 注册用户
  console.log(`\n[1/5] 注册 ${USER_COUNT} 个测试用户...`)
  const accounts = Array.from({ length: USER_COUNT }, (_, i) => `testuser${i + 1}`)

  let registered = 0
  let existed = 0
  let failed = 0

  const registerResults = await batchExecute(accounts, async (account) => {
    const result = await registerUser(account, PASSWORD)
    if (result.success) {
      if (result.existed) {
        existed++
      } else {
        registered++
      }
      process.stdout.write('.')
    } else {
      failed++
      process.stdout.write('x')
    }
    return result
  })

  console.log(`\n   -> 新注册: ${registered}, 已存在: ${existed}, 失败: ${failed}`)

  // Step 2: 登录所有用户获取 token
  console.log(`\n[2/5] 登录所有用户...`)
  const userTokens = new Map()

  await batchExecute(accounts, async (account) => {
    const result = await loginUser(account, PASSWORD)
    if (result.success) {
      userTokens.set(account, { token: result.token, userId: result.user.id })
      process.stdout.write('.')
    } else {
      process.stdout.write('x')
    }
    return result
  })

  console.log(`\n   -> 成功登录: ${userTokens.size}/${USER_COUNT}`)

  if (userTokens.size < 10) {
    console.error('\n错误: 登录用户数过少，无法继续')
    console.error('请检查:')
    console.error('  1. 服务器是否开启了注册功能')
    console.error('  2. 网络是否能访问服务器')
    process.exit(1)
  }

  // Step 3: 建立好友关系
  console.log(`\n[3/5] 建立好友关系...`)
  const userList = Array.from(userTokens.entries())
  let friendRequestsSent = 0

  // 每个用户向随机的其他用户发送好友申请
  for (let i = 0; i < Math.min(userList.length, 50); i++) {
    const [account, { token, userId }] = userList[i]

    // 随机选择好友目标
    const targets = userList
      .filter(([acc]) => acc !== account)
      .sort(() => 0.5 - Math.random())
      .slice(0, FRIENDS_PER_USER)

    for (const [, { userId: targetId }] of targets) {
      const sent = await sendFriendRequest(token, targetId)
      if (sent) friendRequestsSent++
      await sleep(50)
    }
    process.stdout.write('.')
  }

  console.log(`\n   -> 发送好友申请: ${friendRequestsSent}`)

  // Step 4: 接受好友申请
  console.log(`\n[4/5] 接受好友申请...`)
  let acceptedCount = 0

  for (const [account, { token }] of userList) {
    const requests = await getFriendRequests(token)
    // status 是字符串 "pending"
    const pendingRequests = requests.filter(r => r.status === 'pending' || r.status === 0)

    for (const req of pendingRequests) {
      const accepted = await acceptFriendRequest(token, req.id)
      if (accepted) acceptedCount++
      await sleep(50)
    }

    if (pendingRequests.length > 0) {
      process.stdout.write(`.`)
    }
  }

  console.log(`\n   -> 接受好友申请: ${acceptedCount}`)

  // Step 5: 创建测试群
  console.log(`\n[5/5] 创建 ${GROUP_COUNT} 个测试群...`)
  const createdGroups = []

  for (let i = 1; i <= GROUP_COUNT; i++) {
    const groupName = `K6测试群${i}`

    // 选择群成员（从第 (i-1)*15 个用户开始，选20个）
    const startIdx = ((i - 1) * 15) % userList.length
    const memberAccounts = []
    for (let j = 0; j < MEMBERS_PER_GROUP && j < userList.length; j++) {
      memberAccounts.push(userList[(startIdx + j) % userList.length])
    }

    const [ownerAccount, { token: ownerToken }] = memberAccounts[0]
    const memberIds = memberAccounts.slice(1).map(([, { userId }]) => userId)

    const result = await createGroup(ownerToken, groupName, memberIds)
    if (result.success) {
      createdGroups.push({ name: groupName, ...result.group })
      console.log(`   -> 创建群 "${groupName}" 成功`)
    } else {
      // 群可能已存在
      console.log(`   -> 群 "${groupName}": ${result.error || '可能已存在'}`)
    }

    await sleep(200)
  }

  // 完成
  console.log('\n========================================')
  console.log('测试数据准备完成!')
  console.log('========================================')
  console.log(`\n可以使用以下账号测试:`)
  console.log(`  账号: testuser1 ~ testuser${USER_COUNT}`)
  console.log(`  密码: ${PASSWORD}`)
  console.log(`\n现在可以运行 k6 测试:`)
  console.log(`  cd chat-app/k6-tests`)
  console.log(`  k6 run scenarios/login.js --vus 10 --duration 10s`)
}

// 运行
main().catch(console.error)
