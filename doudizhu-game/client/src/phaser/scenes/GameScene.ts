import Phaser from 'phaser'
import { GAME_WIDTH, GAME_HEIGHT, LAYOUT, COLORS } from '../config'
import { getEventBus } from '../EventBus'
import { CardGroup } from '../objects/CardGroup'
import { PlayedCardsArea } from '../objects/PlayedCardsArea'
import { PlayerAvatar } from '../objects/PlayerAvatar'
import { Timer } from '../objects/Timer'
import type { Card, Player, GameState, PlayInfo } from '@/types'

export class GameScene extends Phaser.Scene {
  private eventBus = getEventBus()

  // 游戏状态
  private gameState: GameState | null = null
  private mySeat = -1

  // 玩家头像
  private avatars: PlayerAvatar[] = []

  // 手牌
  private handCards: CardGroup | null = null

  // 出牌区域
  private playedAreas: PlayedCardsArea[] = []

  // 底牌区域
  private bottomCardsArea: CardGroup | null = null
  private bottomCardsLabel: Phaser.GameObjects.Text | null = null

  // 计时器
  private timers: Timer[] = []

  // 游戏信息显示
  private gameInfoText: Phaser.GameObjects.Text | null = null

  constructor() {
    super({ key: 'GameScene' })
  }

  create(): void {
    this.createBackground()
    this.createGameInfo()
    this.createBottomCardsArea()
    this.createPlayerAvatars()
    this.createPlayedAreas()
    this.createTimers()
    this.createHandCards()

    this.setupEventListeners()

    // 通知游戏准备就绪
    this.eventBus.emitEvent('scene:gameReady')
  }

