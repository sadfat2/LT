const db = require('./db')
const bcrypt = require('bcryptjs')
const config = require('../config')

const User = {
  // 根据 ID 查找用户
  async findById(id) {
    return db.findOne(
      `SELECT id, account, nickname, avatar, coins, level, experience,
              total_games, wins, created_at, updated_at, chat_user_id
       FROM users WHERE id = ?`,
      [id]
    )
  },

  // 根据账号查找用户
  async findByAccount(account) {
    return db.findOne('SELECT * FROM users WHERE account = ?', [account])
  },

  // 根据聊天用户ID查找用户
  async findByChatUserId(chatUserId) {
    return db.findOne('SELECT * FROM users WHERE chat_user_id = ?', [chatUserId])
  },

  // 创建用户
  async create(userData) {
    const { account, password, nickname } = userData
    const hashedPassword = await bcrypt.hash(password, 10)

    const id = await db.insert(
      `INSERT INTO users (account, password, nickname, coins, level, experience, total_games, wins)
       VALUES (?, ?, ?, ?, 1, 0, 0, 0)`,
      [account, hashedPassword, nickname, config.game.initialCoins]
    )

    return this.findById(id)
  },

  // 从聊天应用创建用户
  async createFromChat(chatUser) {
    const { id: chatUserId, account, nickname, avatar } = chatUser
    // 生成随机密码（聊天用户不需要密码登录）
    const randomPassword = Math.random().toString(36).substring(2, 15)
    const hashedPassword = await bcrypt.hash(randomPassword, 10)

    const userId = await db.insert(
      `INSERT INTO users (account, password, nickname, avatar, coins, level, experience, total_games, wins, chat_user_id)
       VALUES (?, ?, ?, ?, ?, 1, 0, 0, 0, ?)`,
      [account, hashedPassword, nickname, avatar, config.game.initialCoins, chatUserId]
    )

    return userId
  },

  // 同步聊天应用的用户信息
  async syncFromChat(gameUserId, chatUser) {
    const { nickname, avatar } = chatUser
    await db.update(
      'UPDATE users SET nickname = ?, avatar = ?, updated_at = NOW() WHERE id = ?',
      [nickname, avatar, gameUserId]
    )
  },

  // 验证密码
  async verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword)
  },

  // 更新用户信息
  async updateProfile(id, data) {
    const fields = []
    const values = []

    if (data.nickname !== undefined) {
      fields.push('nickname = ?')
      values.push(data.nickname)
    }

    if (data.avatar !== undefined) {
      fields.push('avatar = ?')
      values.push(data.avatar)
    }

    if (fields.length === 0) return null

    values.push(id)
    await db.update(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values)
    return this.findById(id)
  },

  // 更新金币
  async updateCoins(id, amount) {
    await db.update('UPDATE users SET coins = coins + ? WHERE id = ?', [amount, id])
    return this.findById(id)
  },

  // 更新战绩
  async updateStats(id, isWin) {
    await db.update(
      `UPDATE users SET total_games = total_games + 1, wins = wins + ? WHERE id = ?`,
      [isWin ? 1 : 0, id]
    )
    return this.findById(id)
  },

  // 获取用户战绩统计
  async getStats(id) {
    const user = await this.findById(id)
    if (!user) return null

    // 获取地主/农民分别战绩
    const records = await db.query(
      `SELECT role, COUNT(*) as total, SUM(is_win) as wins
       FROM game_records WHERE user_id = ? GROUP BY role`,
      [id]
    )

    const stats = {
      totalGames: user.total_games,
      wins: user.wins,
      winRate: user.total_games > 0 ? user.wins / user.total_games : 0,
      landlordGames: 0,
      landlordWins: 0,
      farmerGames: 0,
      farmerWins: 0,
    }

    records.forEach((r) => {
      if (r.role === 'landlord') {
        stats.landlordGames = r.total
        stats.landlordWins = r.wins || 0
      } else {
        stats.farmerGames = r.total
        stats.farmerWins = r.wins || 0
      }
    })

    return stats
  },

  // 格式化用户数据（移除敏感信息）
  formatUser(user) {
    if (!user) return null
    const { password, ...rest } = user
    return {
      id: rest.id,
      account: rest.account,
      nickname: rest.nickname,
      avatar: rest.avatar,
      coins: rest.coins,
      level: rest.level,
      experience: rest.experience,
      totalGames: rest.total_games,
      wins: rest.wins,
      createdAt: rest.created_at,
    }
  },
}

module.exports = User
