/**
 * K6 性能测试 - 测试数据准备脚本
 *
 * 功能：
 * 1. 创建 testuser1 ~ testuser100 测试用户
 * 2. 为每个用户建立 5 个随机好友关系
 * 3. 创建 5 个测试群（每群 20 人）
 *
 * 执行: node create-users.js
 */

const mysql = require('mysql2/promise')
const bcrypt = require('bcrypt')
const pinyin = require('pinyin')

// 数据库配置（根据你的服务器环境修改）
// 可通过环境变量覆盖，例如: DB_HOST=mysql DB_PASSWORD=xxx node create-users.js
const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',      // Docker 内部用 mysql 或 chat-mysql
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root123456',  // 修改为你的数据库密码
  database: process.env.DB_NAME || 'chat_app'
}

// 测试配置
const USER_COUNT = 100
const PASSWORD = 'password123'
const FRIENDS_PER_USER = 5
const GROUP_COUNT = 5
const MEMBERS_PER_GROUP = 20

/**
 * 生成拼音
 */
function generatePinyin(text) {
  try {
    return pinyin(text, {
      style: pinyin.STYLE_NORMAL
    }).flat().join('')
  } catch {
    return text
  }
}

/**
 * 创建测试用户
 */
async function createUsers(conn) {
  console.log(`\n[1/4] 创建 ${USER_COUNT} 个测试用户...`)

  const hashedPassword = await bcrypt.hash(PASSWORD, 10)
  const users = []

  for (let i = 1; i <= USER_COUNT; i++) {
    const account = `testuser${i}`
    const nickname = `测试用户${i}`
    const pinyinStr = generatePinyin(nickname)

    users.push([account, hashedPassword, nickname, pinyinStr])
  }

  // 批量插入用户（忽略已存在的）
  const sql = `
    INSERT IGNORE INTO users (account, password, nickname, pinyin, status)
    VALUES ?
  `
  const values = users.map(u => [...u, 'active'])

  const [result] = await conn.query(sql, [values])
  console.log(`   -> 创建了 ${result.affectedRows} 个新用户`)

  // 获取所有测试用户 ID
  const [rows] = await conn.query(
    'SELECT id, account FROM users WHERE account LIKE ? ORDER BY id',
    ['testuser%']
  )

  const userMap = new Map()
  rows.forEach(row => userMap.set(row.account, row.id))

  return userMap
}

/**
 * 创建好友关系
 */
async function createFriendships(conn, userMap) {
  console.log(`\n[2/4] 为每个用户创建 ${FRIENDS_PER_USER} 个好友关系...`)

  const userIds = Array.from(userMap.values())
  const friendships = []

  for (const userId of userIds) {
    // 随机选择好友
    const possibleFriends = userIds.filter(id => id !== userId)
    const shuffled = possibleFriends.sort(() => 0.5 - Math.random())
    const selectedFriends = shuffled.slice(0, FRIENDS_PER_USER)

    for (const friendId of selectedFriends) {
      // 双向好友关系
      friendships.push([userId, friendId])
      friendships.push([friendId, userId])
    }
  }

  // 去重
  const uniqueFriendships = []
  const seen = new Set()
  for (const [userId, friendId] of friendships) {
    const key = `${userId}-${friendId}`
    if (!seen.has(key)) {
      seen.add(key)
      uniqueFriendships.push([userId, friendId])
    }
  }

  // 批量插入好友关系（忽略已存在的）
  if (uniqueFriendships.length > 0) {
    const sql = `INSERT IGNORE INTO friendships (user_id, friend_id) VALUES ?`
    const [result] = await conn.query(sql, [uniqueFriendships])
    console.log(`   -> 创建了 ${result.affectedRows} 条好友关系`)
  }
}

/**
 * 创建测试群组
 */
async function createGroups(conn, userMap) {
  console.log(`\n[3/4] 创建 ${GROUP_COUNT} 个测试群组（每群 ${MEMBERS_PER_GROUP} 人）...`)

  const userIds = Array.from(userMap.values())
  const groupIds = []

  for (let i = 1; i <= GROUP_COUNT; i++) {
    const groupName = `K6测试群${i}`
    const ownerId = userIds[(i - 1) * MEMBERS_PER_GROUP]  // 每群第一个人为群主

    // 检查群是否已存在
    const [existing] = await conn.query(
      'SELECT id FROM `groups` WHERE name = ?',
      [groupName]
    )

    let groupId
    if (existing.length > 0) {
      groupId = existing[0].id
      console.log(`   -> 群 "${groupName}" 已存在 (ID: ${groupId})`)
    } else {
      // 创建群
      const [result] = await conn.query(
        'INSERT INTO `groups` (name, owner_id) VALUES (?, ?)',
        [groupName, ownerId]
      )
      groupId = result.insertId
      console.log(`   -> 创建群 "${groupName}" (ID: ${groupId})`)
    }

    groupIds.push({ groupId, ownerId, index: i })
  }

  return groupIds
}