  private createBackground(): void {
    // 绘制游戏桌背景
    const graphics = this.add.graphics()

    // 渐变背景
    graphics.fillGradientStyle(
      COLORS.bgDark,
      COLORS.bgDark,
      COLORS.bgPrimary,
      COLORS.bgPrimary,
      1
    )
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    // 中央装饰圆
    graphics.fillStyle(COLORS.bgSecondary, 0.3)
    graphics.fillCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, 180)
  }

  private createGameInfo(): void {
    // 游戏信息（倍数等）
    this.gameInfoText = this.add.text(LAYOUT.ui.gameInfo.x, LAYOUT.ui.gameInfo.y, '', {
      fontSize: '16px',
      color: '#ffffff',
      align: 'right',
    })
    this.gameInfoText.setOrigin(1, 0)
  }

  private createBottomCardsArea(): void {
    // 底牌标签
    this.bottomCardsLabel = this.add.text(LAYOUT.bottomCards.x - 100, LAYOUT.bottomCards.y, '底牌', {
      fontSize: '18px',
      color: '#ffffff',
    })
    this.bottomCardsLabel.setOrigin(0.5)
    this.bottomCardsLabel.setVisible(false)

    // 底牌显示区域
    this.bottomCardsArea = new CardGroup(
      this,
      LAYOUT.bottomCards.x,
      LAYOUT.bottomCards.y,
      {
        overlap: LAYOUT.bottomCards.spacing,
        maxWidth: 300,
        faceUp: true,
        interactive: false,
      }
    )
  }

  private createPlayerAvatars(): void {
    // 创建三个玩家位置的头像
    for (let i = 0; i < 3; i++) {
      const playerLayout = LAYOUT.players[i]
      if (!playerLayout) continue
      const avatar = new PlayerAvatar(this, playerLayout.avatar.x, playerLayout.avatar.y)
      this.avatars.push(avatar)
    }
  }

  private createPlayedAreas(): void {
    // 创建三个玩家的出牌区域
    for (let i = 0; i < 3; i++) {
      const playerLayout = LAYOUT.players[i]
      if (!playerLayout) continue
      const area = new PlayedCardsArea(this, playerLayout.playedCards.x, playerLayout.playedCards.y)
      this.playedAreas.push(area)
    }
  }

  private createTimers(): void {
    // 创建三个玩家的计时器
    for (let i = 0; i < 3; i++) {
      const playerLayout = LAYOUT.players[i]
      if (!playerLayout) continue
      const timer = new Timer(this, playerLayout.timer.x, playerLayout.timer.y)
      this.timers.push(timer)
    }
  }

  private createHandCards(): void {
    const playerLayout = LAYOUT.players[0]
    if (!playerLayout) return
    const pos = playerLayout.cards
    this.handCards = new CardGroup(
      this,
      pos.x,
      pos.y,
      {
        overlap: LAYOUT.handCards.overlap,
        maxWidth: LAYOUT.handCards.maxWidth,
        faceUp: true,
        interactive: true,
      }
    )
  }

  private setupEventListeners(): void {
    // 游戏状态更新
    this.eventBus.onEvent('vue:gameStateChanged', ({ state }) => {
      this.updateGameState(state)
    })

    // 发牌
    this.eventBus.onEvent('vue:cardsDealt', ({ cards, seat }) => {
      this.onCardsDealt(cards, seat)
    })

    // 叫地主结果
    this.eventBus.onEvent('vue:landlordDecided', ({ seat, bottomCards, bidScore }) => {
      this.onLandlordDecided(seat, bottomCards, bidScore)
    })

    // 叫分回合
    this.eventBus.onEvent('vue:bidTurn', ({ seat, timeout }) => {
      this.onBidTurn(seat, timeout)
    })

    // 出牌回合
    this.eventBus.onEvent('vue:playTurn', ({ seat, timeout }) => {
      this.onPlayTurn(seat, timeout)
    })

    // 有人出牌
    this.eventBus.onEvent('vue:cardPlayed', ({ playInfo }) => {
      this.onCardPlayed(playInfo)
    })

    // 游戏结束
    this.eventBus.onEvent('vue:gameEnded', () => {
      this.onGameEnded()
    })

    // 重置游戏
    this.eventBus.onEvent('vue:resetGame', () => {
      this.resetGame()
    })
  }

  // 更新游戏状态
  private updateGameState(state: GameState): void {
    this.gameState = state

    // 找到自己的座位
    // 这里假设 mySeat 已经通过其他方式设置
    // 在实际使用中，需要从 gameStore 获取

    // 更新游戏信息显示
    this.updateGameInfo()

    // 更新玩家信息
    this.updatePlayers(state.players)
  }

  // 设置自己的座位
  setSeat(seat: number): void {
    this.mySeat = seat
  }

  // 更新游戏信息
  private updateGameInfo(): void {
    if (!this.gameState || !this.gameInfoText) return

    const { bidScore, multiplier, phase } = this.gameState
    let info = ''

    if (phase !== 'dealing') {
      info += `底分: ${bidScore || 0}\n`
      info += `倍数: ${multiplier}x`
    }

    this.gameInfoText.setText(info)
  }

  // 更新玩家信息
  private updatePlayers(players: Player[]): void {
    // 根据座位映射到显示位置
    // 位置 0 = 自己（下方），位置 1 = 下家（右边），位置 2 = 上家（左边）
    players.forEach((player) => {
      const displayIndex = this.getDisplayIndex(player.seat)
      const avatar = this.avatars[displayIndex]
      if (displayIndex >= 0 && displayIndex < this.avatars.length && avatar) {
        avatar.setPlayer(player)
      }
    })
  }

  // 获取显示位置索引
  private getDisplayIndex(seat: number): number {
    if (this.mySeat < 0) return seat
    // 将座位转换为相对显示位置
    return (seat - this.mySeat + 3) % 3
  }

  // 发牌
  private async onCardsDealt(cards: Card[], seat: number): Promise<void> {
    this.mySeat = seat

    if (this.handCards) {
      await this.handCards.setCards(cards, true)
    }
  }

  // 地主确定
  private async onLandlordDecided(
    seat: number,
    bottomCards: Card[],
    _bidScore: number
  ): Promise<void> {
    // 显示底牌
    if (this.bottomCardsArea && this.bottomCardsLabel) {
      this.bottomCardsLabel.setVisible(true)
      await this.bottomCardsArea.setCards(bottomCards, true)
    }

    // 如果自己是地主，将底牌加入手牌
    if (seat === this.mySeat && this.handCards) {
      await this.handCards.addCards(bottomCards, true)
    }

    // 更新角色标识
    this.avatars.forEach((avatar) => {
      const player = avatar.getPlayer()
      if (player) {
        const isLandlord = player.seat === seat
        avatar.setRole(isLandlord ? 'landlord' : 'farmer')
      }
    })

    // 更新游戏信息
    this.updateGameInfo()
  }

  // 叫分回合
  private onBidTurn(seat: number, timeout: number): void {
    const displayIndex = this.getDisplayIndex(seat)

    // 高亮当前玩家
    this.avatars.forEach((avatar, index) => {
      avatar.setHighlight(index === displayIndex)
    })

    // 显示计时器
    this.timers.forEach((timer, index) => {
      if (index === displayIndex) {
        timer.start(timeout)
      } else {
        timer.hide()
      }
    })

    // 如果是自己的回合，显示叫分面板
    if (seat === this.mySeat) {
      const currentBid = this.gameState?.bidScore || 0
      this.eventBus.emitEvent('ui:showBidPanel', { currentBid })
    }
  }

  // 出牌回合
  private onPlayTurn(seat: number, timeout: number): void {
    const displayIndex = this.getDisplayIndex(seat)

    // 高亮当前玩家
    this.avatars.forEach((avatar, index) => {
      avatar.setHighlight(index === displayIndex)
    })

    // 显示计时器
    this.timers.forEach((timer, index) => {
      if (index === displayIndex) {
        timer.start(timeout)
      } else {
        timer.hide()
      }
    })

    // 如果是自己的回合
    if (seat === this.mySeat) {
      this.handCards?.setInteractiveState(true)

      // 判断是否可以不出
      const canPass =
        this.gameState?.lastPlay !== null && this.gameState?.lastPlaySeat !== this.mySeat

      this.eventBus.emitEvent('ui:showActionButtons', { canPass, canPlay: false })
    } else {
      this.handCards?.setInteractiveState(false)
      this.eventBus.emitEvent('ui:hideActionButtons')
    }
  }

  // 有人出牌
  private async onCardPlayed(playInfo: PlayInfo): Promise<void> {
    const { seat, cards, isPass } = playInfo
    const displayIndex = this.getDisplayIndex(seat)
    const playedArea = this.playedAreas[displayIndex]
    const avatar = this.avatars[displayIndex]
    const timer = this.timers[displayIndex]

    // 清除之前的出牌显示
    // this.playedAreas.forEach(area => area.fadeOut())

    if (playedArea) {
      if (isPass) {
        // 显示"不出"
        playedArea.showPass()
      } else {
        // 显示出的牌
        await playedArea.showCards(cards, true)

        // 如果是自己出牌，从手牌中移除
        if (seat === this.mySeat && this.handCards) {
          const cardIds = cards.map((c) => c.id)
          this.handCards.removeCardsById(cardIds)
          await this.handCards.arrangeCards(true)
        }
      }
    }

    // 更新牌数显示
    if (this.gameState && avatar) {
      const player = this.gameState.players.find((p) => p.seat === seat)
      if (player) {
        avatar.updateCardCount(player.cardCount)
      }
    }

    // 隐藏计时器
    timer?.hide()
  }

  // 游戏结束
  private onGameEnded(): void {
    // 隐藏所有计时器
    this.timers.forEach((timer) => timer.hide())

    // 禁用手牌交互
    this.handCards?.setInteractiveState(false)

    // 清除高亮
    this.avatars.forEach((avatar) => avatar.setHighlight(false))
  }

  // 重置游戏
  private resetGame(): void {
    // 清除手牌
    this.handCards?.clearCards()

    // 清除出牌区
    this.playedAreas.forEach((area) => area.clear())

    // 清除底牌
    this.bottomCardsArea?.clearCards()
    this.bottomCardsLabel?.setVisible(false)

    // 清除计时器
    this.timers.forEach((timer) => timer.hide())

    // 清除头像高亮和角色
    this.avatars.forEach((avatar) => {
      avatar.setHighlight(false)
      avatar.clear()
    })

    // 清除游戏信息
    this.gameInfoText?.setText('')

    // 重置状态
    this.gameState = null
    this.mySeat = -1
  }

  // 获取选中的牌
  getSelectedCards(): Card[] {
    return this.handCards?.getSelectedCardsData() || []
  }

  // 清除选中
  clearSelection(): void {
    this.handCards?.clearSelection()
  }

  // 设置选中的牌（用于提示功能）
  setSelectedCards(cardIds: number[]): void {
    this.handCards?.clearSelection()
    this.handCards?.setSelectedByIds(cardIds)
  }
}
