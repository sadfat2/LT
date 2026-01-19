# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

仿微信的实时聊天应用，支持文本、图片、语音、文件、视频消息，以及群聊和语音通话功能。采用 UniApp (Vue3 + TypeScript) + Node.js + Socket.io + MySQL + Redis 架构，语音通话基于 WebRTC P2P 实现。

## 常用命令

### 后端服务 (Docker)

```bash
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
cd client
npm install
npm run dev:h5          # H5 开发模式 (端口 8080)
npm run dev:mp-weixin   # 微信小程序开发
npm run build:h5        # 构建 H5
```

### 后台管理系统

```bash
cd admin
npm install
npm run dev             # 开发模式 (端口 8081)
npm run build           # 构建生产版本
```

### 数据库迁移

```bash
# 执行迁移脚本（保留数据）
docker exec -i chat-mysql mysql -uroot -proot123456 chat_app < server/sql/migrate_v2.sql
docker exec -i chat-mysql mysql -uroot -proot123456 chat_app < server/sql/migrate_admin.sql
docker exec -i chat-mysql mysql -uroot -proot123456 chat_app < server/sql/migrate_performance.sql

# 重建数据库（清除所有数据）
docker-compose down -v && docker-compose up -d
```

## 服务端口

| 服务 | 端口 |
|------|------|
| Node.js 后端 | 3000 |
| 前端 H5 开发 | 8080 |
| 后台管理前端 | 8081 |
| MySQL | 3306 |
| Redis | 6379 |

## 架构设计

```
客户端 (UniApp)                      后台管理 (Vue3 + Element Plus)
    ├── HTTP --> REST API (Express :3000) <── HTTP
    └── WebSocket --> Socket.io Server
                          ├── MySQL (持久化)
                          └── Redis (在线状态/缓存)
```

### 关键文件路径

| 模块 | 路径 |
|------|------|
| 前端 API 封装 | `client/src/api/index.ts` |
| 前端类型定义 | `client/src/types/index.ts` |
| Pinia Stores | `client/src/store/` |
| H5 录音工具 | `client/src/utils/h5Recorder.ts` |
| WebRTC 封装 | `client/src/utils/webrtc.ts` |
| 通话组件 | `client/src/components/call/` |
| 聊天页面 | `client/src/pages/chat/index.vue` |
| 群聊页面 | `client/src/pages/group/` |
| 后端入口 | `server/src/app.js` |
| Socket 事件处理 | `server/src/socket/index.js` |
| 通话信令处理 | `server/src/socket/call.js` |
| WebRTC TURN 代理 | `server/src/routes/webrtc.js` |
| 数据库模型 | `server/src/models/` |
| 路由定义 | `server/src/routes/` |
| 数据库初始化 | `server/sql/init.sql` |
| Redis 缓存工具 | `server/src/config/cache.js` |
| 后台管理前端 | `admin/` |
| 后台管理 API | `server/src/routes/admin/` |

### Pinia Stores 职责

- `user.ts` - 用户认证、登录/登出、个人信息
- `socket.ts` - Socket.io 连接管理、实时消息收发
- `conversation.ts` - 会话列表、消息记录
- `friend.ts` - 好友列表、好友申请、好友备注管理
- `group.ts` - 群组管理、群成员、群消息
- `call.ts` - 语音通话状态管理、WebRTC 信令处理、操作防抖

## Socket.io 事件协议

### 消息事件

| 事件 | 方向 | 数据格式 |
|------|------|----------|
| `send_message` | C→S | `{ conversationId?, receiverId?, type, content, mediaUrl?, duration?, fileName?, fileSize? }` |
| `new_message` | S→C | `{ message }` |
| `message_sent` | S→C | `{ messageId, status }` |
| `message_read` | C→S | `{ conversationId, messageIds }` |
| `message_read_ack` | S→C | `{ messageIds }` |
| `revoke_message` | C→S | `{ messageId }` |
| `message_revoked` | S→C | `{ messageId }` |
| `typing` | C→S | `{ receiverId }` |
| `user_typing` | S→C | `{ userId }` |
| `user_online` / `user_offline` | S→C | `{ userId }` |
| `friend_request` | S→C | `{ request }` |
| `force_logout` | S→C | `{ reason, message }` |

**消息类型 (type):** `text` | `image` | `voice` | `file` | `video` | `system`

### 语音通话事件

**呼叫信令：**

| 事件 | 方向 | 数据格式 |
|------|------|----------|
| `call:request` | C→S | `{ targetUserId }` |
| `call:incoming` | S→C | `{ callId, callerId, callerInfo }` |
| `call:accept` | C→S | `{ callId }` |
| `call:accepted` | S→C | `{ callId, receiverInfo }` |
| `call:reject` | C→S | `{ callId, reason? }` |
| `call:rejected` | S→C | `{ callId, reason }` |
| `call:cancel` | C→S | `{ callId }` |
| `call:cancelled` | S→C | `{ callId }` |
| `call:end` | C→S | `{ callId }` |
| `call:ended` | S→C | `{ callId, duration, endedBy, reason? }` |
| `call:timeout` | S→C | `{ callId }` |

**WebRTC 信令：**

| 事件 | 数据格式 |
|------|----------|
| `webrtc:offer` | `{ callId, sdp }` |
| `webrtc:answer` | `{ callId, sdp }` |
| `webrtc:ice` | `{ callId, candidate }` |

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
- `GET /api/conversations/search/all?keyword=` - 综合搜索
- `GET /api/conversations/:id/messages` - 获取会话消息

