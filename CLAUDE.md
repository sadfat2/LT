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

### 后台管理系统

```bash
cd chat-app/admin

npm install
npm run dev             # 开发模式 (端口 8081)
npm run build           # 构建生产版本
```

## 架构设计

```
客户端 (UniApp)                      后台管理 (Vue3 + Element Plus)
    ├── HTTP --> REST API (Express :3000) <── HTTP
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
| WebRTC TURN 代理 | `chat-app/server/src/routes/webrtc.js` |
| 数据库模型 | `chat-app/server/src/models/` |
| 路由定义 | `chat-app/server/src/routes/` |
| 上传配置 | `chat-app/server/src/config/index.js` |
| 数据库初始化 | `chat-app/server/sql/init.sql` |
| 数据库迁移 | `chat-app/server/sql/migrate_v2.sql` |
| 后台管理迁移 | `chat-app/server/sql/migrate_admin.sql` |
| 性能优化迁移 | `chat-app/server/sql/migrate_performance.sql` |
| Redis 缓存工具 | `chat-app/server/src/config/cache.js` |
| 后台管理前端 | `chat-app/admin/` |
| 后台管理 API | `chat-app/server/src/routes/admin/` |
| 管理员模型 | `chat-app/server/src/models/Admin.js` |
| 推荐链接模型 | `chat-app/server/src/models/ReferralLink.js` |
| 性能优化文档 | `chat-app/docs/PERFORMANCE_OPTIMIZATION.md` |

### Pinia Stores 职责

- `user.ts` - 用户认证、登录/登出、个人信息
- `socket.ts` - Socket.io 连接管理、实时消息收发
- `conversation.ts` - 会话列表、消息记录
- `friend.ts` - 好友列表、好友申请、好友备注管理
- `group.ts` - 群组管理、群成员、群消息
- `call.ts` - 语音通话状态管理、WebRTC 信令处理、操作防抖

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
- `GET /api/conversations/search/all?keyword=` - 综合搜索（好友+群聊+消息）
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
- `POST /api/upload/avatar` - 上传头像 (5MB 限制，支持手机高清照片)
- `POST /api/upload/image` - 上传图片
- `POST /api/upload/voice` - 上传语音 `{ duration }` (5MB 限制, 支持 mp3/wav/aac/webm/ogg)
- `POST /api/upload/file` - 上传文件 (20MB 限制, 支持 pdf/doc/docx/xls/xlsx/ppt/pptx/txt)
- `POST /api/upload/video` - 上传视频 `{ duration }` (50MB 限制, 支持 mp4/mov/webm/3gpp/m4v/avi/mkv)

### WebRTC
- `GET /api/webrtc/turn-credentials` - 获取 TURN 服务器凭据（通过 Cloudflare 代理）

### 推荐链接（公开）
- `GET /api/referral/verify/:code` - 验证推荐码

### 后台管理 API

**认证**
- `POST /api/admin/auth/login` - 管理员登录
- `GET /api/admin/auth/profile` - 获取当前管理员信息

**用户管理**
- `GET /api/admin/users` - 用户列表 `(?page, limit, keyword, status)`
- `GET /api/admin/users/:id` - 用户详情
- `PUT /api/admin/users/:id` - 更新用户信息
- `POST /api/admin/users/:id/ban` - 封停用户（触发 Socket 强制下线）
- `POST /api/admin/users/:id/unban` - 解封用户
- `GET /api/admin/users/:id/messages` - 用户聊天记录 `(?page, limit)`

**推荐链接管理**
- `GET /api/admin/referrals` - 推荐链接列表 `(?page, limit, keyword)`
- `POST /api/admin/referrals` - 创建推荐链接 `{ userId }`
- `PUT /api/admin/referrals/:id/toggle` - 切换激活状态
- `DELETE /api/admin/referrals/:id` - 删除推荐链接

**数据统计**
- `GET /api/admin/statistics/overview` - 概览统计（总用户/今日新增/活跃/在线）
- `GET /api/admin/statistics/trends` - 趋势数据 `(?days=30)`

**管理员管理**
- `GET /api/admin/admins` - 管理员列表
- `POST /api/admin/admins` - 创建管理员 `{ username, password, nickname }`
- `PUT /api/admin/admins/:id` - 更新管理员
- `DELETE /api/admin/admins/:id` - 删除管理员

## 数据库表结构

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| `users` | 用户信息 | account, nickname, avatar, signature, pinyin, status(active/banned) |
| `friendships` | 好友关系（双向存储） | user_id, friend_id, remark |
| `friend_requests` | 好友申请 | from_user_id, to_user_id, status(0待处理/1同意/2拒绝), message |
| `conversations` | 会话记录 | type(private/group), group_id, last_message_id |
| `conversation_participants` | 会话参与者 | conversation_id, user_id, unread_count |
| `messages` | 消息记录 | type(text/image/voice/file/video/system), content, status, duration, file_name, file_size, thumbnail_url |
| `groups` | 群组信息 | name, avatar, owner_id |
| `group_members` | 群成员 | group_id, user_id, role(owner/member) |
| `admins` | 管理员 | username, password, nickname, last_login_at |
| `referral_links` | 推荐链接 | user_id, code, is_active, click_count, register_count |
| `referral_registrations` | 推荐注册记录 | referral_link_id, referrer_id, referee_id |

## 服务端口

| 服务 | 端口 |
|------|------|
| Node.js 后端 | 3000 |
| 前端 H5 开发 | 8080 |
| 后台管理前端 | 8081 |
| MySQL | 3306 |
| Redis | 6379 |

## 测试账号

### 聊天应用用户

| 账号 | 密码 |
|------|------|
| testuser1 | password123 |
| testuser2 | password123 |
| testuser3 | password123 |

### 后台管理员

| 账号 | 密码 |
|------|------|
| admin | admin123 |

## 平台差异

### H5 平台
- 语音录制使用 MediaRecorder API (`client/src/utils/h5Recorder.ts`)
- 语音播放使用 Web Audio API（AudioContext）
- 文件选择使用 `<input type="file">`
- 视频预览通过 `window.open()` 新窗口打开

> **技术说明**：语音播放采用 AudioContext 而非 HTML5 Audio，是为了避免与 MediaRecorder 的音频管道冲突。使用 HTML5 Audio 播放音频后会影响 MediaStream 的内部状态，导致后续录音失败。AudioContext 使用独立的音频管道，播放和录音互不干扰。

### App/小程序平台
- 语音录制使用 `uni.getRecorderManager()`
- 语音播放使用 `uni.createInnerAudioContext()`
- 文件选择使用 `uni.chooseMessageFile()`
- 视频预览使用 `uni.previewMedia()`

### 条件编译
使用 `#ifdef H5` / `#ifndef H5` 区分平台代码

