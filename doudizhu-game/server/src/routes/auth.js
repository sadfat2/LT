const express = require('express')
const router = express.Router()
const User = require('../models/User')
const { generateToken } = require('../middlewares/auth')
const config = require('../config')

// 注册
router.post('/register', async (req, res) => {
  try {
    const { account, password, nickname } = req.body

    if (!account || !password || !nickname) {
      return res.status(400).json({
        code: 400,
        message: '账号、密码和昵称不能为空',
      })
    }

    if (account.length < 4 || account.length > 20) {
      return res.status(400).json({
        code: 400,
        message: '账号长度需要在 4-20 个字符之间',
      })
    }

    if (password.length < 6) {
      return res.status(400).json({
        code: 400,
        message: '密码长度不能少于 6 个字符',
      })
    }

    // 检查账号是否已存在
    const existingUser = await User.findByAccount(account)
    if (existingUser) {
      return res.status(400).json({
        code: 400,
        message: '账号已存在',
      })
    }

    // 创建用户
    const user = await User.create({ account, password, nickname })
    const token = generateToken(user)

    res.json({
      code: 200,
      data: {
        token,
        user: User.formatUser(user),
      },
    })
  } catch (error) {
    console.error('注册失败:', error)
    res.status(500).json({
      code: 500,
      message: '注册失败',
    })
  }
})

// 登录
router.post('/login', async (req, res) => {
  try {
    const { account, password } = req.body

    if (!account || !password) {
      return res.status(400).json({
        code: 400,
        message: '账号和密码不能为空',
      })
    }

    // 查找用户
    const user = await User.findByAccount(account)
    if (!user) {
      return res.status(401).json({
        code: 401,
        message: '账号或密码错误',
      })
    }

    // 验证密码
    const isValid = await User.verifyPassword(password, user.password)
    if (!isValid) {
      return res.status(401).json({
        code: 401,
        message: '账号或密码错误',
      })
    }

    const token = generateToken(user)

    res.json({
      code: 200,
      data: {
        token,
        user: User.formatUser(user),
      },
    })
  } catch (error) {
    console.error('登录失败:', error)
    res.status(500).json({
      code: 500,
      message: '登录失败',
    })
  }
})

// 从聊天应用登录
router.post('/login-from-chat', async (req, res) => {
  try {
    const { chatToken } = req.body

    if (!chatToken) {
      return res.status(400).json({
        code: 400,
        message: 'chatToken 不能为空',
      })
    }

    // TODO: 调用聊天服务验证 token
    // 这里需要实现与聊天服务的集成
    // const chatUser = await verifyChatToken(chatToken)

    res.status(501).json({
      code: 501,
      message: '聊天服务集成开发中',
    })
  } catch (error) {
    console.error('从聊天应用登录失败:', error)
    res.status(500).json({
      code: 500,
      message: '登录失败',
    })
  }
})

module.exports = router
