# K6 性能测试报告

## 测试概述

**测试时间**: 2026-01-15
**目标服务器**: https://chat.laoyegong.xyz
**服务器配置**: 2核 4G

---

## 一、测试结果总结

| 测试场景 | 状态 | 说明 |
|----------|------|------|
| 登录 API 压测 | ✅ 成功 | HTTP 接口测试正常 |
| WebSocket 连接测试 | ❌ 失败 | k6 无法正确建立 Socket.io 连接 |
| 消息发送测试 | ❌ 无法进行 | 依赖 Socket.io，无 HTTP API |
| 群聊广播测试 | ❌ 无法进行 | 依赖 Socket.io |

---

## 二、登录 API 压测结果

### 2.1 优化前（单进程 Node.js）

```
并发用户: 100
持续时间: 30s

响应时间:
  - 平均: 7593ms
  - p95: 9281ms

吞吐量: 9.92 req/s
成功率: 92%
超时错误: 频繁
```

### 2.2 优化后（PM2 双进程）

```
并发用户: 100
持续时间: 30s

响应时间:
  - 平均: 4992ms ↓ 34%
  - p95: 5520ms ↓ 40%

吞吐量: 14.69 req/s ↑ 48%
成功率: 100% ✅
超时错误: 几乎无
```

### 2.3 优化措施

| 优化项 | 修改内容 | 效果 |
|--------|----------|------|
| PM2 多进程 | Dockerfile 使用 `pm2-runtime -i 2` | 吞吐量提升 48% |
| 数据库连接池 | `connectionLimit: 10 → 30` | 减少连接等待 |
| Socket.io Redis Adapter | 添加 `@socket.io/redis-adapter` | 支持多进程消息路由 |

### 2.4 性能瓶颈分析

**主要瓶颈: bcrypt 密码验证**

- 单次 bcrypt.compare() 约需 1.3 秒（rounds=10）
- Node.js 单线程无法并行处理
- 100 并发时排队等待导致响应时间增长
- PM2 双进程可并行处理，但仍受 CPU 限制

---

## 三、WebSocket/Socket.io 测试问题

### 3.1 问题现象

- k6 测试运行时，服务器在线人数没有变化
- 说明 WebSocket 连接没有真正建立成功
- 服务器 CPU/内存使用率低，证实请求未到达

### 3.2 原因分析

**k6 原生 WebSocket 不支持 Socket.io 协议**

Socket.io 使用自定义协议，需要：
1. HTTP 轮询握手获取 `sid`
2. WebSocket 升级连接
3. Engine.io 协议（ping/pong/upgrade）
4. Socket.io 协议（connect/event/ack）

k6 测试脚本尝试手动实现这些协议，但存在以下问题：

1. **异步处理不完善** - k6 的 WebSocket 回调机制与 Socket.io 协议不完全兼容
2. **握手时序问题** - Engine.io 升级过程需要精确的消息顺序
3. **心跳机制** - k6 不支持 `setInterval`，无法主动发送心跳

### 3.3 验证方法

```bash
# 在服务器上观察在线用户
docker exec chat-redis redis-cli KEYS "online:*"

# 预期：测试期间应看到 online:userId 键增加
# 实际：键数量无变化
```

---

## 四、消息发送测试限制

### 4.1 架构限制

根据项目架构，消息发送**只能通过 Socket.io**：

```
客户端 --[Socket.io]--> 服务器 --[MySQL]--> 持久化
                              --[Redis]--> 在线状态
```

**没有 HTTP API 用于发送消息**

验证：
```bash
curl -X POST https://chat.laoyegong.xyz/api/messages
# 返回: Cannot POST /api/messages
```

### 4.2 Socket.io 事件

| 事件 | 方向 | 用途 |
|------|------|------|
| `send_message` | C→S | 发送消息 |
| `new_message` | S→C | 接收消息 |
| `message_sent` | S→C | 发送确认 |

---

## 五、已完成的优化

### 5.1 部署脚本优化

文件: `single-deploy/deploy.sh`

