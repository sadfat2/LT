import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useSocketStore } from './socket'
import { useUserStore } from './user'
import { getEventBus } from '@/phaser/EventBus'
import type {
  Card,
  Player,
  GameState,
  GamePhase,
  BidInfo,
  PlayInfo,
  GameResult,
} from '@/types'

export const useGameStore = defineStore('game', () => {
  const socketStore = useSocketStore()
  const userStore = useUserStore()
  const eventBus = getEventBus()

  // 游戏状态
  const gameState = ref<GameState | null>(null)
  const myCards = ref<Card[]>([])
  const selectedCardIds = ref<number[]>([])
  const isMyTurn = ref(false)
  const hintCards = ref<Card[]>([])

  // 计算属性
  const mySeat = computed(() => {
    if (!gameState.value) return -1
    const player = gameState.value.players.find((p) => p.id === userStore.user?.id)
    return player?.seat ?? -1
  })

  const phase = computed((): GamePhase => {
    return gameState.value?.phase ?? 'dealing'
  })

  const currentPlayer = computed((): Player | null => {
    if (!gameState.value) return null
    return gameState.value.players.find((p) => p.seat === gameState.value!.currentSeat) ?? null
  })

  const selectedCards = computed((): Card[] => {
    return myCards.value.filter((card) => selectedCardIds.value.includes(card.id))
  })

  const canPass = computed((): boolean => {
    if (!isMyTurn.value || phase.value !== 'playing') return false
    // 如果上一手是自己出的，不能不出
    return gameState.value?.lastPlaySeat !== mySeat.value && gameState.value?.lastPlay !== null
  })

  // 初始化游戏事件监听
  function initGameListeners(): void {
    // 游戏开始
    socketStore.on<{ gameState: GameState }>('game:started', (data) => {
      gameState.value = data.gameState
      eventBus.emitEvent('vue:gameStateChanged', { state: data.gameState })
    })

    // 发牌
    socketStore.on<{ cards: Card[]; seat: number }>('game:dealt', (data) => {
      if (data.seat === mySeat.value) {
        myCards.value = sortCards(data.cards)
        eventBus.emitEvent('vue:cardsDealt', { cards: myCards.value, seat: data.seat })
      }
    })

    // 叫分回合
    socketStore.on<{ seat: number; timeout: number }>('game:bid_turn', (data) => {
      isMyTurn.value = data.seat === mySeat.value
      if (gameState.value) {
        gameState.value.currentSeat = data.seat
      }
      eventBus.emitEvent('vue:bidTurn', data)
    })

    // 有人叫分
    socketStore.on<{ bidInfo: BidInfo }>('game:bid', (data) => {
      if (gameState.value && data.bidInfo.score > 0) {
        gameState.value.bidScore = data.bidInfo.score
      }
      eventBus.emitEvent('vue:bidMade', data)
    })

    // 地主确定
    socketStore.on<{ seat: number; bottomCards: Card[]; bidScore: number }>(
      'game:landlord_decided',
      (data) => {
        if (gameState.value) {
          gameState.value.landlordSeat = data.seat
          gameState.value.bottomCards = data.bottomCards
          gameState.value.bidScore = data.bidScore
          gameState.value.phase = 'playing'

          // 更新玩家角色
          gameState.value.players.forEach((player) => {
            player.role = player.seat === data.seat ? 'landlord' : 'farmer'
          })
        }

        // 如果自己是地主，将底牌加入手牌
        if (data.seat === mySeat.value) {
          myCards.value = sortCards([...myCards.value, ...data.bottomCards])
        }

        eventBus.emitEvent('vue:landlordDecided', data)
      }
    )

    // 出牌回合
    socketStore.on<{ seat: number; timeout: number }>('game:play_turn', (data) => {
      isMyTurn.value = data.seat === mySeat.value
      if (gameState.value) {
        gameState.value.currentSeat = data.seat
      }
      eventBus.emitEvent('vue:playTurn', data)
    })

    // 有人出牌
    socketStore.on<{ playInfo: PlayInfo }>('game:played', (data) => {
      const { playInfo } = data

      if (gameState.value) {
        // 更新上一手牌
        if (!playInfo.isPass) {
          gameState.value.lastPlay = playInfo.pattern
          gameState.value.lastPlaySeat = playInfo.seat
          gameState.value.passCount = 0
        } else {
          gameState.value.passCount++
        }

        // 更新玩家牌数
        const player = gameState.value.players.find((p) => p.seat === playInfo.seat)
        if (player && !playInfo.isPass) {
          player.cardCount -= playInfo.cards.length
        }
      }

      // 如果是自己出牌，从手牌中移除
      if (playInfo.seat === mySeat.value && !playInfo.isPass) {
        const playedIds = playInfo.cards.map((c) => c.id)
        myCards.value = myCards.value.filter((card) => !playedIds.includes(card.id))
        selectedCardIds.value = []
      }

      eventBus.emitEvent('vue:cardPlayed', data)
    })

    // 游戏结束
    socketStore.on<{ winnerId: number; results: GameResult[] }>('game:ended', (data) => {
      if (gameState.value) {
        gameState.value.phase = 'finished'
        gameState.value.winnerId = data.winnerId
      }
      isMyTurn.value = false
      eventBus.emitEvent('vue:gameEnded', data)
    })
  }

  // 排序牌（从大到小）
  function sortCards(cards: Card[]): Card[] {
    return [...cards].sort((a, b) => b.value - a.value)
  }

  // 选中牌
  function selectCard(cardId: number): void {
    if (!selectedCardIds.value.includes(cardId)) {
      selectedCardIds.value.push(cardId)
    }
  }

  // 取消选中牌
  function deselectCard(cardId: number): void {
    selectedCardIds.value = selectedCardIds.value.filter((id) => id !== cardId)
  }

  // 清除选中
  function clearSelection(): void {
    selectedCardIds.value = []
  }

  // 叫分
  async function bid(score: number): Promise<void> {
    try {
      await socketStore.emit('game:bid', { score })
      isMyTurn.value = false
    } catch (error) {
      console.error('叫分失败:', error)
      throw error
    }
  }

  // 出牌
  async function playCards(): Promise<void> {
    if (selectedCardIds.value.length === 0) {
      throw new Error('请选择要出的牌')
    }

    const cards = selectedCards.value
    try {
      await socketStore.emit('game:play', { cards })
      isMyTurn.value = false
    } catch (error) {
      console.error('出牌失败:', error)
      throw error
    }
  }

  // 不出
  async function pass(): Promise<void> {
    if (!canPass.value) {
      throw new Error('必须出牌')
    }

    try {
      await socketStore.emit('game:pass', {})
      isMyTurn.value = false
      clearSelection()
    } catch (error) {
      console.error('不出失败:', error)
      throw error
    }
  }

  // 获取提示
  async function getHint(): Promise<void> {
    try {
      const response = await socketStore.emit<{ cards: Card[] }>('game:hint', {})
      if (response.cards && response.cards.length > 0) {
        hintCards.value = response.cards
        // 设置选中状态
        selectedCardIds.value = response.cards.map((c) => c.id)
      }
    } catch (error) {
      console.error('获取提示失败:', error)
    }
  }

  // 重置游戏状态
  function resetGame(): void {
    gameState.value = null
    myCards.value = []
    selectedCardIds.value = []
    isMyTurn.value = false
    hintCards.value = []
    eventBus.emitEvent('vue:resetGame')
  }

  // 清除监听器
  function removeGameListeners(): void {
    socketStore.off('game:started')
    socketStore.off('game:dealt')
    socketStore.off('game:bid_turn')
    socketStore.off('game:bid')
    socketStore.off('game:landlord_decided')
    socketStore.off('game:play_turn')
    socketStore.off('game:played')
    socketStore.off('game:ended')
  }

  return {
    // State
    gameState,
    myCards,
    selectedCardIds,
    isMyTurn,
    hintCards,

    // Computed
    mySeat,
    phase,
    currentPlayer,
    selectedCards,
    canPass,

    // Actions
    initGameListeners,
    removeGameListeners,
    selectCard,
    deselectCard,
    clearSelection,
    bid,
    playCards,
    pass,
    getHint,
    resetGame,
  }
})
