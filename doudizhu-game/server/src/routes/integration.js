const express = require('express')
const jwt = require('jsonwebtoken')
const axios = require('axios')
const { v4: uuidv4 } = require('uuid')
const config = require('../config')
const redis = require('../models/redis')
const User = require('../models/User')

const router = express.Router()

/**
 * API Key 认证中间件
 * 用于验证来自聊天服务的请求
 */
function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key']

  if (!apiKey || apiKey !== config.chatService.apiKey) {
    return res.status(401).json({
      code: 401,
      message: 'API Key 无效',
    })
  }

  next()
}

/**
 * 创建游戏邀请
 * POST /api/integration/invite
 *
 * 请求体:
 * - chatUserId: 聊天应用用户ID
 * - chatToken: 聊天应用的 JWT token
 * - roomConfig: 房间配置（可选）
 *
 * 返回:
 * - inviteCode: 邀请码
 * - inviteUrl: 邀请链接
 * - expiresAt: 过期时间
 */
router.post('/invite', async (req, res) => {
  try {
    const { chatUserId, chatToken, roomConfig = {} } = req.body

    if (!chatUserId || !chatToken) {
      return res.status(400).json({
        code: 400,
        message: '缺少必要参数',
      })
    }

    // 验证聊天 token
    const verifyResult = await verifyChatToken(chatToken)
    if (!verifyResult.valid) {
      return res.status(401).json({
        code: 401,
        message: '聊天 token 无效',
      })
    }

    // 生成邀请码
    const inviteCode = uuidv4().substring(0, 8).toUpperCase()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10分钟过期

    // 存储邀请信息到 Redis
    const inviteData = {
      code: inviteCode,
      creatorId: chatUserId,
      creatorInfo: verifyResult.user,
      roomConfig: {
        baseScore: roomConfig.baseScore || 100,
        ...roomConfig,
      },
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    }

    await redis.setJSON(`game_invite:${inviteCode}`, inviteData, { EX: 600 })

    // 生成邀请链接
    const gameUrl = process.env.GAME_CLIENT_URL || 'http://localhost:8081'
    const inviteUrl = `${gameUrl}/#/join?code=${inviteCode}`

    res.json({
      code: 200,
      message: '邀请创建成功',
      data: {
        inviteCode,
        inviteUrl,
        expiresAt: expiresAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('创建邀请失败:', error)
    res.status(500).json({
      code: 500,
      message: '创建邀请失败',
    })
  }
})

/**
 * 通过邀请码加入游戏
 * GET /api/integration/join
 *
 * 查询参数:
 * - code: 邀请码
 * - chatToken: 聊天应用的 JWT token
 *
 * 返回:
 * - gameToken: 游戏服务的 JWT token
 * - user: 游戏用户信息
 * - invite: 邀请信息
 */
router.get('/join', async (req, res) => {
  try {
    const { code, chatToken } = req.query

    if (!code || !chatToken) {
      return res.status(400).json({
        code: 400,
        message: '缺少必要参数',
      })
    }

    // 获取邀请信息
    const inviteData = await redis.getJSON(`game_invite:${code}`)
    if (!inviteData) {
      return res.status(404).json({
        code: 404,
        message: '邀请码无效或已过期',
      })
    }

    // 验证聊天 token
    const verifyResult = await verifyChatToken(chatToken)
    if (!verifyResult.valid) {
      return res.status(401).json({
        code: 401,
        message: '聊天 token 无效',
      })
    }

    // 自动创建或获取游戏用户
    let gameUser = await User.findByChatUserId(verifyResult.user.id)
    if (!gameUser) {
      // 创建新的游戏用户
      const userId = await User.createFromChat(verifyResult.user)
      gameUser = await User.findById(userId)
    }

    // 生成游戏 token
    const gameToken = jwt.sign(
      { id: gameUser.id, account: gameUser.account },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    )

    res.json({
      code: 200,
      message: '加入成功',
      data: {
        gameToken,
        user: User.formatUser(gameUser),
        invite: {
          code: inviteData.code,
          creatorInfo: inviteData.creatorInfo,
          roomConfig: inviteData.roomConfig,
        },
      },
    })
  } catch (error) {
    console.error('加入游戏失败:', error)
    res.status(500).json({
      code: 500,
      message: '加入游戏失败',
    })
  }
})

/**
 * 验证聊天 token
 * POST /api/integration/verify-token
 *
 * 请求体:
 * - chatToken: 聊天应用的 JWT token
 *
 * 返回:
 * - valid: 是否有效
 * - user: 用户信息（如果有效）
 */
router.post('/verify-token', async (req, res) => {
  try {
    const { chatToken } = req.body

    if (!chatToken) {
      return res.status(400).json({
        code: 400,
        message: '缺少 token',
      })
    }

    const verifyResult = await verifyChatToken(chatToken)

    res.json({
      code: 200,
      data: verifyResult,
    })
  } catch (error) {
    console.error('验证 token 失败:', error)
    res.status(500).json({
      code: 500,
      message: '验证失败',
    })
  }
})

/**
 * 从聊天应用登录
 * POST /api/integration/login-from-chat
 *
 * 请求体:
 * - chatToken: 聊天应用的 JWT token
 *
 * 返回:
 * - token: 游戏服务的 JWT token
 * - user: 游戏用户信息
 */
router.post('/login-from-chat', async (req, res) => {
  try {
    const { chatToken } = req.body

    if (!chatToken) {
      return res.status(400).json({
        code: 400,
        message: '缺少 token',
      })
    }

    // 验证聊天 token
    const verifyResult = await verifyChatToken(chatToken)
    if (!verifyResult.valid) {
      return res.status(401).json({
        code: 401,
        message: '聊天 token 无效',
      })
    }

    // 自动创建或获取游戏用户
    let gameUser = await User.findByChatUserId(verifyResult.user.id)
    if (!gameUser) {
      // 创建新的游戏用户
      const userId = await User.createFromChat(verifyResult.user)
      gameUser = await User.findById(userId)
    } else {
      // 同步聊天应用的用户信息
      await User.syncFromChat(gameUser.id, verifyResult.user)
      gameUser = await User.findById(gameUser.id)
    }

    // 生成游戏 token
    const gameToken = jwt.sign(
      { id: gameUser.id, account: gameUser.account },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    )

    res.json({
      code: 200,
      message: '登录成功',
      data: {
        token: gameToken,
        user: User.formatUser(gameUser),
      },
    })
  } catch (error) {
    console.error('从聊天登录失败:', error)
    res.status(500).json({
      code: 500,
      message: '登录失败',
    })
  }
})

/**
 * 调用聊天服务验证 token
 */
async function verifyChatToken(chatToken) {
  try {
    const response = await axios.post(
      `${config.chatService.url}/api/integration/verify`,
      { token: chatToken },
      {
        headers: {
          'X-API-Key': config.chatService.apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      }
    )

    if (response.data.code === 200 && response.data.data.valid) {
      return {
        valid: true,
        user: response.data.data.user,
      }
    }

    return { valid: false }
  } catch (error) {
    console.error('调用聊天服务验证失败:', error.message)
    return { valid: false }
  }
}

// 导出 API Key 中间件供其他模块使用
router.apiKeyAuth = apiKeyAuth

module.exports = router
