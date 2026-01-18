const express = require('express')
const router = express.Router()
const User = require('../models/User')
const db = require('../models/db')
const { auth } = require('../middlewares/auth')

// 获取用户信息
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
    if (!user) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在',
      })
    }

    res.json({
      code: 200,
      data: {
        user: User.formatUser(user),
      },
    })
  } catch (error) {
    console.error('获取用户信息失败:', error)
    res.status(500).json({
      code: 500,
      message: '获取用户信息失败',
    })
  }
})

// 更新用户信息
router.put('/profile', auth, async (req, res) => {
  try {
    const { nickname } = req.body

    if (nickname && (nickname.length < 2 || nickname.length > 20)) {
      return res.status(400).json({
        code: 400,
        message: '昵称长度需要在 2-20 个字符之间',
      })
    }

    const user = await User.updateProfile(req.user.id, { nickname })
    if (!user) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在',
      })
    }

    res.json({
      code: 200,
      data: {
        user: User.formatUser(user),
      },
    })
  } catch (error) {
    console.error('更新用户信息失败:', error)
    res.status(500).json({
      code: 500,
      message: '更新用户信息失败',
    })
  }
})

// 获取战绩统计
router.get('/stats', auth, async (req, res) => {
  try {
    const stats = await User.getStats(req.user.id)
    if (!stats) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在',
      })
    }

    res.json({
      code: 200,
      data: stats,
    })
  } catch (error) {
    console.error('获取战绩统计失败:', error)
    res.status(500).json({
      code: 500,
      message: '获取战绩统计失败',
    })
  }
})

// 获取游戏记录
router.get('/records', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const offset = (page - 1) * limit

    const records = await db.query(
      `SELECT id, room_id, role, is_win, coin_change, multiplier, created_at
       FROM game_records WHERE user_id = ?
       ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      [req.user.id]
    )

    const [{ total }] = await db.query(
      'SELECT COUNT(*) as total FROM game_records WHERE user_id = ?',
      [req.user.id]
    )

    res.json({
      code: 200,
      data: {
        records: records.map((r) => ({
          id: r.id,
          roomId: r.room_id,
          role: r.role,
          isWin: !!r.is_win,
          coinChange: r.coin_change,
          multiplier: r.multiplier,
          createdAt: r.created_at,
        })),
        total,
      },
    })
  } catch (error) {
    console.error('获取游戏记录失败:', error)
    res.status(500).json({
      code: 500,
      message: '获取游戏记录失败',
    })
  }
})

module.exports = router
