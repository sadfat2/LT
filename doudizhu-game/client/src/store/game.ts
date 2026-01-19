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
import { getEmojiById } from '@/game/chatConstants'

// 重连信息类型
interface PendingGameInfo {
  hasPendingGame: boolean
  roomId?: string
  remainingTime?: number
}

// 重连结果类型
interface ReconnectResult {
  success: boolean
  gameState?: GameState
  cards?: Card[]
  roomId?: string
  error?: string
}

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

  // 我的座位（直接存储，不依赖 gameState 计算）
  const mySeatRef = ref<number>(-1)

  // 重连相关状态
  const pendingGameInfo = ref<PendingGameInfo | null>(null)
  const isReconnecting = ref(false)

  // 监听器初始化标志
  const listenersInitialized = ref(false)

  // 计算属性 - 优先使用直接存储的座位值
  const mySeat = computed(() => {
    if (mySeatRef.value >= 0) return mySeatRef.value
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
    // 防止重复初始化
    if (listenersInitialized.value) {
      console.log('[gameStore] 监听器已初始化，跳过')
      return
    }
    listenersInitialized.value = true
    console.log('[gameStore] 初始化游戏事件监听')

    // 游戏开始
    socketStore.on<{ gameState: GameState }>('game:started', (data) => {
      console.log('[gameStore] 收到 game:started', data.gameState)
      gameState.value = data.gameState
      eventBus.emitEvent('vue:gameStateChanged', { state: data.gameState })
    })

    // 发牌 - 服务端只发给当前玩家，所以不需要检查 seat
    socketStore.on<{ cards: Card[]; seat: number }>('game:dealt', (data) => {
      // 直接存储自己的座位号，避免依赖 gameState 计算
      mySeatRef.value = data.seat
      console.log('[gameStore] 收到 game:dealt，设置 mySeat =', data.seat)
      myCards.value = sortCards(data.cards)
      eventBus.emitEvent('vue:cardsDealt', { cards: myCards.value, seat: data.seat })
    })

    // 叫分回合
    socketStore.on<{ seat: number; timeout: number }>('game:bid_turn', (data) => {
      console.log('[gameStore] 收到 game:bid_turn', {
        seat: data.seat,
        mySeat: mySeat.value,
        userId: userStore.user?.id,
        gameStateExists: !!gameState.value,
        phase: gameState.value?.phase,
      })
      isMyTurn.value = data.seat === mySeat.value
      if (gameState.value) {
        gameState.value.currentSeat = data.seat
      }
      console.log('[gameStore] 发送 vue:bidTurn 事件')
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
        console.log('[gameStore] 收到 game:landlord_decided', {
          landlordSeat: data.seat,
          mySeat: mySeat.value,
          isLandlord: data.seat === mySeat.value,
        })
        if (gameState.value) {
          gameState.value.landlordSeat = data.seat
          gameState.value.bottomCards = data.bottomCards
          gameState.value.bidScore = data.bidScore
          gameState.value.phase = 'playing'
          // 地主先出牌，设置 currentSeat
          gameState.value.currentSeat = data.seat

          // 更新玩家角色
          gameState.value.players.forEach((player) => {
            player.role = player.seat === data.seat ? 'landlord' : 'farmer'
          })
        }

        // 如果自己是地主，将底牌加入手牌，并设置为自己的回合
        if (data.seat === mySeat.value) {
          myCards.value = sortCards([...myCards.value, ...data.bottomCards])
          // 地主先出牌，如果自己是地主，设置 isMyTurn = true
          isMyTurn.value = true
          console.log('[gameStore] 自己是地主，设置 isMyTurn = true')
        }

        eventBus.emitEvent('vue:landlordDecided', data)
      }
    )

    // 出牌回合
    socketStore.on<{ seat: number; timeout: number }>('game:play_turn', (data) => {
      console.log('[gameStore] 收到 game:play_turn', {
        seat: data.seat,
        mySeat: mySeat.value,
        mySeatRef: mySeatRef.value,
        isMyTurn: data.seat === mySeat.value,
      })
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
    socketStore.on<{
      winnerId: number
      results: GameResult[]
      reason?: string
      disconnectedPlayerId?: number
    }>('game:ended', (data) => {
      if (gameState.value) {
        gameState.value.phase = 'finished'
        gameState.value.winnerId = data.winnerId
      }
      isMyTurn.value = false
      // 传递断线原因（如果有）
      eventBus.emitEvent('vue:gameEnded', {
        ...data,
        isDisconnectEnd: data.reason === 'disconnect_timeout',
        disconnectedPlayerId: data.disconnectedPlayerId,
      })
    })

    // 玩家断线
    socketStore.on<{ playerId: number; timeout: number }>('player:offline', (data) => {
      if (gameState.value) {
        const player = gameState.value.players.find((p) => p.id === data.playerId)
        if (player) {
          player.isOnline = false
        }
      }
      eventBus.emitEvent('vue:playerOffline', data)
    })

    // 玩家重连
    socketStore.on<{ playerId: number }>('player:online', (data) => {
      if (gameState.value) {
        const player = gameState.value.players.find((p) => p.id === data.playerId)
        if (player) {
          player.isOnline = true
        }
      }
      eventBus.emitEvent('vue:playerOnline', data)
    })

    // 收到表情
    socketStore.on<{ playerId: number; emojiId: string; emoji: { id: string; name: string } }>(
      'chat:emoji',
      (data) => {
        // 根据玩家ID找到座位
        const player = gameState.value?.players.find((p) => p.id === data.playerId)
        if (player) {
          const emoji = getEmojiById(data.emojiId)
          if (emoji) {
            eventBus.emitEvent('vue:showEmoji', {
              seat: player.seat,
              emojiId: data.emojiId,
              symbol: emoji.symbol,
            })
          }
        }
      }
    )

    // 收到快捷消息
    socketStore.on<{
      playerId: number
      messageId: string
      message: { id: string; text: string }
    }>('chat:quick', (data) => {
      // 根据玩家ID找到座位
      const player = gameState.value?.players.find((p) => p.id === data.playerId)
      if (player) {
        eventBus.emitEvent('vue:showQuickMessage', {
          seat: player.seat,
          messageId: data.messageId,
          text: data.message.text,
        })
      }
    })

    // 监听 Phaser 发送表情请求
    eventBus.onEvent('phaser:sendEmoji', ({ emojiId }) => {
      sendEmoji(emojiId)
    })

    // 监听 Phaser 发送快捷消息请求
    eventBus.onEvent('phaser:sendQuickMessage', ({ messageId }) => {
      sendQuickMessage(messageId)
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
      // 不在这里设置 isMyTurn = false
      // 回合状态由服务器事件 (game:bid_turn, game:play_turn) 管理
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

  // 发送表情
  async function sendEmoji(emojiId: string): Promise<void> {
    try {
      const result = await socketStore.emit<{ success?: boolean; error?: string }>('chat:emoji', {
        emojiId,
      })
      if (result.error) {
        console.warn('发送表情失败:', result.error)
      }
    } catch (error) {
      console.error('发送表情失败:', error)
    }
  }

  // 发送快捷消息
  async function sendQuickMessage(messageId: string): Promise<void> {
    try {
      const result = await socketStore.emit<{ success?: boolean; error?: string }>('chat:quick', {
        messageId,
      })
      if (result.error) {
        console.warn('发送快捷消息失败:', result.error)
      }
    } catch (error) {
      console.error('发送快捷消息失败:', error)
    }
  }

  // 重置游戏状态
  function resetGame(): void {
    gameState.value = null
    myCards.value = []
    selectedCardIds.value = []
    isMyTurn.value = false
    hintCards.value = []
    mySeatRef.value = -1  // 重置座位信息
    pendingGameInfo.value = null
    isReconnecting.value = false
    // 不在这里重置 listenersInitialized，由 removeGameListeners 负责
    eventBus.emitEvent('vue:resetGame')
  }

  // 检查是否有未完成的游戏
  async function checkPendingGame(): Promise<PendingGameInfo> {
    try {
      const result = await socketStore.emit<PendingGameInfo>('game:check-pending', {})
      pendingGameInfo.value = result
      return result
    } catch (error) {
      console.error('检查未完成游戏失败:', error)
      return { hasPendingGame: false }
    }
  }

  // 重连到游戏
  async function reconnectToGame(): Promise<ReconnectResult> {
    if (isReconnecting.value) {
      return { success: false, error: '正在重连中' }
    }

    isReconnecting.value = true

    try {
      const result = await socketStore.emit<ReconnectResult>('game:reconnect', {})

      if (result.success && result.gameState && result.cards) {
        // 恢复游戏状态
        gameState.value = result.gameState
        myCards.value = sortCards(result.cards)

        // 从 gameState 中找到自己的座位并存储
        const myPlayer = result.gameState.players.find((p) => p.id === userStore.user?.id)
        if (myPlayer) {
          mySeatRef.value = myPlayer.seat
        }

        // 计算当前是否是自己的回合
        if (result.gameState.currentSeat === mySeat.value) {
          isMyTurn.value = true
        }

        // 通知 Phaser 恢复游戏
        eventBus.emitEvent('vue:gameReconnected', {
          gameState: result.gameState,
          cards: myCards.value,
        })

        // 清除重连信息
        pendingGameInfo.value = null

        console.log('重连成功')
        return result
      } else {
        console.error('重连失败:', result.error)
        return { success: false, error: result.error || '重连失败' }
      }
    } catch (error) {
      console.error('重连异常:', error)
      return { success: false, error: '重连异常' }
    } finally {
      isReconnecting.value = false
    }
  }

  // 清除重连信息
  function clearPendingGame(): void {
    pendingGameInfo.value = null
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
    socketStore.off('player:offline')
    socketStore.off('player:online')
    socketStore.off('chat:emoji')
    socketStore.off('chat:quick')
    eventBus.offEvent('phaser:sendEmoji')
    eventBus.offEvent('phaser:sendQuickMessage')
    // 重置标志
    listenersInitialized.value = false
    console.log('[gameStore] 清除游戏事件监听')
  }

  return {
    // State
    gameState,
    myCards,
    selectedCardIds,
    isMyTurn,
    hintCards,
    pendingGameInfo,
    isReconnecting,

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
    sendEmoji,
    sendQuickMessage,
    resetGame,
    checkPendingGame,
    reconnectToGame,
    clearPendingGame,
  }
})
