# 斗地主游戏项目学习文档

## 目录

1. [项目概览](#一项目概览)
2. [核心架构详解](#二核心架构详解)
3. [前端模块分析](#三前端模块分析)
4. [后端模块分析](#四后端模块分析)
5. [Socket.io 事件协议](#五socketio-事件协议详解)
6. [完整业务流程](#六完整业务流程)
7. [核心算法解析](#七核心算法解析)
8. [调试与测试指南](#八调试与测试指南)

---

## 一、项目概览

### 技术栈

| 层次 | 技术 | 用途 |
|------|------|------|
| **前端框架** | Vue 3 + TypeScript | 页面路由、状态管理、用户交互 |
| **游戏引擎** | Phaser 3 | 扑克牌渲染、动画、游戏交互 |
| **状态管理** | Pinia | 集中管理游戏状态、用户状态 |
| **后端框架** | Express + Node.js | REST API、静态资源 |
| **实时通信** | Socket.io | 游戏事件、房间同步 |
| **数据库** | MySQL | 用户数据、游戏记录持久化 |
| **缓存** | Redis | 在线状态、房间数据、会话 |

### 架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           前端架构                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │     Vue 3 Pages          Pinia Stores        Phaser 3 Engine    │   │
│  │  ┌─────────────┐      ┌──────────────┐     ┌───────────────┐    │   │
│  │  │ LoginPage   │      │ userStore    │     │ GameScene     │    │   │
│  │  │ LobbyPage   │◄────►│ roomStore    │◄───►│ UIScene       │    │   │
│  │  │ GamePage    │      │ gameStore    │     │ BootScene     │    │   │
│  │  │ ProfilePage │      │ socketStore  │     └───────────────┘    │   │
│  │  └─────────────┘      └──────────────┘            ▲              │   │
│  │                              ▲                    │              │   │
│  │                              │                    │              │   │
│  │                    ┌─────────┴────────────────────┘              │   │
│  │                    │        EventBus                             │   │
│  │                    │  (Vue ◄─► Phaser 双向通信)                   │   │
│  │                    └─────────────────────────────────────────────│   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                           Socket.io Client                              │
└────────────────────────────────────┼────────────────────────────────────┘
                                     │ WebSocket
                                     ▼
┌────────────────────────────────────┴────────────────────────────────────┐
│                           后端架构                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │   Express (REST API)              Socket.io Server              │   │
│  │  ┌─────────────────┐           ┌──────────────────────┐         │   │
│  │  │ /api/auth       │           │ socket/index.js      │         │   │
│  │  │ /api/user       │           │ socket/room.js       │         │   │
│  │  │ /api/coins      │           │ socket/game.js       │         │   │
│  │  │ /api/room       │           │ socket/chat.js       │         │   │
│  │  └─────────────────┘           └──────────────────────┘         │   │
│  │                                          │                       │   │
│  │                    ┌─────────────────────┴──────────────────┐    │   │
│  │                    │           游戏核心逻辑                   │    │   │
│  │                    │  ┌────────────────┐  ┌───────────────┐ │    │   │
│  │                    │  │ GameEngine.js  │  │CardValidator.js│    │   │
│  │                    │  │ (游戏状态机)    │  │ (牌型验证)     │ │    │   │
│  │                    │  └────────────────┘  └───────────────┘ │    │   │
│  │                    └────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                         │                         │                     │
│                    ┌────┴────┐              ┌─────┴─────┐               │
│                    │  MySQL  │              │   Redis   │               │
│                    │ (持久化) │              │ (缓存/状态)│               │
│                    └─────────┘              └───────────┘               │
└─────────────────────────────────────────────────────────────────────────┘
```

### 目录结构

```
doudizhu-game/
├── client/                      # 前端代码
│   ├── src/
│   │   ├── api/                 # Axios HTTP 请求封装
│   │   │   └── index.ts
│   │   ├── game/                # 游戏工具函数
│   │   │   ├── cardUtils.ts     # 洗牌、发牌、排序
│   │   │   ├── cardTypes.ts     # 牌型定义
│   │   │   ├── cardCompare.ts   # 牌型比较（客户端）
│   │   │   └── chatConstants.ts # 表情和快捷消息常量
│   │   ├── pages/               # 页面组件
│   │   │   ├── login/           # 登录页
│   │   │   ├── lobby/           # 大厅页
│   │   │   ├── game/            # 游戏页
│   │   │   └── profile/         # 个人中心
│   │   ├── phaser/              # Phaser 游戏引擎
│   │   │   ├── EventBus.ts      # 事件总线 ⭐
│   │   │   ├── GameManager.ts   # Phaser 管理器 ⭐
│   │   │   ├── scenes/          # 游戏场景
│   │   │   │   ├── BootScene.ts
│   │   │   │   ├── GameScene.ts ⭐
│   │   │   │   └── UIScene.ts   ⭐
│   │   │   ├── objects/         # 游戏对象
│   │   │   │   ├── Card.ts
│   │   │   │   ├── CardGroup.ts
│   │   │   │   └── PlayerAvatar.ts
│   │   │   └── ui/              # UI 组件
│   │   │       ├── BidPanel.ts
│   │   │       ├── ActionButtons.ts
│   │   │       └── ResultPanel.ts
│   │   ├── store/               # Pinia 状态管理
│   │   │   ├── game.ts          # 游戏状态 ⭐⭐
│   │   │   ├── room.ts          # 房间状态 ⭐
│   │   │   ├── socket.ts        # Socket 连接
│   │   │   └── user.ts          # 用户认证
│   │   └── types/               # TypeScript 类型定义
│   │       └── index.ts
│   └── package.json
│
├── server/                      # 后端代码
│   ├── src/
│   │   ├── app.js               # 应用入口
│   │   ├── config/              # 配置
│   │   │   └── index.js
│   │   ├── game/                # 游戏核心逻辑
│   │   │   ├── GameEngine.js    ⭐⭐
│   │   │   └── CardValidator.js ⭐⭐
│   │   ├── models/              # 数据模型
│   │   │   ├── db.js
│   │   │   ├── redis.js
│   │   │   └── User.js
│   │   ├── routes/              # REST API 路由
│   │   │   ├── auth.js
│   │   │   ├── user.js
│   │   │   ├── coins.js
│   │   │   └── room.js
│   │   └── socket/              # Socket 事件处理
│   │       ├── index.js         ⭐
│   │       ├── room.js          ⭐
│   │       ├── game.js          ⭐⭐
│   │       └── chat.js
│   └── sql/
│       └── init.sql             # 数据库初始化
│
└── docker-compose.yml
```

---

## 二、核心架构详解

### 2.1 Vue-Phaser 集成模式

Vue 3 和 Phaser 3 是两个独立的框架，需要通过 **EventBus** 进行双向通信。

```typescript
// EventBus.ts - 事件总线（单例模式）
class GameEventBus extends Phaser.Events.EventEmitter {
  private static instance: GameEventBus | null = null

  static getInstance(): GameEventBus {
    if (!GameEventBus.instance) {
      GameEventBus.instance = new GameEventBus()
    }
    return GameEventBus.instance
  }
}
```

**通信流程：**

```
┌─────────────┐                ┌─────────────┐
│   Vue Store │                │   Phaser    │
│  (game.ts)  │                │ (GameScene) │
└──────┬──────┘                └──────┬──────┘
       │                              │
       │ 1. 收到 Socket 事件           │
       │    (game:dealt)              │
       │                              │
       ▼                              │
  更新 myCards                        │
       │                              │
       │ 2. 通过 EventBus 发送         │
       │    eventBus.emit(            │
       │      'vue:cardsDealt',       │
       │      { cards, seat }         │
       │    )                         │
       │                              │
       └──────────────────────────────►
                                      │
                              3. 监听事件
                              eventBus.on(
                                'vue:cardsDealt',
                                this.handleDealt
                              )
                                      │
                                      ▼
                              4. 渲染扑克牌
                              this.cardGroup.
                                setCards(cards)
```

**事件类型定义：**

```typescript
// EventBus.ts 中定义的所有事件
export interface GameEvents {
  // Vue -> Phaser 事件
  'vue:gameStateChanged': { state: GameState }
  'vue:cardsDealt': { cards: Card[]; seat: number }
  'vue:bidTurn': { seat: number; timeout: number }
  'vue:landlordDecided': { seat: number; bottomCards: Card[]; bidScore: number }
  'vue:playTurn': { seat: number; timeout: number }
  'vue:cardPlayed': { playInfo: PlayInfo }
  'vue:gameEnded': { winnerId: number; results: GameResult[] }

  // Phaser -> Vue 事件
  'phaser:cardSelected': { cardId: number }
  'phaser:cardDeselected': { cardId: number }
  'phaser:bid': { score: number }
  'phaser:playCards': { cards: Card[] }
  'phaser:pass': void
}
```

### 2.2 状态管理设计

使用 Pinia 管理四个核心 Store：

```
┌─────────────────────────────────────────────────────────────┐
│                      Pinia Stores                           │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐│
│  │ userStore │  │socketStore│  │ roomStore │  │ gameStore ││
│  ├───────────┤  ├───────────┤  ├───────────┤  ├───────────┤│
│  │ token     │  │ socket    │  │ roomList  │  │ gameState ││
│  │ user      │  │ isConnected│ │currentRoom│  │ myCards   ││
│  │ isLoggedIn│  │ onlineUsers│ │ isMatching│  │ isMyTurn  ││
│  ├───────────┤  ├───────────┤  ├───────────┤  ├───────────┤│
│  │ login()   │  │ connect() │  │ joinRoom()│  │ bid()     ││
│  │ logout()  │  │ emit()    │  │ leaveRoom()│ │ playCards()│
│  │ register()│  │ on()      │  │ quickMatch()││ pass()    ││
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘│
└─────────────────────────────────────────────────────────────┘
         │              │              │              │
         └──────────────┴──────────────┴──────────────┘
                               │
                     相互依赖，协同工作
```

---

## 三、前端模块分析

### 3.1 gameStore 详解

`client/src/store/game.ts` 是前端最核心的状态管理模块。

**核心状态：**

```typescript
// 游戏状态
const gameState = ref<GameState | null>(null)

// 我的手牌（已排序，从大到小）
const myCards = ref<Card[]>([])

// 已选中的牌 ID
const selectedCardIds = ref<number[]>([])

// 是否轮到我操作
const isMyTurn = ref(false)

// 我的座位号（直接存储，避免每次从 gameState 计算）
const mySeatRef = ref<number>(-1)

// 监听器初始化标志（防止重复注册事件）
const listenersInitialized = ref(false)
```

**关键方法：**

```typescript
// 初始化所有 Socket 事件监听
function initGameListeners(): void {
  if (listenersInitialized.value) return  // 防重复
  listenersInitialized.value = true

  // 发牌 - 直接存储座位号
  socketStore.on('game:dealt', (data) => {
    mySeatRef.value = data.seat
    myCards.value = sortCards(data.cards)
    eventBus.emitEvent('vue:cardsDealt', data)
  })

  // 叫分回合
  socketStore.on('game:bid_turn', (data) => {
    isMyTurn.value = data.seat === mySeat.value
    eventBus.emitEvent('vue:bidTurn', data)
  })

  // 地主确定
  socketStore.on('game:landlord_decided', (data) => {
    if (data.seat === mySeat.value) {
      myCards.value = sortCards([...myCards.value, ...data.bottomCards])
      isMyTurn.value = true  // 地主先出牌
    }
    eventBus.emitEvent('vue:landlordDecided', data)
  })

  // 有人出牌
  socketStore.on('game:played', ({ playInfo }) => {
    if (playInfo.seat === mySeat.value && !playInfo.isPass) {
      const playedIds = playInfo.cards.map(c => c.id)
      myCards.value = myCards.value.filter(c => !playedIds.includes(c.id))
    }
    eventBus.emitEvent('vue:cardPlayed', { playInfo })
  })
}

// 出牌
async function playCards(): Promise<void> {
  const cards = selectedCards.value
  await socketStore.emit('game:play', { cards })
  isMyTurn.value = false
}

// 不出
async function pass(): Promise<void> {
  await socketStore.emit('game:pass', {})
  isMyTurn.value = false
  clearSelection()
}
```

### 3.2 Phaser 场景架构

```
┌─────────────────────────────────────────────────┐
│                  Phaser Game                    │
│  ┌─────────────────────────────────────────┐   │
│  │           BootScene (预加载)             │   │
│  │  - 加载扑克牌图片                        │   │
│  │  - 加载音效                              │   │
│  │  - 加载完成后启动 GameScene              │   │
│  └─────────────────────────────────────────┘   │
│                      │                          │
│                      ▼                          │
│  ┌─────────────────────────────────────────┐   │
│  │          GameScene (游戏主场景)          │   │
│  │  - 绿色牌桌背景                          │   │
│  │  - 三个玩家头像 (PlayerAvatar)           │   │
│  │  - 手牌区域 (CardGroup)                  │   │
│  │  - 三个出牌区域 (PlayedCardsArea)        │   │
│  │  - 底牌显示区                            │   │
│  │  - 计时器                                │   │
│  └─────────────────────────────────────────┘   │
│                      │                          │
│                      ▼ (并行运行)               │
│  ┌─────────────────────────────────────────┐   │
│  │           UIScene (UI 层)                │   │
│  │  - 叫分面板 (BidPanel)                   │   │
│  │  - 操作按钮 (ActionButtons)              │   │
│  │  - 结算面板 (ResultPanel)                │   │
│  │  - 聊天面板 (ChatPanel)                  │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

**座位布局：**

```
          座位 1 (上方)
         ┌───────────┐
         │   玩家B   │
         │   头像    │
         │  [出牌区] │
         └───────────┘

座位 2 (左侧)              座位 0 (右侧/底部=自己)
┌───────────┐              ┌───────────────────────┐
│   玩家C   │              │       [我的出牌区]    │
│   头像    │              │ ┌───┬───┬───┬───┬───┐ │
│  [出牌区] │              │ │ K │ Q │ J │10 │ 9 │ │ ← 手牌
└───────────┘              │ └───┴───┴───┴───┴───┘ │
                           │       玩家A (我)       │
                           └───────────────────────┘
```

### 3.3 Card 组件交互

```typescript
// Card.ts - 单张扑克牌
class Card extends Phaser.GameObjects.Container {
  private isSelected: boolean = false

  constructor(scene: Phaser.Scene, x: number, y: number, cardData: CardData) {
    super(scene, x, y)

    // 创建牌面图片
    this.cardImage = scene.add.image(0, 0, 'cards', cardData.frameIndex)

    // 设置交互
    this.setInteractive({ useHandCursor: true })

    // 点击事件 - 切换选中状态
    this.on('pointerdown', () => {
      this.toggleSelected()
    })
  }

  toggleSelected(): void {
    this.isSelected = !this.isSelected

    // 选中时上移 20 像素
    if (this.isSelected) {
      this.y -= 20
      eventBus.emit('phaser:cardSelected', { cardId: this.cardData.id })
    } else {
      this.y += 20
      eventBus.emit('phaser:cardDeselected', { cardId: this.cardData.id })
    }
  }
}
```

---

## 四、后端模块分析

### 4.1 GameEngine 游戏引擎

`server/src/game/GameEngine.js` 是游戏的核心状态机。

**游戏阶段：**

```javascript
const GamePhase = {
  DEALING: 'dealing',   // 发牌中
  BIDDING: 'bidding',   // 叫地主
  PLAYING: 'playing',   // 出牌
  FINISHED: 'finished', // 结束
}
```

**核心属性：**

```javascript
class GameEngine {
  constructor(roomId, players, baseScore = 100) {
    this.roomId = roomId
    this.gameId = uuidv4()
    this.baseScore = baseScore
    this.phase = GamePhase.DEALING

    // 玩家数据
    this.players = players.map((p, index) => ({
      id: p.id,
      nickname: p.nickname,
      seat: index,
      role: null,        // 'landlord' 或 'farmer'
      cards: [],         // 手牌
      cardCount: 0,
      isOnline: true,
    }))

    // 游戏状态
    this.currentSeat = 0      // 当前操作玩家座位
    this.landlordSeat = -1    // 地主座位
    this.bottomCards = []     // 底牌
    this.bidScore = 0         // 叫分分数
    this.bidHistory = []      // 叫分历史

    // 出牌状态
    this.lastPlay = null      // 上一手牌型
    this.lastPlaySeat = -1    // 上一手出牌座位
    this.passCount = 0        // 连续不出次数

    // 倍数
    this.multiplier = 1       // 倍数
    this.bombCount = 0        // 炸弹数量
    this.isSpring = false     // 春天
  }
}
```

**发牌算法 (Fisher-Yates)：**

```javascript
dealCards() {
  // 1. 创建 54 张牌
  const deck = this.shuffleDeck(this.createDeck())

  // 2. 每人 17 张
  for (let i = 0; i < 51; i++) {
    this.players[i % 3].cards.push(deck[i])
  }

  // 3. 底牌 3 张
  this.bottomCards = deck.slice(51, 54)

  // 4. 排序每个玩家的手牌
  this.players.forEach((player) => {
    this.sortCards(player.cards)
    player.cardCount = player.cards.length
  })

  // 5. 随机选择第一个叫地主的人
  this.currentSeat = Math.floor(Math.random() * 3)
  this.phase = GamePhase.BIDDING
}

// Fisher-Yates 洗牌
shuffleDeck(cards) {
  const shuffled = [...cards]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}
```

**叫地主逻辑：**

```javascript
bid(playerId, score) {
  // 验证
  if (this.phase !== GamePhase.BIDDING) return { success: false }
  if (score > 0 && score <= this.bidScore) return { success: false }

  // 记录叫分
  this.bidHistory.push({ seat: this.currentSeat, score })
  if (score > 0) {
    this.bidScore = score
    this.lastBidSeat = this.currentSeat
  }

  // 判断结果
  return this.checkBidResult()
}

checkBidResult() {
  // 叫 3 分直接成为地主
  if (this.bidScore === 3) {
    return this.decideLandlord(this.lastBidSeat)
  }

  // 三人都叫过
  if (this.bidHistory.length >= 3) {
    if (this.bidScore === 0) {
      return { decided: true, redeal: true }  // 重新发牌
    }
    return this.decideLandlord(this.lastBidSeat)
  }

  return { decided: false }
}

decideLandlord(seat) {
  this.landlordSeat = seat
  this.phase = GamePhase.PLAYING
  this.currentSeat = seat

  // 设置角色
  this.players.forEach((p) => {
    p.role = p.seat === seat ? 'landlord' : 'farmer'
  })

  // 地主获得底牌
  const landlord = this.players.find((p) => p.seat === seat)
  landlord.cards = [...landlord.cards, ...this.bottomCards]
  this.sortCards(landlord.cards)
  landlord.cardCount = landlord.cards.length  // 20 张

  // 初始倍数 = 叫分
  this.multiplier = this.bidScore

  return { decided: true, landlordSeat: seat, ... }
}
```

**出牌逻辑：**

```javascript
playCards(playerId, cardIds) {
  // 1. 验证牌在手中
  const playedCards = []
  for (const cardId of cardIds) {
    const card = player.cards.find((c) => c.id === cardId)
    if (!card) return { success: false, error: '你没有这张牌' }
    playedCards.push(card)
  }

  // 2. 验证牌型
  const pattern = CardValidator.getCardPattern(playedCards)
  if (!pattern) return { success: false, error: '无效的牌型' }

  // 3. 验证能否压过
  if (this.lastPlay && this.lastPlaySeat !== this.currentSeat) {
    if (!CardValidator.canBeat(pattern, this.lastPlay)) {
      return { success: false, error: '出的牌压不过上家' }
    }
  }

  // 4. 记录炸弹倍数
  if (pattern.type === 'bomb' || pattern.type === 'rocket') {
    this.bombCount++
    this.multiplier *= 2
  }

  // 5. 从手牌中移除
  player.cards = player.cards.filter((c) => !cardIds.includes(c.id))
  player.cardCount = player.cards.length

  // 6. 更新出牌状态
  this.lastPlay = pattern
  this.lastPlaySeat = this.currentSeat
  this.passCount = 0

  // 7. 检查游戏是否结束
  if (player.cardCount === 0) {
    return this.endGame(player)
  }

  // 8. 下一个玩家
  this.currentSeat = (this.currentSeat + 1) % 3

  return { success: true, pattern, cards: playedCards }
}
```

**结算逻辑：**

```javascript
endGame(winner) {
  this.phase = GamePhase.FINISHED

  // 检查春天
  const landlord = this.players.find((p) => p.role === 'landlord')
  const farmers = this.players.filter((p) => p.role === 'farmer')

  if (winner.role === 'landlord') {
    // 地主赢，农民一张没出 → 春天
    if (farmers.every((f) => f.cardCount === 17)) {
      this.isSpring = true
      this.multiplier *= 2
    }
  } else {
    // 农民赢，地主只出了底牌 → 反春天
    if (landlord.cardCount === 17) {
      this.isSpring = true
      this.multiplier *= 2
    }
  }

  // 计算积分变化
  const baseChange = this.baseScore * this.multiplier
  const results = []

  for (const player of this.players) {
    let coinChange = 0
    if (player.role === 'landlord') {
      // 地主赢/输双倍
      coinChange = winner.role === 'landlord' ? baseChange * 2 : -baseChange * 2
    } else {
      // 农民赢/输单倍
      coinChange = winner.role === 'farmer' ? baseChange : -baseChange
    }

    results.push({
      playerId: player.id,
      role: player.role,
      isWin: player.role === winner.role,
      coinChange,
    })
  }

  return { gameOver: true, results, ... }
}
```

### 4.2 CardValidator 牌型验证器

`server/src/game/CardValidator.js` 负责所有牌型的识别和比较。

**支持的牌型（12 种）：**

| 牌型 | 英文标识 | 牌数 | 说明 |
|------|----------|------|------|
| 单张 | `single` | 1 | 任意一张 |
| 对子 | `pair` | 2 | 两张相同点数 |
| 三张 | `triple` | 3 | 三张相同点数 |
| 三带一 | `triple_one` | 4 | 三张 + 一张 |
| 三带二 | `triple_two` | 5 | 三张 + 一对 |
| 顺子 | `straight` | 5+ | 连续单牌（不含 2 和王） |
| 连对 | `straight_pair` | 6+ | 连续对子（不含 2） |
| 飞机 | `plane` | 6+ | 连续三张 |
| 飞机带翅膀 | `plane_wings` | 8+ | 飞机 + 同数量单牌/对子 |
| 四带二 | `four_two` | 6/8 | 四张 + 两单/两对 |
| 炸弹 | `bomb` | 4 | 四张相同点数 |
| 王炸 | `rocket` | 2 | 大小王 |

**牌型识别：**

```javascript
function getCardPattern(cards) {
  if (!cards || cards.length === 0) return null

  // 王炸（最高优先级）
  if (isRocket(cards)) {
    return { type: 'rocket', cards: [...cards], mainValue: 17 }
  }

  // 炸弹
  if (isBomb(cards)) {
    return { type: 'bomb', cards: [...cards], mainValue: cards[0].value }
  }

  // 单张
  if (cards.length === 1) {
    return { type: 'single', cards: [...cards], mainValue: cards[0].value }
  }

  // 对子
  if (cards.length === 2) {
    if (cards[0].value === cards[1].value) {
      return { type: 'pair', cards: [...cards], mainValue: cards[0].value }
    }
    return null
  }

  // 三张
  if (cards.length === 3) {
    if (cards.every((c) => c.value === cards[0].value)) {
      return { type: 'triple', cards: [...cards], mainValue: cards[0].value }
    }
    return null
  }

  // ... 更多牌型检查
}
```

**顺子检查：**

```javascript
function checkStraight(cards) {
  if (cards.length < 5) return null

  // 不能包含 2 和王
  if (cards.some((c) => c.value >= 15)) return null

  const values = cards.map((c) => c.value).sort((a, b) => a - b)

  // 检查值唯一
  const uniqueValues = [...new Set(values)]
  if (uniqueValues.length !== cards.length) return null

  // 检查连续
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== values[i - 1] + 1) return null
  }

  return {
    type: 'straight',
    cards: [...cards],
    mainValue: values[values.length - 1],  // 最大值
    length: cards.length,
  }
}
```

**牌型比较：**

```javascript
function canBeat(patternA, patternB) {
  if (!patternB) return true  // 没有上家牌可以随便出

  // 王炸最大
  if (patternA.type === 'rocket') return true
  if (patternB.type === 'rocket') return false

  // 炸弹比较
  if (patternA.type === 'bomb' && patternB.type === 'bomb') {
    return patternA.mainValue > patternB.mainValue
  }

  // 炸弹压制非炸弹
  if (patternA.type === 'bomb') return true
  if (patternB.type === 'bomb') return false

  // 普通牌型必须类型相同
  if (patternA.type !== patternB.type) return false

  // 顺子等需要长度相同
  if (['straight', 'straight_pair', 'plane'].includes(patternA.type)) {
    if (patternA.length !== patternB.length) return false
  }

  // 比较主牌点数
  return patternA.mainValue > patternB.mainValue
}
```

---

## 五、Socket.io 事件协议详解

### 5.1 事件总览

```
┌─────────────────────────────────────────────────────────────────┐
│                     Socket.io 事件分类                          │
├─────────────────────────────────────────────────────────────────┤
│  房间事件 (room:*)                                              │
│  ├── room:create    创建房间                                    │
│  ├── room:join      加入房间                                    │
│  ├── room:leave     离开房间                                    │
│  ├── room:ready     准备/取消准备                                │
│  ├── room:kick      踢出玩家                                    │
│  └── room:quickMatch 快速匹配                                   │
├─────────────────────────────────────────────────────────────────┤
│  游戏事件 (game:*)                                              │
│  ├── game:start     开始游戏                                    │
│  ├── game:started   游戏已开始（广播）                           │
│  ├── game:dealt     发牌（私发）                                │
│  ├── game:bid_turn  叫分回合开始（广播）                         │
│  ├── game:bid       叫分                                        │
│  ├── game:landlord_decided 地主确定（广播）                      │
│  ├── game:play_turn 出牌回合开始（广播）                         │
│  ├── game:play      出牌                                        │
│  ├── game:pass      不出                                        │
│  ├── game:played    有人出牌（广播）                             │
│  ├── game:hint      获取提示                                    │
│  ├── game:ended     游戏结束（广播）                             │
│  ├── game:reconnect 重连                                        │
│  └── game:check-pending 检查未完成游戏                          │
├─────────────────────────────────────────────────────────────────┤
│  玩家状态事件 (player:*)                                        │
│  ├── player:offline 玩家离线                                    │
│  └── player:online  玩家上线                                    │
├─────────────────────────────────────────────────────────────────┤
│  聊天事件 (chat:*)                                              │
│  ├── chat:emoji     发送表情                                    │
│  └── chat:quick     发送快捷消息                                │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 关键事件详解

#### `game:dealt` - 发牌

**特点：** 只发送给对应玩家（手牌是私密数据）

```javascript
// 服务端发送
for (const player of game.players) {
  const socketId = await redis.get(`online:${player.id}`)
  io.to(socketId).emit('game:dealt', {
    cards: player.cards,  // 只发给自己的牌
    seat: player.seat,
  })
}

// 客户端接收
socketStore.on('game:dealt', (data) => {
  mySeatRef.value = data.seat  // 直接存储座位
  myCards.value = sortCards(data.cards)
  eventBus.emitEvent('vue:cardsDealt', data)
})
```

#### `game:bid_turn` - 叫分回合

```javascript
// 服务端广播
io.to(roomId).emit('game:bid_turn', {
  seat: game.currentSeat,
  timeout: 30000,  // 30 秒超时
})

// 客户端处理
socketStore.on('game:bid_turn', (data) => {
  isMyTurn.value = data.seat === mySeat.value
  eventBus.emitEvent('vue:bidTurn', data)  // 通知 Phaser 显示叫分面板
})
```

#### `game:play` - 出牌请求

```javascript
// 客户端发送
await socketStore.emit('game:play', { cards: selectedCards })

// 服务端处理
socket.on('game:play', async (data, callback) => {
  const cardIds = data.cards.map((c) => c.id)
  const result = game.playCards(user.id, cardIds)

  if (!result.success) {
    return callback({ error: result.error })
  }

  // 广播出牌
  io.to(roomId).emit('game:played', {
    playInfo: {
      seat: player.seat,
      cards: result.cards,
      pattern: result.pattern,
      isPass: false,
    },
  })

  if (result.gameOver) {
    await handleGameEnd(io, roomId, game, result)
  } else {
    startPlayTurn(io, roomId, game)
  }

  callback({ success: true })
})
```

#### `game:ended` - 游戏结束

```javascript
// 服务端广播
io.to(roomId).emit('game:ended', {
  winnerId: result.winnerId,
  results: [
    { playerId: 1, role: 'landlord', isWin: true, coinChange: +400 },
    { playerId: 2, role: 'farmer', isWin: false, coinChange: -200 },
    { playerId: 3, role: 'farmer', isWin: false, coinChange: -200 },
  ],
  multiplier: 2,
  isSpring: false,
  bombCount: 0,
  reason: undefined,  // 或 'disconnect_timeout'
})

// 客户端处理
socketStore.on('game:ended', (data) => {
  eventBus.emitEvent('vue:gameEnded', data)  // 显示结算面板
})
```

### 5.3 超时机制

```javascript
// 开始出牌回合
function startPlayTurn(io, roomId, game) {
  io.to(roomId).emit('game:play_turn', {
    seat: game.currentSeat,
    timeout: 30000,
  })

  // 设置 30 秒超时
  game.turnTimeout = setTimeout(async () => {
    // 超时自动处理
    const result = game.handleTimeout()

    if (result.isPass) {
      io.to(roomId).emit('game:played', {
        playInfo: { seat: currentSeat, cards: [], isPass: true },
      })
    } else {
      io.to(roomId).emit('game:played', {
        playInfo: { seat: currentSeat, cards: result.cards, isPass: false },
      })
    }

    if (result.gameOver) {
      await handleGameEnd(io, roomId, game, result)
    } else {
      startPlayTurn(io, roomId, game)
    }
  }, 30000)
}
```

---

## 六、完整业务流程

### 6.1 完整游戏时序图

```
┌──────────┐          ┌──────────┐          ┌──────────┐          ┌──────────┐
│  玩家 A  │          │  玩家 B  │          │  玩家 C  │          │   服务器  │
└────┬─────┘          └────┬─────┘          └────┬─────┘          └────┬─────┘
     │                      │                      │                      │
     │ ─── room:create ───────────────────────────────────────────────→ │
     │ ←────────────────────── room:created ────────────────────────── │
     │                      │                      │                      │
     │                      │ ─── room:join ───────────────────────→  │
     │ ←────────────────────── room:playerJoined ─────────────────────  │
     │                      │ ←─── room:joined ─────────────────────── │
     │                      │                      │                      │
     │                      │                      │ ─── room:join ───→ │
     │ ←────────────────────── room:playerJoined ─────────────────────  │
     │                      │ ←─── room:playerJoined ─────────────────  │
     │                      │                      │ ←── room:joined ── │
     │                      │                      │                      │
     │ ─── room:ready ────────────────────────────────────────────────→│
     │                      │ ─── room:ready ──────────────────────→  │
     │                      │                      │ ─── room:ready ──→│
     │                      │                      │                      │
     │ ─── game:start ───────────────────────────────────────────────→ │
     │ ←─────────────────── game:started (gameState) ─────────────────  │
     │ ←─── game:dealt (17张, seat=0) ────────────────────────────────  │
     │                      │ ←── game:dealt (17张, seat=1) ──────────  │
     │                      │                      │ ←── game:dealt ── │
     │                      │                      │                      │
     │ ←─────────────────── game:bid_turn (seat=0) ───────────────────  │
     │ ─── game:bid (score=1) ────────────────────────────────────────→│
     │ ←─────────────────── game:bid (bidInfo) ───────────────────────  │
     │                      │                      │                      │
     │ ←─────────────────── game:bid_turn (seat=1) ───────────────────  │
     │                      │ ─── game:bid (score=3) ─────────────────→│
     │ ←─────────────────── game:bid (bidInfo) ───────────────────────  │
     │ ←─── game:landlord_decided (seat=1, 底牌, bidScore=3) ─────────  │
     │                      │                      │                      │
     │ ←─────────────────── game:play_turn (seat=1) ──────────────────  │
     │                      │ ─── game:play (cards) ──────────────────→│
     │ ←─────────────────── game:played (playInfo) ───────────────────  │
     │                      │                      │                      │
     │ ←─────────────────── game:play_turn (seat=2) ──────────────────  │
     │                      │                      │ ─── game:pass ───→│
     │ ←─────────────────── game:played (isPass=true) ────────────────  │
     │                      │                      │                      │
     │ ←─────────────────── game:play_turn (seat=0) ──────────────────  │
     │ ─── game:play (cards) ─────────────────────────────────────────→│
     │ ←─────────────────── game:played (playInfo) ───────────────────  │
     │                      │                      │                      │
     │  ... （继续出牌直到有人出完）...                                    │
     │                      │                      │                      │
     │ ←─────────────────── game:ended (results) ─────────────────────  │
     │                      │                      │                      │
```

### 6.2 倍数计算示例

```
场景 1：普通局
━━━━━━━━━━━━━━━━━━━━━━
底分：100
叫分：2 分
炸弹：0 个
春天：否
地主赢

计算：
multiplier = 2 × (2^0) × 1 = 2
地主：+100 × 2 × 2 = +400
农民1：-100 × 2 = -200
农民2：-100 × 2 = -200


场景 2：炸弹局
━━━━━━━━━━━━━━━━━━━━━━
底分：500
叫分：3 分
炸弹：2 个
春天：否
农民赢

计算：
multiplier = 3 × (2^2) × 1 = 12
地主：-500 × 12 × 2 = -12000
农民1：+500 × 12 = +6000
农民2：+500 × 12 = +6000


场景 3：春天局
━━━━━━━━━━━━━━━━━━━━━━
底分：100
叫分：1 分
炸弹：0 个
春天：是（农民没出过牌）
地主赢

计算：
multiplier = 1 × (2^0) × 2 = 2
地主：+100 × 2 × 2 = +400
农民1：-100 × 2 = -200
农民2：-100 × 2 = -200
```

### 6.3 断线重连流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         断线重连流程                                     │
└─────────────────────────────────────────────────────────────────────────┘

1. 玩家断线检测
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Socket disconnect 事件
        │
        ▼
   检查 user_room:{userId}
        │
        ├─── 游戏进行中 (room.status === 'playing')
        │         │
        │         ▼
        │    生成重连 Token
        │    Redis: reconnect:{userId} = { roomId, token, time } EX 60
        │    标记 player.isOnline = false
        │    广播 player:offline
        │    启动 60 秒超时定时器
        │
        └─── 游戏未开始
                  │
                  ▼
             直接移除玩家，广播 room:playerLeft


2. 玩家重连
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   用户重新连接 + 认证成功
        │
        ▼
   检查 reconnect:{userId}
        │
        ├─── 存在重连信息
        │         │
        │         ▼
        │    取消 60 秒超时定时器
        │    恢复 player.isOnline = true
        │    socket.join(roomId)
        │    广播 player:online
        │    发送完整游戏状态 + 手牌
        │    清除 reconnect:{userId}
        │
        └─── 无重连信息
                  │
                  ▼
             正常连接流程


3. 重连超时 (60 秒)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   超时定时器触发
        │
        ▼
   断线玩家判负
        │
        ▼
   计算积分（断线方输，对方赢）
        │
        ▼
   广播 game:ended (reason: 'disconnect_timeout')
        │
        ▼
   更新数据库，清理房间
```

---

## 七、核心算法解析

### 7.1 Fisher-Yates 洗牌算法

**原理：** 从最后一个元素开始，与随机位置的元素交换，逐步向前。

```javascript
shuffleDeck(cards) {
  const shuffled = [...cards]
  for (let i = shuffled.length - 1; i > 0; i--) {
    // 生成 0 到 i 之间的随机索引
    const j = Math.floor(Math.random() * (i + 1))
    // 交换 i 和 j 位置的元素
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}
```

**时间复杂度：** O(n)
**空间复杂度：** O(n)（创建新数组）

### 7.2 牌点数值映射

```javascript
const RANK_VALUES = {
  3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10,
  J: 11, Q: 12, K: 13, A: 14,
  2: 15,        // 2 比 A 大
  small: 16,    // 小王
  big: 17,      // 大王
}
```

### 7.3 出牌提示算法

```javascript
function getHint(handCards, lastPlay) {
  // 1. 找出所有能压过的牌型
  const patterns = findBeatingPatterns(handCards, lastPlay)

  if (patterns.length === 0) return null

  // 2. 优先出非炸弹（保留炸弹）
  const nonBombs = patterns.filter((p) => p.type !== 'bomb' && p.type !== 'rocket')
  if (nonBombs.length > 0) {
    // 返回最小能压过的牌
    return nonBombs[0].cards
  }

  // 3. 没有普通牌能压过，才出炸弹
  return patterns[0].cards
}

function findBiggerSingles(cards, minValue) {
  const results = []
  const seen = new Set()

  for (const card of cards) {
    if (card.value > minValue && !seen.has(card.value)) {
      seen.add(card.value)
      results.push({
        type: 'single',
        cards: [card],
        mainValue: card.value
      })
    }
  }

  // 从小到大排序（优先出小的）
  return results.sort((a, b) => a.mainValue - b.mainValue)
}
```

---

## 八、调试与测试指南

### 8.1 启动服务

```bash
# 1. 启动后端 (Docker)
docker-compose up -d

# 查看后端日志
docker-compose logs -f server

# 2. 启动前端
cd client
npm install
npm run dev  # 访问 http://localhost:8081
```

### 8.2 测试账号

| 账号 | 密码 |
|------|------|
| test1 | 8713849 |
| test2 | 8713849 |
| test3 | 8713849 |

### 8.3 Redis 调试命令

```bash
# 进入 Redis CLI
docker exec -it doudizhu-redis redis-cli

# 查看在线用户
KEYS "online:*"
SMEMBERS "online_users"

# 查看房间数据
KEYS "room:*"
GET "room:xxxxx"

# 查看用户所在房间
GET "user_room:1"

# 查看重连信息
KEYS "reconnect:*"
GET "reconnect:1"
```

### 8.4 MySQL 调试命令

```bash
# 进入 MySQL
docker exec -it doudizhu-mysql mysql -uroot -proot123456 doudizhu

# 查看用户
SELECT id, account, nickname, coins FROM users;

# 查看最近游戏记录
SELECT * FROM game_records ORDER BY id DESC LIMIT 10;

# 查看交易记录
SELECT * FROM transactions ORDER BY id DESC LIMIT 10;
```

### 8.5 前端调试

```javascript
// 在浏览器控制台查看 EventBus 事件
window.__PHASER_EVENT_BUS__.on('vue:cardPlayed', console.log)

// 查看 Store 状态
const gameStore = window.__pinia__.state.value.game
console.log(gameStore.myCards)
console.log(gameStore.gameState)
```

### 8.6 模拟多玩家

1. 打开 3 个浏览器标签（或无痕窗口）
2. 分别登录 test1, test2, test3
3. test1 创建房间
4. test2, test3 加入房间
5. 全部准备，test1 开始游戏
6. 观察 Socket 事件和状态同步

### 8.7 常见问题排查

| 问题 | 检查点 |
|------|--------|
| 连接失败 | 检查 token 是否过期，后端服务是否启动 |
| 出牌失败 | 检查牌型验证日志，确认牌在手中 |
| 界面不更新 | 检查 EventBus 事件是否正确触发 |
| 座位显示错误 | 检查 mySeatRef 是否正确设置 |
| 重连失败 | 检查 Redis reconnect 记录 |

---

## 附录：关键文件索引

| 文件 | 职责 | 重要程度 |
|------|------|----------|
| `server/src/game/GameEngine.js` | 游戏核心状态机 | ⭐⭐⭐ |
| `server/src/game/CardValidator.js` | 牌型验证和比较 | ⭐⭐⭐ |
| `server/src/socket/game.js` | 游戏 Socket 事件处理 | ⭐⭐⭐ |
| `client/src/store/game.ts` | 前端游戏状态管理 | ⭐⭐⭐ |
| `client/src/phaser/EventBus.ts` | Vue-Phaser 通信 | ⭐⭐ |
| `client/src/phaser/GameManager.ts` | Phaser 生命周期管理 | ⭐⭐ |
| `client/src/phaser/scenes/GameScene.ts` | 游戏主场景渲染 | ⭐⭐ |
| `server/src/socket/room.js` | 房间 Socket 事件处理 | ⭐⭐ |
| `client/src/store/room.ts` | 前端房间状态管理 | ⭐ |
| `client/src/store/socket.ts` | Socket 连接管理 | ⭐ |

---

**文档生成时间：** 2025-01-19

**建议学习路径：**
1. 运行项目，体验完整游戏流程
2. 阅读 GameEngine.js 理解游戏规则
3. 阅读 game.ts 理解前端状态管理
4. 阅读 EventBus.ts 理解 Vue-Phaser 通信
5. 用测试账号调试完整游戏流程
