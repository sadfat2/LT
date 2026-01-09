# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

仿微信的实时聊天应用，支持文本、图片、语音消息。采用 UniApp (Vue3 + TypeScript) + Node.js + Socket.io + MySQL + Redis 架构。

## 常用命令

### 后端服务 (Docker)

```bash
cd chat-app

# 启动所有服务
docker-compose up -d

# 查看后端日志
docker-compose logs -f server

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

npm install
npm run dev:h5          # H5 开发模式 (端口 8080)
npm run dev:mp-weixin   # 微信小程序开发
npm run build:h5        # 构建 H5
```

## 架构设计

```
客户端 (UniApp)
    ├── HTTP --> REST API (Express :3000)
    └── WebSocket --> Socket.io Server
                          ├── MySQL (持久化)
                          └── Redis (在线状态)
```

### 关键文件路径

| 模块 | 路径 |
|------|------|
| 前端 API 封装 | `chat-app/client/src/api/index.ts` |
| 前端类型定义 | `chat-app/client/src/types/index.ts` |
| Pinia Stores | `chat-app/client/src/store/` |
| 后端入口 | `chat-app/server/src/app.js` |
| Socket 事件处理 | `chat-app/server/src/socket/index.js` |
| 数据库模型 | `chat-app/server/src/models/` |
| 路由定义 | `chat-app/server/src/routes/` |
| 数据库初始化 | `chat-app/server/sql/init.sql` |

### Pinia Stores 职责

- `user.ts` - 用户认证、登录/登出、个人信息
- `socket.ts` - Socket.io 连接管理、实时消息收发
- `conversation.ts` - 会话列表、消息记录
- `friend.ts` - 好友列表、好友申请、好友备注管理

## Socket.io 事件协议

### 客户端 → 服务端

| 事件 | 数据格式 |
|------|----------|
| `send_message` | `{ receiverId, type, content, duration? }` |
| `message_read` | `{ conversationId, messageIds }` |
| `revoke_message` | `{ messageId }` |
| `typing` | `{ receiverId }` |

### 服务端 → 客户端

| 事件 | 数据格式 |
|------|----------|
| `new_message` | `{ message }` |
| `message_sent` | `{ messageId, status }` |
| `message_read_ack` | `{ messageIds }` |
| `message_revoked` | `{ messageId }` |
| `user_online` / `user_offline` | `{ userId }` |
| `user_typing` | `{ userId }` |
| `friend_request` | `{ request }` |

## REST API 端点

### 认证
- `POST /api/auth/register` - 注册
- `POST /api/auth/login` - 登录

### 用户
- `GET /api/user/profile` - 获取当前用户信息
- `PUT /api/user/profile` - 更新用户信息
- `GET /api/user/search?keyword=` - 搜索用户

### 好友
- `GET /api/friends` - 好友列表（含备注）
- `POST /api/friends/request` - 发送好友申请
- `GET /api/friends/requests` - 好友申请列表
- `POST /api/friends/accept/:id` - 同意申请
- `POST /api/friends/reject/:id` - 拒绝申请
- `PUT /api/friends/:friendId/remark` - 更新备注

### 会话
- `GET /api/conversations` - 会话列表
- `POST /api/conversations/private` - 创建私聊会话
- `GET /api/conversations/:id/messages` - 获取会话消息

### 上传
- `POST /api/upload/image` - 上传图片
- `POST /api/upload/voice` - 上传语音
- `POST /api/user/avatar` - 上传头像

## 数据库表结构

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| `users` | 用户信息 | account, nickname, avatar, signature, pinyin |
| `friendships` | 好友关系（双向存储） | user_id, friend_id, remark |
| `friend_requests` | 好友申请 | from_user_id, to_user_id, status(0待处理/1同意/2拒绝), message |
| `conversations` | 会话记录 | user_id, target_id, last_message_id, unread_count |
| `conversation_participants` | 会话参与者 | conversation_id, user_id |
| `messages` | 消息记录 | type(text/image/voice), content, status, is_revoked, duration |

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

- H5 平台不支持语音录制（`uni.getRecorderManager` 仅支持 App/小程序）
- 语音消息播放使用 HTML5 Audio API 作为回退方案

## 调试技巧

```bash
# 查看 Redis 中的在线用户
docker exec -it chat-redis redis-cli KEYS "online:*"

# 查看数据库中的消息
docker exec -it chat-mysql mysql -uroot -proot123456 chat_app -e "SELECT * FROM messages ORDER BY id DESC LIMIT 10;"

# 实时监控后端日志
docker-compose logs -f server 2>&1 | grep -E "(Socket|message|error)"
```
