const express = require('express')
const router = express.Router()
const redis = require('../models/redis')
const { auth } = require('../middlewares/auth')
const { v4: uuidv4 } = require('uuid')

// 获取房间列表
router.get('/', auth, async (req, res) => {
  try {
    // 从 Redis 获取所有房间
    const roomKeys = await redis.getClient().keys('room:*')
    const rooms = []

    for (const key of roomKeys) {
      const roomData = await redis.getJSON(key)
      if (roomData && roomData.status === 'waiting') {
        rooms.push(roomData)
      }
    }

    res.json({
      code: 200,
      data: { rooms },
    })
  } catch (error) {
    console.error('获取房间列表失败:', error)
    res.status(500).json({
      code: 500,
      message: '获取房间列表失败',
    })
  }
})

// 创建房间
router.post('/', auth, async (req, res) => {
  try {
    const { name, baseScore = 100 } = req.body
    const userId = req.user.id

    if (!name) {
      return res.status(400).json({
        code: 400,
        message: '房间名称不能为空',
      })
    }

    // 检查用户是否已在房间中
    const userRoomId = await redis.get(`user_room:${userId}`)
    if (userRoomId) {
      return res.status(400).json({
        code: 400,
        message: '您已在房间中',
      })
    }

    const roomId = uuidv4()
    const room = {
      id: roomId,
      name,
      baseScore,
      players: [],
      maxPlayers: 3,
      status: 'waiting',
      ownerId: userId,
      createdAt: new Date().toISOString(),
    }

    // 保存房间到 Redis
    await redis.setJSON(`room:${roomId}`, room, { EX: 3600 }) // 1小时过期

    res.json({
      code: 200,
      data: { room },
    })
  } catch (error) {
    console.error('创建房间失败:', error)
    res.status(500).json({
      code: 500,
      message: '创建房间失败',
    })
  }
})

// 获取房间详情
router.get('/:id', auth, async (req, res) => {
  try {
    const room = await redis.getJSON(`room:${req.params.id}`)

    if (!room) {
      return res.status(404).json({
        code: 404,
        message: '房间不存在',
      })
    }

    res.json({
      code: 200,
      data: { room },
    })
  } catch (error) {
    console.error('获取房间详情失败:', error)
    res.status(500).json({
      code: 500,
      message: '获取房间详情失败',
    })
  }
})

// 获取当前用户所在房间
router.get('/user/current', auth, async (req, res) => {
  try {
    const roomId = await redis.get(`user_room:${req.user.id}`)

    if (!roomId) {
      return res.json({
        code: 200,
        data: { room: null },
      })
    }

    const room = await redis.getJSON(`room:${roomId}`)
    res.json({
      code: 200,
      data: { room },
    })
  } catch (error) {
    console.error('获取当前房间失败:', error)
    res.status(500).json({
      code: 500,
      message: '获取当前房间失败',
    })
  }
})

module.exports = router
