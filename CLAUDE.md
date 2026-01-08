# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

仿微信的实时聊天应用，支持文本、图片、语音消息。

## 常用命令

### 后端服务 (Docker)

```bash
# 进入项目目录
cd chat-app

# 启动所有服务 (MySQL + Redis + Node.js)
docker-compose up -d

# 查看后端日志
docker-compose logs -f server

# 停止所有服务
docker-compose down

# 重建服务（依赖变更后）
docker-compose up -d --build server

# 进入 MySQL 调试
docker exec -it chat-mysql mysql -uroot -proot123456 chat_app

# 进入 Redis 调试
docker exec -it chat-redis redis-cli
```

### 前端开发 (UniApp)

```bash
cd chat-app/client

# 安装依赖
npm install

# H5 开发模式
npm run dev:h5

# 微信小程序开发
npm run dev:mp-weixin

# 构建 H5
npm run build:h5
```

## 架构设计

### 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | UniApp (Vue3 + TypeScript) + Pinia |
| 后端 | Node.js + Express |
| 实时通信 | Socket.io |
| 数据库 | MySQL 8.0 |
| 缓存 | Redis 7 |
| 认证 | JWT |

### 核心架构

```
客户端 (UniApp)
    ├── HTTP --> REST API (Express)
    └── WebSocket --> Socket.io Server
                          ├── MySQL (持久化)
                          └── Redis (在线状态)
```

### 前端状态管理 (Pinia Stores)

- `user.ts` - 用户认证、登录/登出、个人信息
- `socket.ts` - Socket.io 连接管理、实时消息收发
- `conversation.ts` - 会话列表、消息记录
- `friend.ts` - 好友列表、好友申请

### 后端模块划分

- `routes/` - API 路由定义
- `models/` - 数据库模型 (MySQL)
- `socket/index.js` - Socket.io 事件处理中心
- `middlewares/` - JWT 认证、错误处理
- `config/` - 数据库、Redis、应用配置

### Socket.io 事件协议

**客户端 → 服务端:**
- `send_message` - 发送消息 (文本/图片/语音)
- `message_read` - 标记消息已读
- `revoke_message` - 撤回消息
- `typing` - 正在输入状态

**服务端 → 客户端:**
- `new_message` - 收到新消息
- `message_read_ack` - 消息已读确认
- `message_revoked` - 消息被撤回
- `user_online/user_offline` - 好友在线状态
- `user_typing` - 对方正在输入

### 数据库表结构

- `users` - 用户信息
- `friendships` - 好友关系（双向存储）
- `friend_requests` - 好友申请
- `conversations` - 会话记录
- `messages` - 消息记录

## 服务端口

| 服务 | 端口 |
|------|------|
| Node.js 后端 | 3000 |
| 前端 H5 开发 | 8080 |
| MySQL | 3306 |
| Redis | 6379 |

## 测试账号

| 账号 | 密码 |
|------|------|
| testuser1 | password123 |
| testuser2 | password123 |
| testuser3 | password123 |

## 平台限制

H5 平台不支持语音录制功能 (`uni.getRecorderManager` 仅支持 App/小程序)，语音消息播放使用 HTML5 Audio API 作为回退方案。
