import Phaser from 'phaser'
import { watch, type WatchStopHandle } from 'vue'
import { createGameConfig } from './config'
import { getEventBus, destroyEventBus } from './EventBus'
import { BootScene } from './scenes/BootScene'
import { GameScene } from './scenes/GameScene'
import { UIScene } from './scenes/UIScene'
import type { useGameStore } from '@/store/game'

export class GameManager {
  private game: Phaser.Game | null = null
  private gameStore: ReturnType<typeof useGameStore> | null = null
  private watchers: WatchStopHandle[] = []
  private eventBus = getEventBus()

  constructor() {
    this.setupPhaserEventListeners()
  }

  // 初始化游戏
  init(container: HTMLElement, gameStore: ReturnType<typeof useGameStore>): void {
    if (this.game) {
      console.warn('GameManager: 游戏已初始化')
      return
    }

    this.gameStore = gameStore

    // 创建 Phaser 游戏
    const config = createGameConfig(container)
    config.scene = [BootScene, GameScene, UIScene]

    this.game = new Phaser.Game(config)

    // 开发环境下暴露游戏实例到全局（便于调试）
    if (import.meta.env.DEV) {
      ;(window as unknown as { __PHASER_GAME__: Phaser.Game }).__PHASER_GAME__ = this.game
    }

    // 设置 Store watchers
    this.setupStoreWatchers()
  }

  // 设置 Store 监听
  private setupStoreWatchers(): void {
    if (!this.gameStore) return

    // 监听游戏状态变化
    this.watchers.push(
      watch(
        () => this.gameStore!.gameState,
        (newState) => {
          if (newState) {
            this.eventBus.emitEvent('vue:gameStateChanged', {
              state: newState,
              mySeat: this.gameStore!.mySeat,
            })
          }
        },
        { deep: true }
      )
    )

    // 监听手牌变化
    this.watchers.push(
      watch(
        () => this.gameStore!.myCards,
        (cards) => {
          if (cards && this.gameStore!.mySeat !== undefined) {
            this.eventBus.emitEvent('vue:cardsDealt', {
              cards,
              seat: this.gameStore!.mySeat,
            })
          }
        },
        { deep: true }
      )
    )

    // 监听选中的牌变化，更新出牌按钮状态
    this.watchers.push(
      watch(
        () => this.gameStore!.selectedCardIds,
        (selectedIds) => {
          console.log('[GameManager] selectedCardIds 变化:', {
            selectedIds,
            phase: this.gameStore!.phase,
            isMyTurn: this.gameStore!.isMyTurn,
          })
          if (this.gameStore!.phase === 'playing' && this.gameStore!.isMyTurn) {
            const canPlay = selectedIds.length > 0
            console.log('[GameManager] 更新出牌按钮状态:', canPlay)
            this.eventBus.emitEvent('ui:updatePlayButton', { canPlay })
          }
        },
        { deep: true }
      )
    )

    // 监听 Phaser 场景准备就绪，等待两个场景都准备好后再同步
    let gameSceneReady = false
    let uiSceneReady = false

    const trySync = () => {
      if (gameSceneReady && uiSceneReady) {
        console.log('[GameManager] 两个场景都准备就绪，同步游戏状态')
        this.syncCurrentState()
      }
    }

    this.eventBus.onceEvent('scene:gameReady', () => {
      console.log('[GameManager] GameScene 准备就绪')
      gameSceneReady = true
      trySync()
    })

    this.eventBus.onceEvent('scene:uiReady', () => {
      console.log('[GameManager] UIScene 准备就绪')
      uiSceneReady = true
      trySync()
    })
  }

