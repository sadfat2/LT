import Phaser from 'phaser'
import type { Card, GameState, Player, BidInfo, PlayInfo, GameResult } from '@/types'

// 定义事件类型
export interface GameEvents {
  // Vue -> Phaser 事件
  'vue:gameStateChanged': { state: GameState }
  'vue:cardsDealt': { cards: Card[]; seat: number }
  'vue:bidTurn': { seat: number; timeout: number }
  'vue:bidMade': { bidInfo: BidInfo }
  'vue:landlordDecided': { seat: number; bottomCards: Card[]; bidScore: number }
  'vue:playTurn': { seat: number; timeout: number }
  'vue:cardPlayed': { playInfo: PlayInfo }
  'vue:gameEnded': { winnerId: number; results: GameResult[] }
  'vue:playerUpdated': { player: Player }
  'vue:resetGame': void

  // Phaser -> Vue 事件
  'phaser:cardSelected': { cardId: number }
  'phaser:cardDeselected': { cardId: number }
  'phaser:bid': { score: number }
  'phaser:playCards': { cards: Card[] }
  'phaser:pass': void
  'phaser:hint': void
  'phaser:resultClosed': void
  'phaser:ready': void

  // 场景内部事件
  'scene:bootComplete': void
  'scene:gameReady': void
  'ui:showBidPanel': { currentBid: number }
  'ui:hideBidPanel': void
  'ui:showActionButtons': { canPass: boolean; canPlay: boolean }
  'ui:hideActionButtons': void
  'ui:showResult': { winnerId: number; results: GameResult[] }
  'ui:updateTimer': { seat: number; time: number }
  'ui:hideTimer': { seat: number }
}

// 事件回调类型
type EventCallback<T> = T extends void ? () => void : (data: T) => void

// 创建事件发射器实例
class GameEventBus extends Phaser.Events.EventEmitter {
  private static instance: GameEventBus | null = null

  private constructor() {
    super()
  }

  static getInstance(): GameEventBus {
    if (!GameEventBus.instance) {
      GameEventBus.instance = new GameEventBus()
    }
    return GameEventBus.instance
  }

  // 类型安全的 emit
  emitEvent<K extends keyof GameEvents>(
    event: K,
    ...args: GameEvents[K] extends void ? [] : [GameEvents[K]]
  ): boolean {
    return this.emit(event, ...args)
  }

  // 类型安全的 on
  onEvent<K extends keyof GameEvents>(
    event: K,
    callback: EventCallback<GameEvents[K]>,
    context?: unknown
  ): this {
    return this.on(event, callback as (...args: unknown[]) => void, context)
  }

  // 类型安全的 once
  onceEvent<K extends keyof GameEvents>(
    event: K,
    callback: EventCallback<GameEvents[K]>,
    context?: unknown
  ): this {
    return this.once(event, callback as (...args: unknown[]) => void, context)
  }

  // 类型安全的 off
  offEvent<K extends keyof GameEvents>(
    event: K,
    callback?: EventCallback<GameEvents[K]>,
    context?: unknown
  ): this {
    return this.off(event, callback as (...args: unknown[]) => void, context)
  }

  // 销毁实例
  static destroy(): void {
    if (GameEventBus.instance) {
      GameEventBus.instance.removeAllListeners()
      GameEventBus.instance = null
    }
  }
}

// 导出单例获取函数
export function getEventBus(): GameEventBus {
  const instance = GameEventBus.getInstance()
  // 开发环境下暴露到全局（便于调试）
  if (import.meta.env.DEV) {
    ;(window as unknown as { __PHASER_EVENT_BUS__: GameEventBus }).__PHASER_EVENT_BUS__ = instance
  }
  return instance
}

// 导出销毁函数
export function destroyEventBus(): void {
  GameEventBus.destroy()
}

export default GameEventBus
