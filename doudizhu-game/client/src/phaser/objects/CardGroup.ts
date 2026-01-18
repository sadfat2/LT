import Phaser from 'phaser'
import { CardSprite } from './Card'
import { LAYOUT, ANIMATION, CARD_CONFIG, GAME_WIDTH } from '../config'
import type { Card as CardData } from '@/types'

export class CardGroup extends Phaser.GameObjects.Container {
  private cards: CardSprite[] = []
  private centerX: number
  private centerY: number
  private overlap: number
  private maxWidth: number
  private isFaceUp: boolean
  private isInteractive: boolean

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    options?: {
      overlap?: number
      maxWidth?: number
      faceUp?: boolean
      interactive?: boolean
    }
  ) {
    super(scene, x, y)

    this.centerX = x
    this.centerY = y
    this.overlap = options?.overlap ?? LAYOUT.handCards.overlap
    this.maxWidth = options?.maxWidth ?? LAYOUT.handCards.maxWidth
    this.isFaceUp = options?.faceUp ?? true
    this.isInteractive = options?.interactive ?? true

    scene.add.existing(this)
  }

  // 设置手牌
  setCards(cardsData: CardData[], animate = true): Promise<void> {
    return new Promise(async (resolve) => {
      // 清除现有牌
      this.clearCards()

      // 排序牌（从大到小）
      const sortedCards = [...cardsData].sort((a, b) => b.value - a.value)

      // 创建卡牌精灵
      const startX = this.isFaceUp ? -GAME_WIDTH / 2 : this.centerX
      const startY = this.isFaceUp ? -200 : this.centerY

      for (let i = 0; i < sortedCards.length; i++) {
        const cardData = sortedCards[i]
        if (!cardData) continue
        const card = new CardSprite(
          this.scene,
          startX,
          startY,
          cardData
        )
        card.setFaceUp(this.isFaceUp)
        card.setInteractiveState(this.isInteractive)
        this.cards.push(card)
      }

      // 重排动画
      if (animate) {
        await this.arrangeCards(true)
      } else {
        this.arrangeCards(false)
      }

      resolve()
    })
  }

  // 添加牌（底牌）
  async addCards(cardsData: CardData[], animate = true): Promise<void> {
    // 创建并添加新牌
    for (const cardData of cardsData) {
      const card = new CardSprite(
        this.scene,
        this.centerX,
        this.centerY - 200,
        cardData
      )
      card.setFaceUp(this.isFaceUp)
      card.setInteractiveState(this.isInteractive)
      this.cards.push(card)
    }

    // 排序并重排
    this.sortCards()
    await this.arrangeCards(animate)
  }

  // 移除选中的牌
  removeSelectedCards(): CardSprite[] {
    const selected = this.cards.filter((card) => card.isSelected)
    this.cards = this.cards.filter((card) => !card.isSelected)
    return selected
  }

  // 移除指定 ID 的牌
  removeCardsById(cardIds: number[]): CardSprite[] {
    const removed: CardSprite[] = []
    this.cards = this.cards.filter((card) => {
      if (cardIds.includes(card.cardId)) {
        removed.push(card)
        return false
      }
      return true
    })
    return removed
  }

  // 排序牌
  private sortCards(): void {
    this.cards.sort((a, b) => b.cardInfo.value - a.cardInfo.value)
  }

  // 排列牌（居中显示）
  async arrangeCards(animate = true): Promise<void> {
    if (this.cards.length === 0) return

    // 计算实际间距（确保不超过最大宽度）
    const totalWidth = this.overlap * (this.cards.length - 1) + CARD_CONFIG.width
    const actualOverlap =
      totalWidth > this.maxWidth
        ? (this.maxWidth - CARD_CONFIG.width) / (this.cards.length - 1)
        : this.overlap

    // 计算起始位置（居中）
    const startX = this.centerX - ((this.cards.length - 1) * actualOverlap) / 2

    // 移动每张牌
    const promises: Promise<void>[] = []

    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i]
      if (!card) continue
      const targetX = startX + i * actualOverlap
      const targetY = this.centerY

      // 设置层级（后面的牌显示在上面）
      card.setDepth(i)
      card.setOriginalY(targetY)

      if (animate) {
        const delay = i * 30
        promises.push(
          new Promise((resolve) => {
            this.scene.time.delayedCall(delay, () => {
              card.moveToPosition(targetX, targetY, ANIMATION.cardArrange).then(resolve)
            })
          })
        )
      } else {
        card.setPosition(targetX, targetY)
      }
    }

    if (animate) {
      await Promise.all(promises)
    }
  }

  // 发牌动画
  async dealAnimation(): Promise<void> {
    const promises: Promise<void>[] = []

    // 计算目标位置
    const totalWidth = this.overlap * (this.cards.length - 1) + CARD_CONFIG.width
    const actualOverlap =
      totalWidth > this.maxWidth
        ? (this.maxWidth - CARD_CONFIG.width) / (this.cards.length - 1)
        : this.overlap
    const startX = this.centerX - ((this.cards.length - 1) * actualOverlap) / 2

    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i]
      if (!card) continue
      const targetX = startX + i * actualOverlap
      const targetY = this.centerY

      card.setDepth(i)
      card.setOriginalY(targetY)

      promises.push(
        card.flyIn(
          this.centerX,
          this.centerY - 300,
          targetX,
          targetY,
          i * 50
        )
      )
    }

    await Promise.all(promises)
  }

  // 获取选中的牌
  getSelectedCards(): CardSprite[] {
    return this.cards.filter((card) => card.isSelected)
  }

  // 获取选中的牌数据
  getSelectedCardsData(): CardData[] {
    return this.getSelectedCards().map((card) => card.cardInfo)
  }

  // 清空选中状态
  clearSelection(): void {
    this.cards.forEach((card) => card.setSelected(false, false))
  }

  // 设置指定牌为选中状态
  setSelectedByIds(cardIds: number[]): void {
    this.cards.forEach((card) => {
      card.setSelected(cardIds.includes(card.cardId), false)
    })
  }

  // 设置是否可交互
  setInteractiveState(interactive: boolean): void {
    this.isInteractive = interactive
    this.cards.forEach((card) => card.setInteractiveState(interactive))
  }

  // 设置禁用状态
  setDisabled(disabled: boolean): void {
    this.cards.forEach((card) => card.setDisabled(disabled))
  }

  // 清除所有牌
  clearCards(): void {
    this.cards.forEach((card) => card.destroy())
    this.cards = []
  }

  // 获取牌数量
  getCardCount(): number {
    return this.cards.length
  }

  // 获取所有牌数据
  getAllCardsData(): CardData[] {
    return this.cards.map((card) => card.cardInfo)
  }

  // 销毁
  destroy(fromScene?: boolean): void {
    this.clearCards()
    super.destroy(fromScene)
  }
}