- 添加 `apply_optimizations()` 函数
- 在 `--init` 和 `--update` 时自动应用优化

### 5.2 Docker 配置优化

文件: `single-deploy/Dockerfile.server`

```dockerfile
# 安装 PM2
RUN npm install -g pm2

# 使用 PM2 双进程启动
CMD ["pm2-runtime", "start", "src/app.js", "-i", "2"]
```

### 5.3 Socket.io Redis Adapter

文件: `server/src/socket/index.js`

```javascript
const { createAdapter } = require('@socket.io/redis-adapter');

// PM2 多进程模式下使用 Redis adapter
const pubClient = createClient({ ... });
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));
```

### 5.4 配置文件

目录: `single-deploy/optimizations/`

- `database.js` - 优化的数据库连接池配置
- `ecosystem.config.js` - PM2 配置文件
- `docker-compose.optimized.yml` - 优化的 Docker 配置
- `README.md` - 优化指南

---

## 六、建议

### 6.1 Socket.io 测试替代方案

由于 k6 对 Socket.io 支持有限，建议使用以下工具：

| 工具 | 特点 |
|------|------|
| **Artillery** | 原生支持 Socket.io，推荐 |
| **Locust** | Python，可自定义 Socket.io 客户端 |
| **自定义脚本** | 使用 Node.js socket.io-client 编写测试 |

**Artillery 示例配置:**

```yaml
config:
  target: "https://chat.laoyegong.xyz"
  socketio:
    transports: ["websocket"]
  phases:
    - duration: 60
      arrivalRate: 10

scenarios:
  - engine: socketio
    flow:
      - emit:
          channel: "send_message"
          data:
            receiverId: 40
            type: "text"
            content: "压测消息"
```

### 6.2 进一步优化建议

| 优化项 | 说明 | 预期效果 |
|--------|------|----------|
| 降低 bcrypt rounds | 从 10 降到 8 | 响应时间减半（牺牲安全性） |
| 增加服务器配置 | 4核 8G | 支持更多并发进程 |
| 登录缓存 | Redis 缓存 token 验证 | 减少重复 bcrypt 计算 |
| 数据库读写分离 | MySQL 主从 | 提升读取性能 |

---

## 七、测试数据

### 7.1 已创建的测试数据

- **测试用户**: testuser1 ~ testuser100（密码: password123）
- **好友关系**: ~185 对
- **测试群组**: 1 个（K6压测群，20 人）

### 7.2 测试文件

```
chat-app/k6-tests/
├── config.js                    # 测试配置
├── utils/socketio.js            # Socket.io 协议封装
├── scenarios/
│   ├── login.js                 # ✅ 登录压测（可用）
│   ├── connection.js            # ❌ 连接压测（Socket.io 问题）
│   ├── messaging.js             # ❌ 消息压测（Socket.io 问题）
│   ├── messaging-http.js        # ❌ HTTP 消息（无此 API）
│   └── broadcast.js             # ❌ 广播压测（Socket.io 问题）
├── setup/
│   └── create-users-api.js      # 测试数据创建脚本
└── reports/                     # 测试报告目录
```

---

## 八、结论

### 8.1 成功项

1. **登录 API 性能优化** - 响应时间降低 34%，吞吐量提升 48%
2. **PM2 多进程部署** - 已集成到部署脚本
3. **Socket.io Redis Adapter** - 已添加，支持多进程消息路由
4. **测试数据准备** - 100 用户 + 好友关系 + 测试群组

### 8.2 未完成项

1. **Socket.io 连接压测** - k6 协议实现问题，建议使用 Artillery
2. **消息发送压测** - 依赖 Socket.io，同上
3. **群聊广播压测** - 依赖 Socket.io，同上

### 8.3 总结

k6 适合测试 **HTTP API**（如登录接口），但对 **Socket.io 实时通信**支持有限。建议：

- HTTP 接口继续使用 k6 测试
- Socket.io 功能改用 **Artillery** 或自定义 Node.js 脚本测试
