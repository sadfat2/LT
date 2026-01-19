# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

在线斗地主游戏，采用 Vue 3 + Phaser 3 + Node.js + Socket.io + MySQL + Redis 架构。

## 常用命令

### 启动后端服务（Docker）

```bash
docker-compose up -d                      # 启动所有服务
docker-compose logs -f server             # 查看后端日志
docker-compose up -d --build server       # 重建服务
```

### 启动前端开发

```bash
cd client
npm install
npm run dev           # 开发模式 (端口 8081)
npm run build         # 构建生产版本
```

### 数据库调试

```bash
docker exec -it doudizhu-mysql mysql -uroot -proot123456 doudizhu
docker exec -it doudizhu-redis redis-cli
```

## 服务端口

| 服务 | 端口 |
|------|------|
| 前端开发服务器 | 8081 |
| 后端 API | 4000 |
| MySQL | 3307 |
| Redis | 6380 |

## 架构设计

```
Vue 3 (Pages/Stores) ←→ Phaser 3 (游戏渲染)
         ↓                    ↓
    Socket.io Client    EventBus (双向通信)
         ↓
    Node.js (Express + Socket.io)
    ├── REST API (/api/auth, /api/user, /api/coins, /api/room)
    └── Socket Events (room/game/chat)
         ↓
    GameEngine + CardValidator
         ↓
    MySQL (持久化) + Redis (在线状态/缓存)
```

### 前端核心模块

| 模块 | 路径 | 职责 |
|------|------|------|
| 游戏状态管理 | `client/src/store/game.ts` | 游戏核心状态、手牌管理、Socket 事件监听 |
| 房间状态管理 | `client/src/store/room.ts` | 房间列表、加入/创建、玩家准备状态 |
| Socket 管理 | `client/src/store/socket.ts` | Socket.io 连接、在线状态 |
| 用户状态 | `client/src/store/user.ts` | 认证、登录/注册、个人信息 |
| Phaser 管理器 | `client/src/phaser/GameManager.ts` | Phaser 实例管理、Vue-Phaser 通信 |
| 事件总线 | `client/src/phaser/EventBus.ts` | Vue ↔ Phaser 双向通信桥梁 |
| 游戏场景 | `client/src/phaser/scenes/GameScene.ts` | Phaser 游戏主场景 |
| UI 场景 | `client/src/phaser/scenes/UIScene.ts` | Phaser UI 层 |
| 牌型工具 | `client/src/game/cardUtils.ts` | 洗牌、发牌、排序、牌型判断 |
| 类型定义 | `client/src/types/index.ts` | TypeScript 类型 |
| API 封装 | `client/src/api/index.ts` | Axios HTTP 请求封装 |

### 后端核心模块

| 模块 | 路径 | 职责 |
|------|------|------|
| 游戏引擎 | `server/src/game/GameEngine.js` | 完整斗地主规则（叫地主、出牌、结算） |
| 牌型验证 | `server/src/game/CardValidator.js` | 所有牌型验证和比较 |
| Socket 主入口 | `server/src/socket/index.js` | 连接管理、认证、断线重连 |
| 房间事件 | `server/src/socket/room.js` | 创建/加入/离开房间、准备、快速匹配 |
| 游戏事件 | `server/src/socket/game.js` | 叫分、出牌、不出、提示、重连 |
| 聊天事件 | `server/src/socket/chat.js` | 游戏内表情、快捷消息 |
| 用户模型 | `server/src/models/User.js` | 用户数据操作 |
| 配置 | `server/src/config/index.js` | MySQL/Redis/JWT/游戏参数配置 |
| 主入口 | `server/src/app.js` | Express 应用初始化 |

### Phaser 游戏对象

| 对象 | 路径 | 职责 |
|------|------|------|
| Card | `client/src/phaser/objects/Card.ts` | 单张扑克牌 |
| CardGroup | `client/src/phaser/objects/CardGroup.ts` | 扑克牌组（手牌、已出的牌） |
| PlayedCardsArea | `client/src/phaser/objects/PlayedCardsArea.ts` | 出牌区域 |
| PlayerAvatar | `client/src/phaser/objects/PlayerAvatar.ts` | 玩家头像/昵称 |
| Timer | `client/src/phaser/objects/Timer.ts` | 计时器 |
| BidPanel | `client/src/phaser/ui/BidPanel.ts` | 叫分界面 |
| ActionButtons | `client/src/phaser/ui/ActionButtons.ts` | 操作按钮（出牌/不出/提示） |
| ResultPanel | `client/src/phaser/ui/ResultPanel.ts` | 结算界面 |

