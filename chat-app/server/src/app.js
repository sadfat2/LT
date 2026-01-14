const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const cors = require('cors');
const path = require('path');

const config = require('./config');
const { initSocket } = require('./socket');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const friendRoutes = require('./routes/friend');
const conversationRoutes = require('./routes/conversation');
const uploadRoutes = require('./routes/upload');
const groupRoutes = require('./routes/group');
const webrtcRoutes = require('./routes/webrtc');
const adminRoutes = require('./routes/admin');
const referralRoutes = require('./routes/referral');
const configRoutes = require('./routes/config');
const { errorHandler } = require('./middlewares/errorHandler');

const app = express();

// 检查是否有 SSL 证书（用于局域网 HTTPS 访问）
const certPath = path.join(__dirname, '..');
const keyPath = path.join(certPath, 'key.pem');
const certFilePath = path.join(certPath, 'cert.pem');
const hasCert = fs.existsSync(keyPath) && fs.existsSync(certFilePath);

let server;
let httpsServer;

if (hasCert) {
  // 同时启动 HTTP 和 HTTPS 服务器
  server = http.createServer(app);
  httpsServer = https.createServer({
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certFilePath)
  }, app);
  console.log('已加载 SSL 证书，将启动 HTTPS 服务');
} else {
  // 只启动 HTTP 服务器
  server = http.createServer(app);
}

// 中间件
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/webrtc', webrtcRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/config', configRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 错误处理
app.use(errorHandler);

// 初始化 Socket.io（只在 HTTP 服务器上）
// 所有客户端都通过 Vite 代理连接到 HTTP 3000，确保使用同一个 Socket.io 实例
initSocket(server);

// 启动服务器
const PORT = config.port || 3000;
const HTTPS_PORT = 3443;

server.listen(PORT, () => {
  console.log(`HTTP 服务器运行在端口 ${PORT}`);
});

if (httpsServer) {
  httpsServer.listen(HTTPS_PORT, () => {
    console.log(`HTTPS 服务器运行在端口 ${HTTPS_PORT}`);
  });
}

module.exports = { app, server, httpsServer };
