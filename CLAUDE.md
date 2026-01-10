# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

仿微信的实时聊天应用，支持文本、图片、语音、文件、视频消息，以及群聊和**语音通话**功能。采用 UniApp (Vue3 + TypeScript) + Node.js + Socket.io + MySQL + Redis 架构，语音通话基于 WebRTC P2P 实现。

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
| H5 录音工具 | `chat-app/client/src/utils/h5Recorder.ts` |
| WebRTC 封装 | `chat-app/client/src/utils/webrtc.ts` |
| 通话组件 | `chat-app/client/src/components/call/` |
| 聊天页面 | `chat-app/client/src/pages/chat/index.vue` |
| 群聊页面 | `chat-app/client/src/pages/group/` |
| 后端入口 | `chat-app/server/src/app.js` |
| Socket 事件处理 | `chat-app/server/src/socket/index.js` |
| 通话信令处理 | `chat-app/server/src/socket/call.js` |
| 数据库模型 | `chat-app/server/src/models/` |
| 路由定义 | `chat-app/server/src/routes/` |
| 上传配置 | `chat-app/server/src/config/index.js` |
| 数据库初始化 | `chat-app/server/sql/init.sql` |
| 数据库迁移 | `chat-app/server/sql/migrate_v2.sql` |

### Pinia Stores 职责

- `user.ts` - 用户认证、登录/登出、个人信息
- `socket.ts` - Socket.io 连接管理、实时消息收发
- `conversation.ts` - 会话列表、消息记录
- `friend.ts` - 好友列表、好友申请、好友备注管理
- `group.ts` - 群组管理、群成员、群消息
- `call.ts` - 语音通话状态管理、WebRTC 信令处理

## Socket.io 事件协议

### 客户端 → 服务端

| 事件 | 数据格式 |
|------|----------|
| `send_message` | `{ conversationId?, receiverId?, type, content, mediaUrl?, duration?, fileName?, fileSize? }` |
| `message_read` | `{ conversationId, messageIds }` |
| `revoke_message` | `{ messageId }` |
| `typing` | `{ receiverId }` |

**消息类型 (type):** `text` | `image` | `voice` | `file` | `video` | `system`

> `system` 类型用于系统消息，如通话记录，在聊天界面中居中显示

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

### 语音通话事件

**呼叫信令（双向）：**

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

**WebRTC 信令（双向转发）：**

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
- `GET /api/conversations/:id/messages` - 获取会话消息

### 群聊
- `POST /api/groups` - 创建群聊 `{ name, memberIds[] }`
- `GET /api/groups` - 获取群列表
- `GET /api/groups/:id` - 获取群详情（含成员列表）
- `PUT /api/groups/:id` - 更新群信息 `{ name?, avatar? }`
- `POST /api/groups/:id/invite` - 邀请成员 `{ userIds[] }`
- `POST /api/groups/:id/leave` - 退出群聊
- `DELETE /api/groups/:id/members/:userId` - 移除成员（仅群主）
- `DELETE /api/groups/:id` - 解散群聊（仅群主）

### 上传
- `POST /api/upload/avatar` - 上传头像 (2MB 限制)
- `POST /api/upload/image` - 上传图片
- `POST /api/upload/voice` - 上传语音 `{ duration }` (5MB 限制, 支持 mp3/wav/aac/webm/ogg)
- `POST /api/upload/file` - 上传文件 (20MB 限制, 支持 pdf/doc/docx/xls/xlsx/ppt/pptx/txt)
- `POST /api/upload/video` - 上传视频 `{ duration }` (50MB 限制, 支持 mp4/mov/avi/mkv/webm)

## 数据库表结构

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| `users` | 用户信息 | account, nickname, avatar, signature, pinyin |
| `friendships` | 好友关系（双向存储） | user_id, friend_id, remark |
| `friend_requests` | 好友申请 | from_user_id, to_user_id, status(0待处理/1同意/2拒绝), message |
| `conversations` | 会话记录 | type(private/group), group_id, last_message_id |
| `conversation_participants` | 会话参与者 | conversation_id, user_id, unread_count |
| `messages` | 消息记录 | type(text/image/voice/file/video/system), content, status, duration, file_name, file_size, thumbnail_url |
| `groups` | 群组信息 | name, avatar, owner_id |
| `group_members` | 群成员 | group_id, user_id, role(owner/member) |

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

## 平台差异

### H5 平台
- 语音录制使用 MediaRecorder API (`client/src/utils/h5Recorder.ts`)
- 语音播放使用 HTML5 Audio API
- 文件选择使用 `<input type="file">`
- 视频预览通过 `window.open()` 新窗口打开

