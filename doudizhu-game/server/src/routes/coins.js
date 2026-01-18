const express = require('express')
const router = express.Router()
const db = require('../models/db')
const User = require('../models/User')
const { auth } = require('../middlewares/auth')
const config = require('../config')

// 签到
router.post('/checkin', auth, async (req, res) => {
  try {
    const userId = req.user.id
    const today = new Date().toISOString().split('T')[0]

    // 检查今日是否已签到
    const existingCheckin = await db.findOne(
      'SELECT id FROM daily_checkins WHERE user_id = ? AND DATE(checkin_date) = ?',
      [userId, today]
    )

    if (existingCheckin) {
      return res.status(400).json({
        code: 400,
        message: '今日已签到',
      })
    }

    // 计算连续签到天数
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const yesterdayCheckin = await db.findOne(
      'SELECT consecutive_days FROM daily_checkins WHERE user_id = ? AND DATE(checkin_date) = ?',
      [userId, yesterday]
    )

    const consecutiveDays = yesterdayCheckin ? yesterdayCheckin.consecutive_days + 1 : 1

    // 计算奖励（按连续天数，最多7天循环）
    const rewardIndex = Math.min(consecutiveDays - 1, config.game.checkinRewards.length - 1)
    const reward = config.game.checkinRewards[rewardIndex]

    // 记录签到
    await db.insert(
      'INSERT INTO daily_checkins (user_id, checkin_date, consecutive_days, reward) VALUES (?, ?, ?, ?)',
      [userId, today, consecutiveDays, reward]
    )

    // 更新金币
    const user = await User.updateCoins(userId, reward)

    // 记录交易
    await db.insert(
      'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
      [userId, 'checkin', reward, `连续签到第${consecutiveDays}天`]
    )

    res.json({
      code: 200,
      data: {
        coins: user.coins,
        reward,
        consecutiveDays,
      },
    })
  } catch (error) {
    console.error('签到失败:', error)
    res.status(500).json({
      code: 500,
      message: '签到失败',
    })
  }
})

// 获取签到状态
router.get('/checkin-status', auth, async (req, res) => {
  try {
    const userId = req.user.id
    const today = new Date().toISOString().split('T')[0]

    // 检查今日签到
    const todayCheckin = await db.findOne(
      'SELECT consecutive_days, reward FROM daily_checkins WHERE user_id = ? AND DATE(checkin_date) = ?',
      [userId, today]
    )

    if (todayCheckin) {
      res.json({
        code: 200,
        data: {
          hasCheckedIn: true,
          consecutiveDays: todayCheckin.consecutive_days,
          todayReward: todayCheckin.reward,
        },
      })
    } else {
      // 计算今日可获得奖励
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      const yesterdayCheckin = await db.findOne(
        'SELECT consecutive_days FROM daily_checkins WHERE user_id = ? AND DATE(checkin_date) = ?',
        [userId, yesterday]
      )

      const consecutiveDays = yesterdayCheckin ? yesterdayCheckin.consecutive_days + 1 : 1
      const rewardIndex = Math.min(consecutiveDays - 1, config.game.checkinRewards.length - 1)
      const todayReward = config.game.checkinRewards[rewardIndex]

      res.json({
        code: 200,
        data: {
          hasCheckedIn: false,
          consecutiveDays: yesterdayCheckin ? yesterdayCheckin.consecutive_days : 0,
          todayReward,
        },
      })
    }
  } catch (error) {
    console.error('获取签到状态失败:', error)
    res.status(500).json({
      code: 500,
      message: '获取签到状态失败',
    })
  }
})

// 领取破产补助
router.post('/bankrupt-aid', auth, async (req, res) => {
  try {
    const userId = req.user.id
    const today = new Date().toISOString().split('T')[0]

    // 获取用户金币
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在',
      })
    }

    // 检查是否达到破产线
    if (user.coins >= config.game.bankruptLine) {
      return res.status(400).json({
        code: 400,
        message: `金币需低于 ${config.game.bankruptLine} 才能领取破产补助`,
      })
    }

    // 检查今日领取次数
    const [{ count }] = await db.query(
      'SELECT COUNT(*) as count FROM bankrupt_aids WHERE user_id = ? AND DATE(created_at) = ?',
      [userId, today]
    )

    if (count >= config.game.dailyBankruptAidLimit) {
      return res.status(400).json({
        code: 400,
        message: `今日已领取 ${config.game.dailyBankruptAidLimit} 次破产补助`,
      })
    }

    const aidAmount = config.game.bankruptAidAmount

    // 记录破产补助
    await db.insert(
      'INSERT INTO bankrupt_aids (user_id, amount) VALUES (?, ?)',
      [userId, aidAmount]
    )

    // 更新金币
    const updatedUser = await User.updateCoins(userId, aidAmount)

    // 记录交易
    await db.insert(
      'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
      [userId, 'bankrupt_aid', aidAmount, `破产补助（今日第${count + 1}次）`]
    )

    res.json({
      code: 200,
      data: {
        coins: updatedUser.coins,
        aidAmount,
      },
    })
  } catch (error) {
    console.error('领取破产补助失败:', error)
    res.status(500).json({
      code: 500,
      message: '领取破产补助失败',
    })
  }
})

// 获取交易记录
router.get('/transactions', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const offset = (page - 1) * limit

    const transactions = await db.query(
      `SELECT id, type, amount, description, created_at
       FROM transactions WHERE user_id = ?
       ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      [req.user.id]
    )

    const [{ total }] = await db.query(
      'SELECT COUNT(*) as total FROM transactions WHERE user_id = ?',
      [req.user.id]
    )

    res.json({
      code: 200,
      data: {
        transactions: transactions.map((t) => ({
          id: t.id,
          type: t.type,
          amount: t.amount,
          description: t.description,
          createdAt: t.created_at,
        })),
        total,
      },
    })
  } catch (error) {
    console.error('获取交易记录失败:', error)
    res.status(500).json({
      code: 500,
      message: '获取交易记录失败',
    })
  }
})

module.exports = router
