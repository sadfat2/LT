# 聊天系统性能测试套件

本目录包含聊天系统的完整性能测试工具，支持 HTTP API 和 Socket.IO 实时通信测试。

## 快速开始

### 1. 安装依赖

```bash
cd k6-tests
npm install

# 安装 k6 (用于 HTTP 测试)
brew install k6
```

### 2. 准备测试数据

```bash
cd setup
npm install
node create-users.js
cd ..
```

这将创建：
- 100 个测试用户 (testuser1 ~ testuser100，密码: password123)
- 每用户 5 个好友关系
- 5 个测试群 (每群 20 人)

### 3. 运行测试

```bash
# HTTP 登录压测 (k6)
k6 run -e BASE_URL=http://localhost:3000 scenarios/login.js

# Socket.IO 消息测试 (Node.js)
node socketio-loadtest.js 50 30

# 群聊广播测试 (Node.js)
node broadcast-loadtest.js 20 30

# 稳定性测试 (Node.js)
node stability-test.js 30 5
```

---

## 测试脚本说明

| 脚本 | 用途 | 参数 |
|------|------|------|
| `scenarios/login.js` | k6 HTTP 登录压测 | 通过 k6 命令行参数 |
| `socketio-loadtest.js` | Socket.IO 消息测试 | `[并发数] [持续秒数]` |
| `broadcast-loadtest.js` | 群聊广播测试 | `[群成员数] [持续秒数]` |
| `stability-test.js` | 长时间稳定性测试 | `[并发数] [持续分钟]` |

---

## 测试结果

详细测试报告见 [TEST_REPORT.md](./TEST_REPORT.md)

### 最新测试结果 (2026-01-15)

| 测试场景 | 并发数 | 成功率 | p95 延迟 |
|----------|--------|--------|----------|
| HTTP 登录 | 50 VU | 100% | 179ms |
| Socket.IO 消息 | 50 用户 | 100% | 109ms |
| 群聊广播 | 20 成员 | 100% | 46ms |
| 稳定性 (5分钟) | 30 用户 | 100% | 70ms |

---

## 目录结构

```
k6-tests/
├── config.js                 # k6 配置文件
├── scenarios/                # k6 测试场景
│   ├── login.js              # ✅ 登录压测
│   ├── connection.js         # WebSocket 连接测试
│   ├── messaging.js          # 消息发送测试
│   └── broadcast.js          # 群聊广播测试
├── socketio-loadtest.js      # ✅ Node.js 消息测试
├── broadcast-loadtest.js     # ✅ Node.js 广播测试
├── stability-test.js         # ✅ Node.js 稳定性测试
├── setup/                    # 测试数据准备
│   ├── create-users.js       # 创建测试用户
│   └── package.json
├── artillery/                # Artillery 配置 (备用)
├── utils/                    # k6 工具函数
├── reports/                  # 测试报告输出
├── TEST_REPORT.md            # 详细测试报告
└── README.md                 # 本文件
```

---

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `BASE_URL` | `http://localhost:3000` | 服务器地址 |
| `WS_URL` | `ws://localhost:3000` | WebSocket 地址 |

示例：
```bash
BASE_URL=https://your-server.com node socketio-loadtest.js 50 30
```

---

## 远程服务器测试

### 1. 上传测试数据脚本

```bash
scp -r chat-app/k6-tests/setup user@your-server:/tmp/
```

### 2. 在服务器上创建测试数据

```bash
ssh user@your-server
cd /tmp/setup
npm install
DB_HOST=chat-mysql DB_PASSWORD=root123456 node create-users.js
```

### 3. 本地运行远程测试

```bash
# k6 测试
k6 run -e BASE_URL=https://your-server.com scenarios/login.js

# Node.js 测试
BASE_URL=https://your-server.com node socketio-loadtest.js 50 30
```

---

## 注意事项

1. **k6 对 Socket.IO 支持有限** - 建议使用 Node.js 脚本进行 Socket.IO 测试
2. **确保服务器运行中** - 测试前确认 `docker-compose up -d`
3. **测试数据准备** - 首次运行需要执行 `setup/create-users.js`
4. **本地测试** - 默认配置针对本地开发环境优化