## 搜索功能

### 功能概述

支持在消息页面进行综合搜索，搜索结果按以下顺序显示：

1. **好友** - 匹配昵称、账号或备注
2. **群聊** - 匹配群名称或群成员昵称/账号
3. **聊天记录** - 匹配消息内容

### API 端点

```
GET /api/conversations/search/all?keyword=搜索关键词
```

### 返回数据结构

```typescript
{
  code: 200,
  data: {
    // 好友搜索结果
    friends: [{
      id: number,
      account: string,
      nickname: string,
      avatar: string | null,
      remark: string | null
    }],
    // 群聊搜索结果
    groups: [{
      id: number,
      name: string,
      avatar: string | null,
      owner_id: number,
      member_count: number,
      conversation_id: number,
      matched_member_nickname?: string,  // 匹配的成员昵称（当 match_type='member' 时）
      matched_member_avatar?: string | null,
      match_type: 'group_name' | 'member'  // 匹配类型
    }],
    // 消息搜索结果
    messages: [{
      id: number,
      conversation_id: number,
      sender_id: number,
      type: string,
      content: string,
      created_at: string,
      sender_nickname: string,
      sender_avatar: string | null,
      conversation_type: 'private' | 'group',
      // 私聊信息
      other_user_id?: number,
      other_user_nickname?: string,
      other_user_avatar?: string | null,
      // 群聊信息
      group_id?: number,
      group_name?: string,
      group_avatar?: string | null
    }]
  }
}
```

### 搜索逻辑