### App/小程序平台
- 语音录制使用 `uni.getRecorderManager()`
- 语音播放使用 `uni.createInnerAudioContext()`
- 文件选择使用 `uni.chooseMessageFile()`
- 视频预览使用 `uni.previewMedia()`

### 条件编译
使用 `#ifdef H5` / `#ifndef H5` 区分平台代码

## 语音通话功能

### 技术架构

```
用户A (浏览器)              Socket.io 服务器              用户B (浏览器)
     |                          |                              |
     |------ call:request ----->|                              |
     |                          |------ call:incoming -------->|
     |                          |<----- call:accept -----------|
     |<----- call:accepted -----|                              |
     |                          |                              |
     |------ webrtc:offer ----->|------ webrtc:offer --------->|
     |<----- webrtc:answer -----|<----- webrtc:answer ---------|
     |<===== webrtc:ice =======>|<===== webrtc:ice ==========>|
     |                          |                              |
     |============== WebRTC P2P 音频流（直连）=================|
```

### 功能特性

- 1v1 私聊语音通话（H5 平台）
- 来电/去电弹窗提示
- 通话中界面（计时、静音、挂断）
- 30秒呼叫超时自动取消
- 用户忙线/离线检测
- 通话记录自动保存到聊天历史

### 通话记录消息

通话结束后会自动在聊天中生成系统消息记录：

| 场景 | 消息内容 |
|------|----------|
| 通话完成 | `语音通话 1分30秒` |
| 对方拒绝 | `对方已拒绝` |
| 主动取消 | `已取消` |
| 未接听（超时30秒） | `未接听` |

消息以 `system` 类型存储，在聊天界面中居中显示。

### 使用方式

1. 进入私聊页面
2. 点击底部 **+** 按钮
3. 选择 **语音通话**
4. 等待对方接听

### 平台支持

| 平台 | 支持情况 |
|------|----------|
| H5 (Chrome/Safari) | ✅ 完全支持 |
| iOS App | ✅ 通过 WKWebView |
| Android App | ✅ 通过 WebView |
| 微信小程序 | ❌ 暂不支持 |

### 注意事项

- 需要 **HTTPS** 环境（localhost 除外）
- 首次使用需授权麦克风权限
- 复杂网络环境可能需要配置 TURN 服务器

### ICE 服务器配置

默认使用 Google 公共 STUN 服务器，如需自定义，修改 `client/src/utils/webrtc.ts`：

```typescript
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  // 添加 TURN 服务器（用于复杂网络环境）
  // { urls: 'turn:your-turn-server', username: '...', credential: '...' }
]
```

## 数据库迁移

从旧版本升级时，执行迁移脚本：

```bash
# 方式一：执行迁移脚本（保留数据）
docker exec -i chat-mysql mysql -uroot -proot123456 chat_app < chat-app/server/sql/migrate_v2.sql

# 方式二：重建数据库（清除所有数据）
cd chat-app
docker-compose down -v
docker-compose up -d
```

## 调试技巧

```bash
# 查看 Redis 中的在线用户
docker exec -it chat-redis redis-cli KEYS "online:*"

# 查看数据库中的消息
docker exec -it chat-mysql mysql -uroot -proot123456 chat_app -e "SELECT * FROM messages ORDER BY id DESC LIMIT 10;"

# 查看群组列表
docker exec -it chat-mysql mysql -uroot -proot123456 chat_app -e "SELECT g.*, u.nickname as owner_name FROM groups g JOIN users u ON g.owner_id = u.id;"

# 实时监控后端日志
docker-compose logs -f server 2>&1 | grep -E "(Socket|message|error)"

# 监控语音通话相关日志
docker-compose logs -f server 2>&1 | grep -E "(call|webrtc|通话)"
```

### 语音通话测试

1. 打开两个浏览器标签（或两台设备）
2. 分别登录不同账号（如 testuser1 和 testuser2）
3. 用户A 进入与用户B 的私聊
4. 用户A 点击 **+** → **语音通话**
5. 用户B 会收到来电弹窗
6. 用户B 点击接听，验证语音通话功能

## 生产部署

生产部署脚本位于 `chat-app/single-deploy/`，支持单台 Ubuntu 服务器一键部署。

```bash
# 上传部署文件到服务器
scp -r chat-app/single-deploy/ root@YOUR_SERVER_IP:/opt/

# 服务器上执行
sudo bash setup.sh              # 初始化服务器
sudo bash ssl-setup.sh <域名> <邮箱>  # 申请 SSL 证书
sudo bash deploy.sh --init      # 首次部署
sudo bash deploy.sh --update    # 更新部署
sudo bash backup.sh --all       # 完整备份
```
