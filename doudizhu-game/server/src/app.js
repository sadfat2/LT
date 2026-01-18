const express = require('express')
const { createServer } = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const config = require('./config')

// 初始化数据库连接
const db = require('./models/db')
const redis = require('./models/redis')

// 路由
const authRoutes = require('./routes/auth')
const userRoutes = require('./routes/user')
const coinsRoutes = require('./routes/coins')
const roomRoutes = require('./routes/room')

// Socket 处理
const initSocket = require('./socket')

const app = express()
const httpServer = createServer(app)

// 配置 Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

// 中间件
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API 路由
app.use('/api/auth', authRoutes)
app.use('/api/user', userRoutes)
app.use('/api/coins', coinsRoutes)
app.use('/api/rooms', roomRoutes)

// 错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err)
  res.status(err.status || 500).json({
    code: err.status || 500,
    message: err.message || '服务器内部错误',
  })
})

// 初始化 Socket.io
initSocket(io)

// 启动服务器
const startServer = async () => {
  try {
    // 测试数据库连接
    await db.query('SELECT 1')
    console.log('MySQL 连接成功')

    // 测试 Redis 连接
    await redis.ping()
    console.log('Redis 连接成功')

    httpServer.listen(config.port, () => {
      console.log(`斗地主服务器运行在端口 ${config.port}`)
    })
  } catch (error) {
    console.error('启动服务器失败:', error)
    process.exit(1)
  }
}

startServer()

// 优雅退出
process.on('SIGINT', async () => {
  console.log('\n正在关闭服务器...')
  await db.end()
  await redis.quit()
  process.exit(0)
})
