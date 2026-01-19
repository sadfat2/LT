# 斗地主游戏 Bug 修复记录

**日期**: 2026-01-19
**版本**: 1.0.1

---

## 修复概览

| 问题 | 严重程度 | 状态 |
|------|----------|------|
| 所有玩家断线后游戏不结束 | 中 | ✅ 已修复 |
| 选牌后出牌按钮不启用 | 高 | ✅ 已修复 |
| 叫分气泡不显示 | 低 | ✅ 已修复 |
| 第一个玩家叫地主面板不显示 | 高 | ✅ 已修复 |
| 第一个玩家无法出牌 | 高 | ✅ 已修复 |
| Card.ts 动画报错 | 中 | ✅ 已修复 |

---

## Bug 1: 所有玩家断线后游戏不结束

### 问题描述
当所有玩家都断开连接后，服务器仍然等待 60 秒超时才结束游戏，造成资源浪费。

### 根本原因
断线处理逻辑只为每个玩家设置 60 秒超时，没有检测是否所有玩家都已离线。

### 修复方案
在设置断线超时前，检查是否所有玩家都已离线，如果是则立即清理游戏。

### 修改文件
- `server/src/socket/index.js`
- `server/src/socket/game.js`

### 关键代码
```javascript
// server/src/socket/index.js
const allOffline = room.players.every((p) => !p.isOnline)
if (allOffline) {
  console.log(`[Socket] 所有玩家都已离线，立即结束游戏 roomId=${roomId}`)
  if (game) {
    await handleAllPlayersDisconnected(io, roomId, game)
  } else {
    // 即使游戏实例不存在也清理数据
    for (const player of room.players) {
      await redis.del(`user_room:${player.id}`)
      await redis.del(`reconnect:${player.id}`)
    }
    await redis.del(`room:${roomId}`)
  }
  return
}
```

---

## Bug 2: 选牌后出牌按钮不启用

### 问题描述
在出牌阶段，玩家选中牌后，"出牌"按钮仍然保持禁用状态。

### 根本原因
`GameManager` 没有监听 `selectedCardIds` 的变化来更新按钮状态。

### 修复方案
添加 watcher 监听选中牌的变化，发送 `ui:updatePlayButton` 事件更新按钮状态。

### 修改文件
- `client/src/phaser/GameManager.ts`
- `client/src/phaser/EventBus.ts`
- `client/src/phaser/scenes/UIScene.ts`

### 关键代码
```typescript
// client/src/phaser/GameManager.ts
watch(
  () => this.gameStore!.selectedCardIds,
  (selectedIds) => {
    if (this.gameStore!.phase === 'playing' && this.gameStore!.isMyTurn) {
      const canPlay = selectedIds.length > 0
      this.eventBus.emitEvent('ui:updatePlayButton', { canPlay })
    }
  },
  { deep: true }
)
```

---

## Bug 3: 叫分气泡不显示

### 问题描述
玩家叫分时，其他玩家看不到叫分的气泡提示（如 "1分"、"不叫"）。

### 根本原因
`GameScene` 没有监听 `vue:bidMade` 事件。

### 修复方案
添加事件监听和气泡显示方法。

### 修改文件
- `client/src/phaser/scenes/GameScene.ts`

### 关键代码
```typescript
// client/src/phaser/scenes/GameScene.ts
this.eventBus.onEvent('vue:bidMade', ({ bidInfo }) => {
  this.onBidMade(bidInfo.seat, bidInfo.score)
})

private onBidMade(seat: number, score: number): void {
  const displayIndex = this.getDisplayIndex(seat)
  const bubble = this.emojiBubbles[displayIndex]
  if (bubble) {
    const text = score === 0 ? '不叫' : `${score}分`
    bubble.showMessage(text)
  }
}
```

---

## Bug 4: 第一个玩家叫地主面板不显示

### 问题描述
第一个轮到叫地主的玩家看不到叫分面板，但后续玩家可以正常看到。

### 根本原因
1. `mySeat` 是 computed 属性，依赖 `gameState.players` 查找当前用户
2. 当 `game:bid_turn` 事件到达时，`gameState` 可能还未正确设置
3. 导致 `mySeat` 返回 -1，无法判断是否是自己的回合

### 修复方案
1. 添加 `mySeatRef` 直接存储座位号
2. 在 `game:dealt` 事件时立即设置座位
3. `mySeat` computed 优先使用 `mySeatRef`

### 修改文件
- `client/src/store/game.ts`

### 关键代码
```typescript
// client/src/store/game.ts
const mySeatRef = ref<number>(-1)

const mySeat = computed(() => {
  if (mySeatRef.value >= 0) return mySeatRef.value
  if (!gameState.value) return -1
  const player = gameState.value.players.find((p) => p.id === userStore.user?.id)
  return player?.seat ?? -1
})

// 在 game:dealt 事件中
socketStore.on<{ cards: Card[]; seat: number }>('game:dealt', (data) => {
  mySeatRef.value = data.seat  // 直接存储座位号
  myCards.value = sortCards(data.cards)
  eventBus.emitEvent('vue:cardsDealt', { cards: myCards.value, seat: data.seat })
})
```

---

## Bug 5: 第一个玩家无法出牌

