# Artillery 性能测试套件

聊天系统的完整性能测试工具，基于 Artillery + Socket.IO v3 引擎。

## 测试场景

| 测试 | 文件 | 说明 |
|------|------|------|
| 消息发送 | `message-test.yml` | 私聊消息发送性能 |
| 连接稳定性 | `connection-test.yml` | Socket.IO 连接建立和保持 |
| 群聊消息 | `group-message-test.yml` | 群聊消息发送和广播 |
| REST API | `api-test.yml` | HTTP API 接口性能 |
| 压力测试 | `stress-test.yml` | 高并发极限测试 |
| 真实场景 | `realistic-test.yml` | 模拟真实用户行为 |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 准备测试数据（首次）

在服务器上创建测试用户和好友关系：

```bash
# 方式一: 通过数据库直接创建 (需要数据库访问)
cd setup
npm install
node create-users.js

# 远程服务器
DB_HOST=your-db-host DB_PASSWORD=xxx node create-users.js
```

### 3. 生成 Token

```bash
npm run generate-tokens

# 指定服务器和用户数量
BASE_URL=http://localhost:3000 USER_COUNT=100 npm run generate-tokens
```

### 4. 运行测试

```bash
# 快速测试（生成 token + 消息测试）
npm test

# 完整测试（所有场景）
npm run test:full

# 单独运行各场景
npm run test:message      # 消息测试
npm run test:connection   # 连接测试
npm run test:group        # 群聊测试
npm run test:api          # API 测试
npm run test:stress       # 压力测试（谨慎使用）
npm run test:realistic    # 真实场景测试
```

## 目录结构

```
artillery-tests/
├── artillery/
│   ├── config.yml            # 通用配置模板
│   ├── generate-tokens.js    # Token 预生成脚本
│   ├── processor.js          # 自定义处理函数
│   ├── message-test.yml      # 消息发送测试
│   ├── connection-test.yml   # 连接稳定性测试
│   ├── group-message-test.yml # 群聊测试
│   ├── api-test.yml          # REST API 测试
│   ├── stress-test.yml       # 压力测试
│   ├── realistic-test.yml    # 真实场景测试
│   ├── tokens.csv            # 生成的 token (git ignored)
│   └── tokens.json           # 生成的 token (git ignored)
├── setup/
│   ├── create-users.js       # 创建测试用户脚本
│   └── create-users-api.js   # 通过 API 创建用户
├── package.json
└── README.md
```

## 测试配置详情

### 消息测试 (message-test.yml)

| 参数 | 值 |
|------|-----|
| 目标服务器 | https://chat.laoyegong.xyz |
| 预热阶段 | 10秒, 1 用户/秒 |
| 正常负载 | 30秒, 2 用户/秒 |
| 每用户消息数 | 5 条 |

### 连接测试 (connection-test.yml)

| 阶段 | 持续时间 | 到达率 |
|------|----------|--------|
| 缓慢增加 | 20秒 | 2/秒 |
| 持续稳定 | 60秒 | 5/秒 |
| 峰值测试 | 30秒 | 10/秒 |
| 冷却 | 20秒 | 1/秒 |

### 群聊测试 (group-message-test.yml)

- 群消息发送性能
- 群消息广播效率
- 私聊+群聊混合场景

### API 测试 (api-test.yml)

测试覆盖接口：
- `/api/auth/login` - 登录
- `/api/user/profile` - 用户信息
- `/api/friends` - 好友列表
- `/api/conversations` - 会话列表
- `/api/groups` - 群组列表
- `/api/user/search` - 用户搜索
- `/api/conversations/search/all` - 综合搜索

### 压力测试 (stress-test.yml)

**警告：此测试会对服务器造成较大压力**

| 阶段 | 持续时间 | 到达率 |
|------|----------|--------|
| 预热 | 30秒 | 5/秒 |
| 增长 | 60秒 | 10→20/秒 |
| 高负载 | 120秒 | 20/秒 |
| 峰值 | 60秒 | 30/秒 |
| 冷却 | 30秒 | 5/秒 |

### 真实场景测试 (realistic-test.yml)

模拟真实用户行为模式：
- **活跃用户** (20%): 频繁发消息
- **普通用户** (40%): 偶尔发消息
- **潜水用户** (30%): 只看不发
- **搜索用户** (10%): 主要使用搜索功能

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `BASE_URL` | 目标服务器地址 | https://chat.laoyegong.xyz |
| `USER_COUNT` | 生成 token 的用户数量 | 50 |
| `DB_HOST` | 数据库主机 (setup 脚本) | 127.0.0.1 |
| `DB_PASSWORD` | 数据库密码 (setup 脚本) | root123456 |

## 修改目标服务器

1. 编辑各测试文件中的 `target` 配置
2. 运行 `npm run generate-tokens` 重新生成 token

## 测试结果示例

```
Summary report:
  vusers.created: 240
  vusers.completed: 238 (99.2%)
  engine.socketio.emit: 1190
  http.requests: 480
  http.codes.200: 478
  vusers.session_length:
    min: 8234
    max: 65432
    mean: 23456
    p95: 45678
    p99: 58901
```

## 生成 HTML 报告

```bash
# 运行测试并生成 JSON 报告
npx artillery run artillery/message-test.yml -o report.json

# 转换为 HTML
npx artillery report report.json
```

## 注意事项

1. **Token 有效期**: 生成的 token 默认 7 天有效，过期需重新生成
2. **测试数据**: 首次测试需要先在服务器上创建测试用户
3. **压力测试**: 请在测试环境使用，避免影响生产服务
4. **网络延迟**: 远程服务器测试延迟受网络影响
5. **群聊测试**: 需要确保测试用户已加入测试群

## 添加新测试

1. 在 `artillery/` 目录创建新的 `.yml` 配置文件
2. 在 `package.json` 中添加对应的 npm script
3. 如需自定义逻辑，编辑 `processor.js`

## 常见问题

### Token 生成失败

```
错误: 没有成功获取任何 token!
```

请检查：
1. 服务器是否在线
2. 测试用户是否已创建 (`npm run setup`)

### 群消息测试无效

确保 `tokens.csv` 中包含有效的 `groupConversationId`。如果为 0，需要：
1. 运行 `setup/create-users.js` 创建群组
2. 重新生成 token

### 连接超时

调整测试文件中的 `timeout` 配置：

```yaml
engines:
  socketio-v3:
    timeout: 30000  # 增加到 30 秒
```