| 搜索类型 | 搜索范围 | 匹配字段 |
|----------|----------|----------|
| 好友 | 当前用户的好友列表 | nickname, account, remark |
| 群聊 | 当前用户加入的群聊 | group.name, member.nickname, member.account |
| 消息 | 当前用户参与的会话 | message.content (仅 text 类型) |

### 前端实现

搜索入口位于消息列表页面 (`client/src/pages/index/index.vue`)：

- 点击搜索栏进入搜索模式
- 输入防抖 300ms 后自动搜索
- 搜索结果分类显示
- 点击结果跳转到对应会话

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

### 实现细节

**前端状态管理** (`client/src/store/call.ts`)：

| 机制 | 说明 |
|------|------|
| 监听器防重复 | `listenersInitialized` 标志确保事件监听只注册一次 |
| 全局初始化 | 监听器在 `App.vue` 的 `onLaunch` 中初始化，支持任意页面刷新 |
| 操作锁 | `isProcessing` 防止快速重复点击（双击接听/拒绝） |
| 状态即时更新 | 接听时立即设置 `connecting` 状态，防止重复操作 |
| 忙线检测优化 | 仅 `connecting`/`connected` 状态视为通话中，`ringing` 状态不自动拒绝 |

**后端状态管理** (`server/src/socket/call.js`)：

通话状态使用 Redis 存储，支持多进程/多实例部署：

| Redis Key | 说明 | TTL |
|-----------|------|-----|
| `call:{callId}` | 通话记录 JSON（callerId, receiverId, status, startTime） | 120秒 |
| `user_call:{userId}` | 用户当前通话ID | 120秒 |

> **重要**：早期版本使用内存 Map 存储通话状态，在 Socket.io Redis adapter 多进程环境下会导致"通话不存在"错误。现已迁移到 Redis 存储解决此问题。

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
- 系统自动获取 Cloudflare TURN 凭据，支持复杂网络环境
- **推荐使用耳机**进行通话，可有效避免回声和啸叫

### 音频质量优化

WebRTC 音频采用多层优化策略：

| 优化项 | 说明 |
|--------|------|
| 回声消除 | `echoCancellation: true` + Google AEC |
| 降噪处理 | `noiseSuppression: true` |
| 自动增益 | `autoGainControl: true` |
| 高通滤波 | `googHighpassFilter: true`（过滤低频噪音） |
| Opus FEC | `useinbandfec=1`（前向纠错，抗丢包） |
| 抖动缓冲 | `jitterBufferTarget: 200ms`（平滑网络波动） |
| 单声道 | `channelCount: 1`（减少回声） |

音频模式配置位于 `client/src/utils/webrtc.ts`：

```typescript
// 可选模式: 'optimized' | 'raw' | 'balanced'
private audioMode: AudioMode = 'optimized'  // 默认启用全部音频处理
```

### ICE 服务器配置

系统默认使用 Google 公共 STUN 服务器，并通过后端代理自动获取 Cloudflare TURN 凭据：

```typescript
// 静态 STUN 服务器（client/src/utils/webrtc.ts）
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

// TURN 凭据通过后端代理动态获取
// GET /api/webrtc/turn-credentials -> Cloudflare TURN
```

**TURN 服务器工作原理：**
1. 前端调用 `/api/webrtc/turn-credentials` 获取凭据
2. 后端从 `https://speed.cloudflare.com/turn-creds` 获取并缓存（5分钟）
3. 返回包含 STUN/TURN URLs、用户名和凭据的 ICE 服务器配置
4. 适用于复杂 NAT 环境（如移动网络、企业防火墙）

### 局域网开发测试

支持手机与电脑在同一局域网内测试：

1. **生成 SSL 证书**（WebRTC 需要安全上下文）：
   ```bash
   cd chat-app/client
   mkdir -p cert && cd cert
   openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes \
     -subj "/CN=localhost" \
     -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:YOUR_LAN_IP"
   ```

2. **后端也需要证书**（复制到 server 目录）：
   ```bash
   cp chat-app/client/cert/*.pem chat-app/server/
   docker-compose up -d --build server
   ```

3. **访问方式**：
   - 电脑：`https://localhost:8080`
   - 手机：`https://YOUR_LAN_IP:8080`（需信任自签名证书）

4. **重要**：所有客户端通过 Vite 代理连接到同一个后端 Socket.io 实例，确保消息同步。

## 数据库迁移