## Vue-Phaser 通信模式

```typescript
// Vue Store → Phaser (通过 EventBus)
eventBus.emit('vue:updateCards', cards)

// Phaser → Vue Store (通过 EventBus)
eventBus.emit('phaser:cardSelected', { cardId })

// GameManager 监听 Phaser 事件，调用 Store 方法
eventBus.on('phaser:cardSelected', ({ cardId }) => {
  gameStore.selectCard(cardId)
})
```

## Socket.io 事件协议

### 房间事件

| 事件 | 方向 | 数据 |
|------|------|------|
| `room:create` | C→S | `{ baseScore, maxPlayers }` |
| `room:join` | C→S | `{ roomId }` |
| `room:leave` | C→S | - |
| `room:ready` | C→S | - |
| `room:quickMatch` | C→S | - |
| `room:joined` | S→C | `{ room, player }` |
| `room:playerJoined` | S→C | `{ player }` |
| `room:playerLeft` | S→C | `{ playerId }` |

### 游戏事件

| 事件 | 方向 | 数据 |
|------|------|------|
| `game:start` | C→S | - |
| `game:bid` | C→S | `{ score }` |
| `game:play` | C→S | `{ cards: Card[] }` |
| `game:pass` | C→S | - |
| `game:hint` | C→S | - |
| `game:reconnect` | C→S | - |
| `game:started` | S→C | `{ gameState }` |
| `game:dealt` | S→C | `{ cards: Card[] }` (仅发给自己) |
| `game:bid_turn` | S→C | `{ seat, timeout }` |
| `game:bid` | S→C | `{ bidInfo: { seat, score } }` |
| `game:landlord` | S→C | `{ landlordSeat, bottomCards, finalScore }` |
| `game:play_turn` | S→C | `{ seat, timeout }` |
| `game:played` | S→C | `{ seat, cards, remaining, pattern }` |
| `game:passed` | S→C | `{ seat }` |
| `game:ended` | S→C | `{ winner, results[], isSpring }` |
| `game:hint` | S→C | `{ cards: Card[] }` |

### 聊天事件

| 事件 | 方向 | 数据 |
|------|------|------|
| `chat:emoji` | C→S | `{ emojiId }` |
| `chat:quick` | C→S | `{ messageId }` |
| `chat:message` | S→C | `{ playerId, type, content }` |

## 游戏流程

```
1. 房间阶段
   room:create/join → room:ready → game:start

2. 叫地主阶段 (bidding)
   game:dealt → game:bid_turn → game:bid → game:landlord

3. 出牌阶段 (playing)
   game:play_turn → game:play/pass → ... → game:ended

4. 断线重连
   socket disconnect → 60秒超时 → game:reconnect → 恢复状态
```

## 牌型定义

| 牌型 | 英文标识 | 说明 |
|------|----------|------|
| 单张 | `single` | 任意一张牌 |
| 对子 | `pair` | 两张相同点数 |
| 三张 | `triple` | 三张相同点数 |
| 三带一 | `triple_one` | 三张+一张单牌 |
| 三带二 | `triple_two` | 三张+一对 |
| 顺子 | `straight` | 5张及以上连续（3-A，不含2和王） |
| 连对 | `straight_pair` | 3对及以上连续 |
| 飞机 | `plane` | 连续三张 |
| 飞机带翅膀 | `plane_wings` | 飞机+同数量单牌或对子 |
| 四带二 | `four_two` | 四张+两张单牌或两对 |
| 炸弹 | `bomb` | 四张相同点数 |
| 王炸 | `rocket` | 大小王 |

## 数据库表

| 表名 | 说明 |
|------|------|
| `users` | 用户信息（account, nickname, coins, level, stats） |
| `game_records` | 游戏记录（user_id, role, is_win, coin_change） |
| `transactions` | 交易记录（签到、游戏、破产补助） |

## 测试账号

| 账号 | 密码 |
|------|------|
| test1 | 8713849 |
| test2 | 8713849 |
| test3 | 8713849 |

## 调试命令

```bash
# 查看在线用户
docker exec -it doudizhu-redis redis-cli KEYS "online:*"

# 查看房间数据
docker exec -it doudizhu-redis redis-cli KEYS "room:*"

# 查看最近游戏记录
docker exec -it doudizhu-mysql mysql -uroot -proot123456 doudizhu \
  -e "SELECT * FROM game_records ORDER BY id DESC LIMIT 10;"

# 监控 Socket 事件
docker-compose logs -f server 2>&1 | grep -E "(Socket|room|game)"
```
