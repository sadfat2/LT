const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * 管理员认证中间件
 * 验证请求头中的 admin JWT token
 */
const adminAuthMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        code: 401,
        message: '未提供管理员认证令牌'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.adminSecret);

    // 验证是否是管理员token
    if (!decoded.isAdmin) {
      return res.status(403).json({
        code: 403,
        message: '需要管理员权限'
      });
    }

    // 将管理员信息存储到请求对象
    req.admin = {
      id: decoded.id,
      username: decoded.username
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        code: 401,
        message: '令牌已过期，请重新登录'
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        code: 401,
        message: '无效的令牌'
      });
    }
    return res.status(500).json({
      code: 500,
      message: '认证失败'
    });
  }
};

module.exports = adminAuthMiddleware;
