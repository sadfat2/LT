# 斗地主游戏

基于 Vue 3 + Phaser 3 + Node.js + Socket.io 的在线斗地主游戏。

## 技术栈

### 前端
- Vue 3 + TypeScript
- Vite 构建工具
- Pinia 状态管理
- Vue Router 路由
- Socket.io-client 实时通信
- Phaser 3 游戏引擎
- SCSS 样式

### 后端
- Node.js + Express
- Socket.io 实时通信
- MySQL 数据持久化
- Redis 缓存与状态管理
- JWT 身份认证

## 项目结构

```
doudizhu-game/
├── client/          # 前端项目
│   ├── src/
│   │   ├── api/         # API 封装
│   │   ├── assets/      # 静态资源
│   │   ├── components/  # Vue 组件
│   │   ├── game/        # 游戏逻辑
│   │   ├── pages/       # 页面组件
│   │   ├── phaser/      # Phaser 游戏引擎
│   │   ├── router/      # 路由配置
│   │   ├── store/       # Pinia 状态管理
│   │   ├── styles/      # 全局样式
│   │   └── types/       # TypeScript 类型
│   └── public/          # 公共资源
├── server/          # 后端项目
│   ├── src/
│   │   ├── config/      # 配置文件
│   │   ├── game/        # 游戏引擎
│   │   ├── middlewares/ # 中间件
│   │   ├── models/      # 数据模型
│   │   ├── routes/      # API 路由
│   │   └── socket/      # Socket 事件处理
│   └── sql/             # 数据库脚本
└── docker-compose.yml   # Docker 配置
```

## 服务端口

| 服务 | 端口 |
|------|------|
| 前端开发服务器 | 8081 |
| 后端 API | 4000 |
| MySQL | 3307 |
| Redis | 6380 |

## 快速开始

### 启动后端服务

```bash
docker-compose up -d
```

### 启动前端开发服务器

```bash
cd client
npm install
npm run dev
```

## 游戏功能

- 用户注册/登录
- 从聊天应用跳转登录
- 金币积分系统（签到、破产补助）
- 快速匹配/创建房间
- 经典斗地主玩法
- 游戏内表情/快捷消息
- 断线重连
- 个人战绩统计