### 问题描述
地主确定后，第一个出牌的玩家（地主）无法出牌，`isMyTurn` 始终为 `false`。

### 根本原因
`bid()` 函数是异步的，在 `await socketStore.emit()` 之后设置 `isMyTurn = false`。但由于网络事件的时序：

1. `bid()` 发送叫分请求
2. 服务器处理后发送 `game:landlord_decided` → 设置 `isMyTurn = true`
3. 服务器发送 `game:play_turn` → 设置 `isMyTurn = true`
4. `bid()` 的 await 完成 → 把 `isMyTurn` 又设回 `false` ❌

### 修复方案
移除 `bid()` 中手动设置 `isMyTurn = false` 的代码，回合状态完全由服务器事件管理。

### 修改文件
- `client/src/store/game.ts`

### 关键代码
```typescript
// client/src/store/game.ts - 修复前
async function bid(score: number): Promise<void> {
  try {
    await socketStore.emit('game:bid', { score })
    isMyTurn.value = false  // ❌ 这行导致问题
  } catch (error) {
    console.error('叫分失败:', error)
    throw error
  }
}

// client/src/store/game.ts - 修复后
async function bid(score: number): Promise<void> {
  try {
    await socketStore.emit('game:bid', { score })
    // 不在这里设置 isMyTurn = false
    // 回合状态由服务器事件 (game:bid_turn, game:play_turn) 管理
  } catch (error) {
    console.error('叫分失败:', error)
    throw error
  }
}
```

---

## Bug 6: Phaser 场景同步时序问题

### 问题描述
有时叫分面板或出牌按钮不显示，因为 UI 事件在 UIScene 准备好之前就已发送。

### 根本原因
`GameScene` 和 `UIScene` 同时启动，但 `GameScene` 先完成 `create()` 并发送 `scene:gameReady`。此时 `UIScene` 可能还未设置好事件监听器。

### 修复方案
1. `UIScene` 也发送 `scene:uiReady` 事件
2. `GameManager` 等待两个场景都准备好后再同步状态

### 修改文件
- `client/src/phaser/scenes/UIScene.ts`
- `client/src/phaser/EventBus.ts`
- `client/src/phaser/GameManager.ts`

### 关键代码
```typescript
// client/src/phaser/scenes/UIScene.ts
create(): void {
  this.createUIComponents()
  this.setupEventListeners()
  this.eventBus.emitEvent('scene:uiReady')  // 新增
}

// client/src/phaser/GameManager.ts
let gameSceneReady = false
let uiSceneReady = false

const trySync = () => {
  if (gameSceneReady && uiSceneReady) {
    console.log('[GameManager] 两个场景都准备就绪，同步游戏状态')
    this.syncCurrentState()
  }
}

this.eventBus.onceEvent('scene:gameReady', () => {
  gameSceneReady = true
  trySync()
})

this.eventBus.onceEvent('scene:uiReady', () => {
  uiSceneReady = true
  trySync()
})
```

---

## Bug 7: Card.ts 动画报错

### 问题描述
控制台报错 `Cannot read properties of undefined (reading 'tweens')`

### 根本原因
场景销毁时动画仍在执行，此时 `this.scene` 或 `this.scene.tweens` 已为 undefined。

### 修复方案
在动画方法中添加 null 检查。

### 修改文件
- `client/src/phaser/objects/Card.ts`

### 关键代码
```typescript
// client/src/phaser/objects/Card.ts
moveToPosition(x: number, y: number, duration = ANIMATION.cardArrange): Promise<void> {
  return new Promise((resolve) => {
    if (!this.scene || !this.scene.tweens) {
      resolve()
      return
    }
    // ... 动画代码
  })
}
```

---

## 技术要点总结

### 1. 状态管理时序
- **问题**: computed 属性依赖的数据可能在事件到达时还未更新
- **解决**: 使用 ref 直接存储关键状态（如 `mySeatRef`）

### 2. 异步函数状态管理
- **问题**: 异步函数在 await 后修改状态可能覆盖新到达的事件
- **解决**: 状态变更由服务器事件统一管理，客户端不手动重置

### 3. 多场景同步
- **问题**: 多个 Phaser 场景初始化顺序不确定
- **解决**: 各场景发送 ready 事件，主控制器等待所有场景就绪

### 4. 事件监听初始化
- **问题**: 页面跳转后事件可能在监听器设置前到达
- **解决**: 在页面跳转前提前初始化事件监听器

### 5. 防御性编程
- **问题**: 组件销毁时异步操作仍在执行
- **解决**: 在异步回调中检查组件/场景是否仍有效

---

## 测试验证

| 测试场景 | 预期结果 | 验证状态 |
|----------|----------|----------|
| 选牌后点击出牌 | 按钮从禁用变为可点击 | ✅ 通过 |
| 其他玩家叫分 | 显示叫分气泡 | ✅ 通过 |
| 第一个玩家叫地主 | 显示叫分面板 | ✅ 通过 |
| 地主第一次出牌 | 可以正常选牌出牌 | ✅ 通过 |
| 所有玩家断线 | 游戏立即结束 | ✅ 通过 |
| 快速页面切换 | 无动画报错 | ✅ 通过 |
