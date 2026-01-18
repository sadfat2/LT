const jwt = require('jsonwebtoken')
const config = require('../config')

// JWT 认证中间件
const auth = (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      code: 401,
      message: '未提供认证令牌',
    })
  }

  const token = authHeader.slice(7)

  try {
    const decoded = jwt.verify(token, config.jwt.secret)
    req.user = decoded
    next()
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        code: 401,
        message: '令牌已过期',
      })
    }

    return res.status(401).json({
      code: 401,
      message: '无效的令牌',
    })
  }
}

// 生成 JWT
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      account: user.account,
      nickname: user.nickname,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  )
}

// 验证 JWT（用于 Socket.io）
const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret)
  } catch (error) {
    return null
  }
}

module.exports = {
  auth,
  generateToken,
  verifyToken,
}