/**
 * 添加群成员
 */
async function addGroupMembers(conn, userMap, groups) {
  console.log(`\n[4/4] 添加群成员...`)

  const userIds = Array.from(userMap.values())

  for (const { groupId, ownerId, index } of groups) {
    // 获取该群的成员（每群使用不同的用户范围，但有重叠）
    const startIndex = ((index - 1) * 15) % userIds.length
    const memberIds = []

    for (let j = 0; j < MEMBERS_PER_GROUP; j++) {
      const memberId = userIds[(startIndex + j) % userIds.length]
      memberIds.push(memberId)
    }

    // 确保群主在成员列表中
    if (!memberIds.includes(ownerId)) {
      memberIds[0] = ownerId
    }

    // 创建群会话
    const [existingConv] = await conn.query(
      'SELECT id FROM conversations WHERE type = ? AND group_id = ?',
      ['group', groupId]
    )

    let conversationId
    if (existingConv.length > 0) {
      conversationId = existingConv[0].id
    } else {
      const [convResult] = await conn.query(
        'INSERT INTO conversations (type, group_id) VALUES (?, ?)',
        ['group', groupId]
      )
      conversationId = convResult.insertId
    }

    // 添加群成员
    const memberValues = memberIds.map(memberId => [
      groupId,
      memberId,
      memberId === ownerId ? 'owner' : 'member'
    ])

    await conn.query(
      'INSERT IGNORE INTO group_members (group_id, user_id, role) VALUES ?',
      [memberValues]
    )

    // 添加会话参与者
    const participantValues = memberIds.map(memberId => [conversationId, memberId])
    await conn.query(
      'INSERT IGNORE INTO conversation_participants (conversation_id, user_id) VALUES ?',
      [participantValues]
    )

    console.log(`   -> 群 ${groupId} 添加了 ${memberIds.length} 个成员`)
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================')
  console.log('K6 性能测试 - 测试数据准备')
  console.log('========================================')
  console.log(`\n配置:`)
  console.log(`  - 用户数量: ${USER_COUNT}`)
  console.log(`  - 密码: ${PASSWORD}`)
  console.log(`  - 每用户好友数: ${FRIENDS_PER_USER}`)
  console.log(`  - 测试群数量: ${GROUP_COUNT}`)
  console.log(`  - 每群成员数: ${MEMBERS_PER_GROUP}`)

  let conn
  try {
    console.log(`\n连接数据库: ${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`)
    conn = await mysql.createConnection(DB_CONFIG)
    console.log('   -> 数据库连接成功')

    // 创建用户
    const userMap = await createUsers(conn)

    if (userMap.size < USER_COUNT) {
      console.log(`\n警告: 只找到 ${userMap.size} 个测试用户，可能有些用户已存在`)
    }

    // 创建好友关系
    await createFriendships(conn, userMap)

    // 创建群组
    const groups = await createGroups(conn, userMap)

    // 添加群成员
    await addGroupMembers(conn, userMap, groups)

    console.log('\n========================================')
    console.log('测试数据准备完成!')
    console.log('========================================')
    console.log(`\n可以使用以下账号登录测试:`)
    console.log(`  账号: testuser1 ~ testuser${USER_COUNT}`)
    console.log(`  密码: ${PASSWORD}`)
    console.log(`\n群聊:`)
    groups.forEach(g => {
      console.log(`  - K6测试群${g.index} (ID: ${g.groupId})`)
    })

  } catch (error) {
    console.error('\n错误:', error.message)
    if (error.code === 'ECONNREFUSED') {
      console.error('\n请确保 MySQL 服务已启动:')
      console.error('  cd chat-app && docker-compose up -d')
    }
    process.exit(1)
  } finally {
    if (conn) {
      await conn.end()
    }
  }
}

// 运行主函数
main()