  // 同步当前游戏状态到 Phaser（用于 Phaser 初始化后同步已存在的数据）
  private syncCurrentState(): void {
    if (!this.gameStore) return

    // 同步游戏状态
    if (this.gameStore.gameState) {
      console.log('[GameManager] 同步 gameState', this.gameStore.gameState)
      this.eventBus.emitEvent('vue:gameStateChanged', {
        state: this.gameStore.gameState,
        mySeat: this.gameStore.mySeat,
      })
    }

    // 同步手牌
    if (this.gameStore.myCards.length > 0 && this.gameStore.mySeat >= 0) {
      console.log('[GameManager] 同步手牌', this.gameStore.myCards.length, '张')
      this.eventBus.emitEvent('vue:cardsDealt', {
        cards: this.gameStore.myCards,
        seat: this.gameStore.mySeat,
      })
    }

    // 如果是叫地主阶段，检查是否轮到自己
    if (this.gameStore.gameState?.phase === 'bidding' && this.gameStore.mySeat >= 0) {
      const isMyBidTurn = this.gameStore.gameState.currentSeat === this.gameStore.mySeat
      console.log('[GameManager] 同步叫分回合', {
        currentSeat: this.gameStore.gameState.currentSeat,
        mySeat: this.gameStore.mySeat,
        isMyBidTurn,
      })
      if (isMyBidTurn) {
        // 同时设置 isMyTurn 状态
        this.gameStore.isMyTurn = true
        this.eventBus.emitEvent('vue:bidTurn', {
          seat: this.gameStore.gameState.currentSeat,
          timeout: 30000,
        })
      }
    }

    // 如果是出牌阶段，检查是否轮到自己
    if (this.gameStore.gameState?.phase === 'playing' && this.gameStore.mySeat >= 0) {
      const isMyPlayTurn = this.gameStore.gameState.currentSeat === this.gameStore.mySeat
      console.log('[GameManager] 同步出牌回合', {
        currentSeat: this.gameStore.gameState.currentSeat,
        mySeat: this.gameStore.mySeat,
        isMyPlayTurn,
      })
      if (isMyPlayTurn) {
        // 同时设置 isMyTurn 状态
        this.gameStore.isMyTurn = true
        this.eventBus.emitEvent('vue:playTurn', {
          seat: this.gameStore.gameState.currentSeat,
          timeout: 30000,
        })
      }
    }
  }

  // 设置 Phaser 事件监听（处理来自 Phaser 的事件）
  private setupPhaserEventListeners(): void {
    // 选中卡牌
    this.eventBus.onEvent('phaser:cardSelected', ({ cardId }) => {
      this.gameStore?.selectCard(cardId)
    })

    // 取消选中卡牌
    this.eventBus.onEvent('phaser:cardDeselected', ({ cardId }) => {
      this.gameStore?.deselectCard(cardId)
    })

    // 叫地主
    this.eventBus.onEvent('phaser:bid', ({ score }) => {
      this.gameStore?.bid(score)
    })

    // 出牌
    this.eventBus.onEvent('phaser:playCards', () => {
      this.gameStore?.playCards()
    })

    // 不出
    this.eventBus.onEvent('phaser:pass', () => {
      this.gameStore?.pass()
    })

    // 提示
    this.eventBus.onEvent('phaser:hint', () => {
      this.gameStore?.getHint()
    })

    // 结算窗口关闭
    this.eventBus.onEvent('phaser:resultClosed', () => {
      this.gameStore?.resetGame()
    })
  }

  // 获取游戏实例
  getGame(): Phaser.Game | null {
    return this.game
  }

  // 获取指定场景
  getScene<T extends Phaser.Scene>(key: string): T | null {
    if (!this.game) return null
    return this.game.scene.getScene(key) as T | null
  }

  // 销毁游戏
  destroy(): void {
    // 停止所有 watchers
    this.watchers.forEach((stop) => stop())
    this.watchers = []

    // 销毁事件总线
    destroyEventBus()

    // 销毁 Phaser 游戏
    if (this.game) {
      this.game.destroy(true)
      this.game = null
    }

    this.gameStore = null
  }
}

// 导出单例
let gameManagerInstance: GameManager | null = null

export function getGameManager(): GameManager {
  if (!gameManagerInstance) {
    gameManagerInstance = new GameManager()
  }
  return gameManagerInstance
}

export function destroyGameManager(): void {
  if (gameManagerInstance) {
    gameManagerInstance.destroy()
    gameManagerInstance = null
  }
}
