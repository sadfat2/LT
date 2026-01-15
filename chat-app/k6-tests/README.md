# K6 聊天系统性能测试

## 快速开始

### 1. 服务器端：创建测试数据

将 `setup/` 目录上传到服务器：

```bash
# 本地执行
scp -r chat-app/k6-tests/setup user@chat.laoyegong.xyz:/tmp/
```

在服务器上执行：

```bash
ssh user@chat.laoyegong.xyz

cd /tmp/setup

# 方式1: 如果 MySQL 在宿主机可直接访问
chmod +x run.sh
./run.sh

# 方式2: 如果 MySQL 在 Docker 容器中
# 先进入能访问数据库的环境，或设置环境变量
DB_HOST=127.0.0.1 DB_PASSWORD=你的密码 ./run.sh

# 方式3: 通过 Docker 网络连接
DB_HOST=chat-mysql DB_PASSWORD=root123456 ./run.sh
```

### 2. 本地：运行 K6 测试

```bash
# 安装 k6 (macOS)
brew install k6

# 进入测试目录
cd chat-app/k6-tests

# 单场景测试
k6 run scenarios/login.js           # 登录压测
k6 run scenarios/connection.js      # 连接压测
k6 run scenarios/messaging.js       # 消息压测
k6 run scenarios/broadcast.js       # 群聊压测

# 综合测试
k6 run run-all.js
```

### 3. 查看报告

测试完成后，HTML 报告生成在 `reports/` 目录。

---

## 测试场景说明

| 场景 | 文件 | 说明 | 指标 |
|------|------|------|------|
| 登录压测 | `scenarios/login.js` | 100 VU 并发登录 | p95 < 500ms |
| 连接压测 | `scenarios/connection.js` | 100 WebSocket 并发连接 | 成功率 > 99% |
| 消息压测 | `scenarios/messaging.js` | 100 用户并发发送消息 | 延迟 p95 < 500ms |
| 群聊压测 | `scenarios/broadcast.js` | 群消息广播测试 | 延迟 p95 < 1s |

---

## 配置说明

### 修改目标服务器

编辑 `config.js`:

```javascript
export const BASE_URL = 'https://chat.laoyegong.xyz'
export const WS_URL = 'wss://chat.laoyegong.xyz'
```

或通过环境变量：

```bash
k6 run -e BASE_URL=https://your-server.com -e WS_URL=wss://your-server.com scenarios/login.js
```

### 修改并发数

编辑 `config.js` 中的 `TEST_CONFIG`:

```javascript
export const TEST_CONFIG = {
  login: {
    vus: 100,        // 虚拟用户数
    duration: '1m',  // 持续时间
  },
  // ...
}
```

---

## 测试数据

脚本会创建：
- 100 个测试用户: `testuser1` ~ `testuser100`
- 密码统一: `password123`
- 每用户 5 个好友关系
- 5 个测试群 (每群 20 人)

---

## 目录结构

```
k6-tests/
├── config.js              # 测试配置
├── run-all.js             # 综合测试入口
├── utils/
│   └── socketio.js        # Socket.io 协议封装
├── scenarios/
│   ├── login.js           # 登录压测
│   ├── connection.js      # 连接压测
│   ├── messaging.js       # 消息发送压测
│   └── broadcast.js       # 群聊广播压测
├── setup/
│   ├── create-users.js    # 测试数据创建脚本
│   ├── package.json       # Node.js 依赖
│   └── run.sh             # 一键运行脚本
└── reports/               # 测试报告输出
```
