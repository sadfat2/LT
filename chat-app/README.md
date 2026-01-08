# 聊天室应用

仿微信的实时聊天应用，支持文本、图片、语音消息。

## 技术栈

### 后端
- Node.js + Express
- Socket.io（实时通信）
- MySQL（数据存储）
- Redis（在线状态管理）
- JWT（用户认证）

### 前端
- UniApp + Vue3 + TypeScript
- Pinia（状态管理）
- Socket.io-client

## 快速开始

### 1. 启动后端服务

```bash
# 进入项目根目录
cd chat-app

# 启动 Docker 容器（MySQL + Redis + Node.js）
docker-compose up -d

# 查看日志
docker-compose logs -f server
```

### 2. 启动前端开发服务器

```bash
# 进入前端目录
cd client

# 安装依赖
npm install

# 启动 H5 开发服务器
npm run dev:h5
```

### 3. 访问应用

打开浏览器访问 http://localhost:8080

## 测试账号

| 账号 | 密码 | 说明 |
|------|------|------|
| testuser1 | password123 | 测试用户1 |
| testuser2 | password123 | 测试用户2 |
| testuser3 | password123 | 测试用户3 |

## 项目结构

```
chat-app/
├── client/                 # 前端 UniApp 项目
│   ├── src/
│   │   ├── api/           # API 接口
│   │   ├── components/    # 公共组件
│   │   ├── pages/         # 页面
│   │   ├── store/         # Pinia 状态管理
│   │   ├── types/         # TypeScript 类型定义
│   │   └── utils/         # 工具函数
│   └── ...
├── server/                 # 后端 Node.js 项目
│   ├── src/
│   │   ├── config/        # 配置文件
│   │   ├── controllers/   # 控制器
│   │   ├── middlewares/   # 中间件
│   │   ├── models/        # 数据模型
│   │   ├── routes/        # 路由
│   │   ├── services/      # 业务逻辑
│   │   ├── socket/        # Socket.io 处理
│   │   └── utils/         # 工具函数
│   ├── sql/               # SQL 脚本
│   ├── uploads/           # 上传文件目录
│   └── ...
└── docker-compose.yml      # Docker 编排文件
```

## 功能列表

- [x] 用户注册/登录
- [x] 个人信息管理（头像、昵称、签名）
- [x] 好友管理（添加、搜索、申请）
- [x] 消息会话列表
- [x] 实时聊天
- [x] 文本消息
- [x] 图片消息
- [x] 语音消息
- [x] 消息撤回
- [x] 消息已读状态
- [x] 正在输入提示

## 配置说明

### 后端环境变量

在 `docker-compose.yml` 中配置：

```yaml
environment:
  DB_HOST: mysql
  DB_PORT: 3306
  DB_USER: chat_user
  DB_PASSWORD: chat123456
  DB_NAME: chat_app
  REDIS_HOST: redis
  REDIS_PORT: 6379
  JWT_SECRET: your-super-secret-jwt-key
```

### 前端配置

在 `client/vite.config.ts` 中配置开发服务器代理：

```typescript
export default defineConfig({
  plugins: [uni()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true
      }
    }
  }
})
```

## 平台兼容性说明

### H5 平台限制
- 语音录制功能不支持（`uni.getRecorderManager` 仅支持 App/小程序）
- 点击语音切换按钮会提示"语音功能仅支持 App/小程序"
- 语音消息播放使用 HTML5 Audio API 作为回退方案
