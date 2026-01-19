const express = require('express')
const jwt = require('jsonwebtoken')
const config = require('../config')
const User = require('../models/User')
const Message = require('../models/Message')
const Conversation = require('../models/Conversation')

const router = express.Router()

// 游戏服务 API Key（从环境变量获取）
const GAME_API_KEY = process.env.GAME_API_KEY || 'doudizhu_integration_key_2024'

/**
 * API Key 认证中间件
 * 用于验证来自游戏服务的请求
 */
function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key']

  if (!apiKey || apiKey !== GAME_API_KEY) {
    return res.status(401).json({
      code: 401,
      message: 'API Key 无效',
    })
  }

  next()
}

/**
 * 验证用户 token
 * POST /api/integration/verify
 *
 * 请求体:
 * - token: 用户的 JWT token
 *
 * 返回:
 * - valid: 是否有效
 * - user: 用户信息（如果有效）
 */
router.post('/verify', apiKeyAuth, async (req, res) => {
  try {
    const { token } = req.body

    if (!token) {
      return res.json({
        code: 200,
        data: { valid: false, message: '缺少 token' },
      })
    }

    // 验证 token
    let decoded
    try {
      decoded = jwt.verify(token, config.jwt.secret)
    } catch (err) {
      return res.json({
        code: 200,
        data: { valid: false, message: 'token 无效或已过期' },
      })
    }

    // 获取用户信息
    const user = await User.findById(decoded.id)
    if (!user) {
      return res.json({
        code: 200,
        data: { valid: false, message: '用户不存在' },
      })
    }

    // 检查用户状态
    if (user.status === 'banned') {
      return res.json({
        code: 200,
        data: { valid: false, message: '用户已被封禁' },
      })
    }

    res.json({
      code: 200,
      data: {
        valid: true,
        user: {
          id: user.id,
          account: user.account,
          nickname: user.nickname,
          avatar: user.avatar,
        },
      },
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
 * 接收游戏结果
 * POST /api/integration/game-result
 *
 * 请求体:
 * - gameId: 游戏ID
 * - roomId: 房间ID
 * - players: 玩家列表 [{ chatUserId, nickname, role, isWin, coinChange }]
 * - multiplier: 倍数
 * - baseScore: 底分
 * - createdAt: 游戏结束时间
 *
 * 此接口会向所有参与游戏的玩家的私聊会话发送游戏结果卡片
 */
router.post('/game-result', apiKeyAuth, async (req, res) => {
  try {
    const { gameId, roomId, players, multiplier, baseScore, createdAt } = req.body

    if (!gameId || !players || !Array.isArray(players) || players.length === 0) {
      return res.status(400).json({
        code: 400,
        message: '缺少必要参数',
      })
    }

    // 找出地主和农民
    const landlord = players.find((p) => p.role === 'landlord')
    const farmers = players.filter((p) => p.role === 'farmer')

    // 构建游戏结果消息内容
    const resultText = buildGameResultText(landlord, farmers, multiplier, baseScore)

    // 向每对玩家的私聊会话发送游戏结果
    const sentPairs = new Set()

    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const player1 = players[i]
        const player2 = players[j]

        // 跳过没有聊天用户ID的玩家
        if (!player1.chatUserId || !player2.chatUserId) continue

        const pairKey = [player1.chatUserId, player2.chatUserId].sort().join('-')
        if (sentPairs.has(pairKey)) continue
        sentPairs.add(pairKey)

        try {
          // 获取或创建私聊会话
          const conversation = await Conversation.getOrCreatePrivate(
            player1.chatUserId,
            player2.chatUserId
          )

          if (conversation) {
            // 发送系统消息
            await Message.create({
              conversationId: conversation.id,
              senderId: player1.chatUserId, // 用第一个玩家作为发送者
              type: 'system',
              content: resultText,
            })
          }
        } catch (err) {
          console.error(`发送游戏结果到会话失败 (${player1.chatUserId}-${player2.chatUserId}):`, err)
        }
      }
    }

    res.json({
      code: 200,
      message: '游戏结果已发送',
    })
  } catch (error) {
    console.error('处理游戏结果失败:', error)
    res.status(500).json({
      code: 500,
      message: '处理游戏结果失败',
    })
  }
})

/**
 * 构建游戏结果文本
 */
function buildGameResultText(landlord, farmers, multiplier, baseScore) {
  const landlordResult = landlord.isWin ? '胜利' : '失败'
  const coinSign = landlord.coinChange >= 0 ? '+' : ''

  let text = `🎮 斗地主游戏结束\n`
  text += `━━━━━━━━━━━━━\n`
  text += `👑 地主: ${landlord.nickname}\n`
  text += `   结果: ${landlordResult} ${coinSign}${landlord.coinChange} 金币\n`
  text += `━━━━━━━━━━━━━\n`
  text += `👨‍🌾 农民:\n`

  farmers.forEach((farmer) => {
    const farmerResult = farmer.isWin ? '胜利' : '失败'
    const farmerCoinSign = farmer.coinChange >= 0 ? '+' : ''
    text += `   ${farmer.nickname}: ${farmerResult} ${farmerCoinSign}${farmer.coinChange} 金币\n`
  })

  text += `━━━━━━━━━━━━━\n`
  text += `底分: ${baseScore} | 倍数: ${multiplier}x`

  return text
}

module.exports = router