从旧版本升级时，执行迁移脚本：

```bash
# 方式一：执行迁移脚本（保留数据）
docker exec -i chat-mysql mysql -uroot -proot123456 chat_app < chat-app/server/sql/migrate_v2.sql

# 后台管理系统迁移（创建管理员表、推荐链接表等）
docker exec -i chat-mysql mysql -uroot -proot123456 chat_app < chat-app/server/sql/migrate_admin.sql

# 性能优化迁移（创建索引、全文索引等）
docker exec -i chat-mysql mysql -uroot -proot123456 chat_app < chat-app/server/sql/migrate_performance.sql

# 方式二：重建数据库（清除所有数据）
cd chat-app
docker-compose down -v
docker-compose up -d
```

## 调试技巧

```bash
# 查看 Redis 中的在线用户
docker exec -it chat-redis redis-cli KEYS "online:*"

# 查看 Redis 缓存（用户、好友、群组等）
docker exec -it chat-redis redis-cli KEYS "*"

# 查看当前活跃通话
docker exec -it chat-redis redis-cli KEYS "call:*"

# 查看用户通话状态
docker exec -it chat-redis redis-cli KEYS "user_call:*"

# 查看 Redis 缓存命中率
docker exec -it chat-redis redis-cli INFO stats | grep -E "keyspace_hits|keyspace_misses"

# 查看数据库中的消息
docker exec -it chat-mysql mysql -uroot -proot123456 chat_app -e "SELECT * FROM messages ORDER BY id DESC LIMIT 10;"

# 查看群组列表
docker exec -it chat-mysql mysql -uroot -proot123456 chat_app -e "SELECT g.*, u.nickname as owner_name FROM groups g JOIN users u ON g.owner_id = u.id;"

# 查看数据库索引
docker exec -it chat-mysql mysql -uroot -proot123456 chat_app -e "SHOW INDEX FROM messages;"

# 实时监控后端日志
docker-compose logs -f server 2>&1 | grep -E "(Socket|message|error)"

# 监控语音通话相关日志
docker-compose logs -f server 2>&1 | grep -E "(call|webrtc|通话)"

# 测试 TURN 凭据获取
curl -s http://localhost:3000/api/webrtc/turn-credentials -H "Authorization: Bearer <token>" | jq .
```

### 语音通话测试

1. 打开两个浏览器标签（或两台设备）
2. 分别登录不同账号（如 testuser1 和 testuser2）
3. 用户A 进入与用户B 的私聊
4. 用户A 点击 **+** → **语音通话**
5. 用户B 会收到来电弹窗
6. 用户B 点击接听，验证语音通话功能

## 后台管理系统

### 功能模块

| 模块 | 功能 |
|------|------|
| 仪表盘 | 用户统计概览、趋势图表 |
| 用户管理 | 用户列表、搜索、封停/解封、查看聊天记录 |
| 推荐链接 | 创建/删除链接、激活/禁用、统计数据 |
| 数据统计 | 用户趋势、活跃度分析 |
| 管理员管理 | 管理员账号增删改查 |

### 用户封停流程

1. 管理员在后台封停用户
2. 后端通过 Socket.io 发送 `force_logout` 事件
3. 前端收到事件后强制退出登录
4. 被封停用户无法再次登录

### 推荐链接流程

1. 管理员为用户创建推荐链接，生成唯一 code
2. 链接格式：`https://domain.com/register?ref={code}`
3. 新用户通过链接注册时带上 `referralCode` 参数
4. 注册成功后：
   - 记录推荐关系到 `referral_registrations` 表
   - 自动添加推荐人为好友
   - 自动创建私聊会话
   - 更新推荐链接的注册计数

### Socket 事件

| 事件 | 方向 | 说明 |
|------|------|------|
| `force_logout` | S→C | 强制下线（封停用户时触发） |

```javascript
// 前端监听示例
socket.on('force_logout', ({ reason, message }) => {
  // reason: 'banned'
  // message: '您的账号已被封停：xxx'
  userStore.logout()
  router.push('/login')
})
```

### 前端技术栈

- Vue 3 + TypeScript
- Element Plus UI 组件库
- Pinia 状态管理
- Vue Router 路由
- ECharts 图表
- Axios HTTP 客户端

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