### 群聊
- `POST /api/groups` - 创建群聊 `{ name, memberIds[] }`
- `GET /api/groups` - 获取群列表
- `GET /api/groups/:id` - 获取群详情（含成员列表）
- `PUT /api/groups/:id` - 更新群信息
- `POST /api/groups/:id/invite` - 邀请成员
- `POST /api/groups/:id/leave` - 退出群聊
- `DELETE /api/groups/:id/members/:userId` - 移除成员（仅群主）
- `DELETE /api/groups/:id` - 解散群聊（仅群主）

### 上传
- `POST /api/upload/avatar` - 上传头像 (5MB)
- `POST /api/upload/image` - 上传图片
- `POST /api/upload/voice` - 上传语音 (5MB)
- `POST /api/upload/file` - 上传文件 (20MB)
- `POST /api/upload/video` - 上传视频 (50MB)

### WebRTC
- `GET /api/webrtc/turn-credentials` - 获取 TURN 服务器凭据

### 后台管理 API

- `POST /api/admin/auth/login` - 管理员登录
- `GET /api/admin/users` - 用户列表
- `POST /api/admin/users/:id/ban` - 封停用户
- `POST /api/admin/users/:id/unban` - 解封用户
- `GET /api/admin/referrals` - 推荐链接列表
- `POST /api/admin/referrals` - 创建推荐链接
- `GET /api/admin/statistics/overview` - 概览统计
- `GET /api/admin/statistics/trends` - 趋势数据

## 数据库表结构

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| `users` | 用户信息 | account, nickname, avatar, status(active/banned) |
| `friendships` | 好友关系（双向存储） | user_id, friend_id, remark |
| `friend_requests` | 好友申请 | from_user_id, to_user_id, status(0/1/2) |
| `conversations` | 会话记录 | type(private/group), group_id |
| `conversation_participants` | 会话参与者 | conversation_id, user_id, unread_count |
| `messages` | 消息记录 | type, content, status, duration |
| `groups` | 群组信息 | name, avatar, owner_id |
| `group_members` | 群成员 | group_id, user_id, role(owner/member) |
| `admins` | 管理员 | username, password, nickname |
| `referral_links` | 推荐链接 | user_id, code, is_active |

## 平台差异

### H5 平台
- 语音录制使用 MediaRecorder API (`client/src/utils/h5Recorder.ts`)
- 语音播放使用 Web Audio API（AudioContext，避免与 MediaRecorder 冲突）
- 文件选择使用 `<input type="file">`
- 视频预览通过 `window.open()` 新窗口打开

### App/小程序平台
- 语音录制使用 `uni.getRecorderManager()`
- 语音播放使用 `uni.createInnerAudioContext()`
- 文件选择使用 `uni.chooseMessageFile()`
- 视频预览使用 `uni.previewMedia()`

### 条件编译
使用 `#ifdef H5` / `#ifndef H5` 区分平台代码

## 语音通话

### 技术架构

```
用户A              Socket.io 服务器              用户B
  |                      |                        |
  |--- call:request ---->|                        |
  |                      |--- call:incoming ----->|
  |                      |<---- call:accept ------|
  |<--- call:accepted ---|                        |
  |--- webrtc:offer ---->|--- webrtc:offer ------>|
  |<--- webrtc:answer ---|<--- webrtc:answer -----|
  |<==== webrtc:ice ====>|<==== webrtc:ice =====>|
  |                      |                        |
  |========== WebRTC P2P 音频流（直连）==========|
```

### 关键实现

**前端状态管理** (`client/src/store/call.ts`)：
- `listenersInitialized` 标志确保事件监听只注册一次
- `isProcessing` 防止快速重复点击
- 监听器在 `App.vue` 的 `onLaunch` 中初始化

**后端状态管理** (`server/src/socket/call.js`)：
- 通话状态使用 Redis 存储（支持多进程部署）
- `call:{callId}` - 通话记录 JSON（TTL 120秒）
- `user_call:{userId}` - 用户当前通话ID（TTL 120秒）

### 通话记录消息

| 场景 | 消息内容 |
|------|----------|
| 通话完成 | `语音通话 1分30秒` |
| 对方拒绝 | `对方已拒绝` |
| 主动取消 | `已取消` |
| 未接听 | `未接听` |

### 音频质量优化

WebRTC 音频配置位于 `client/src/utils/webrtc.ts`：
- 回声消除、降噪、自动增益
- Opus FEC（前向纠错）
- 抖动缓冲 200ms

## 测试账号

| 账号 | 密码 |
|------|------|
| testuser1 | password123 |
| testuser2 | password123 |
| testuser3 | password123 |
| admin (后台) | admin123 |

## 调试命令

```bash
# 查看 Redis 在线用户
docker exec -it chat-redis redis-cli KEYS "online:*"

# 查看当前活跃通话
docker exec -it chat-redis redis-cli KEYS "call:*"

# 查看数据库消息
docker exec -it chat-mysql mysql -uroot -proot123456 chat_app \
  -e "SELECT * FROM messages ORDER BY id DESC LIMIT 10;"

# 监控后端日志
docker-compose logs -f server 2>&1 | grep -E "(Socket|message|error)"

# 监控语音通话日志
docker-compose logs -f server 2>&1 | grep -E "(call|webrtc)"
```

## 生产部署

部署脚本位于 `single-deploy/`：

```bash
sudo bash setup.sh              # 初始化服务器
sudo bash ssl-setup.sh <域名> <邮箱>  # 申请 SSL 证书
sudo bash deploy.sh --init      # 首次部署
sudo bash deploy.sh --update    # 更新部署
```
