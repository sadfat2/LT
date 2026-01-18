import Phaser from 'phaser'
import { CardSprite } from './Card'
import { LAYOUT, ANIMATION } from '../config'
import type { Card as CardData } from '@/types'

export class PlayedCardsArea extends Phaser.GameObjects.Container {
  private cards: CardSprite[] = []
  private centerX: number
  private centerY: number
  private spacing: number
  private passText: Phaser.GameObjects.Text | null = null

  constructor(scene: Phaser.Scene, x: number, y: number, spacing?: number) {
    super(scene, x, y)

    this.centerX = x
    this.centerY = y
    this.spacing = spacing ?? LAYOUT.playedCardsArea.spacing

    scene.add.existing(this)
  }

  // 显示出的牌
  async showCards(cardsData: CardData[], animate = true): Promise<void> {
    this.clear()

    // 创建卡牌精灵
    for (let i = 0; i < cardsData.length; i++) {
      const cardData = cardsData[i]
      if (!cardData) continue
      const card = new CardSprite(
        this.scene,
        this.centerX,
        animate ? this.centerY + 100 : this.centerY,
        cardData
      )
      card.setScale(0.7)
      card.setInteractiveState(false)
      this.cards.push(card)
    }

    // 排列并显示
    if (animate) {
      await this.arrangeWithAnimation()
    } else {
      this.arrange()
    }
  }

  // 显示"不出"
  showPass(): void {
    this.clear()

    this.passText = this.scene.add.text(this.centerX, this.centerY, '不出', {
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold',
    })
    this.passText.setOrigin(0.5)
    this.passText.setAlpha(0)

    this.scene.tweens.add({
      targets: this.passText,
      alpha: 1,
      y: this.centerY - 20,
      duration: ANIMATION.fadeIn,
      ease: 'Power2',
    })
  }

  // 接收飞入的牌（用于出牌动画）
  async receiveCards(cardSprites: CardSprite[]): Promise<void> {
    this.clear()

    // 将牌添加到出牌区
    for (const card of cardSprites) {
      card.setScale(0.7)
      card.setInteractiveState(false)
      this.cards.push(card)
    }

    // 排列
    await this.arrangeWithAnimation()
  }

  // 排列牌
  private arrange(): void {
    if (this.cards.length === 0) return

    const startX = this.centerX - ((this.cards.length - 1) * this.spacing) / 2

    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i]
      if (!card) continue
      card.setPosition(startX + i * this.spacing, this.centerY)
      card.setDepth(i)
    }
  }

  // 带动画的排列
  private async arrangeWithAnimation(): Promise<void> {
    if (this.cards.length === 0) return

    const startX = this.centerX - ((this.cards.length - 1) * this.spacing) / 2
    const promises: Promise<void>[] = []

    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i]
      if (!card) continue
      const targetX = startX + i * this.spacing
      card.setDepth(i)

      promises.push(
        new Promise((resolve) => {
          this.scene.tweens.add({
            targets: card,
            x: targetX,
            y: this.centerY,
            alpha: 1,
            duration: ANIMATION.play,
            ease: 'Power2',
            onComplete: () => resolve(),
          })
        })
      )
    }

    await Promise.all(promises)
  }

  // 清除
  clear(): void {
    this.cards.forEach((card) => card.destroy())
    this.cards = []

    if (this.passText) {
      this.passText.destroy()
      this.passText = null
    }
  }

  // 淡出隐藏
  fadeOut(): Promise<void> {
    return new Promise((resolve) => {
      const targets = [...this.cards, this.passText].filter(Boolean)

      if (targets.length === 0) {
        resolve()
        return
      }

      this.scene.tweens.add({
        targets,
        alpha: 0,
        duration: ANIMATION.fadeOut,
        ease: 'Power2',
        onComplete: () => {
          this.clear()
          resolve()
        },
      })
    })
  }

  destroy(fromScene?: boolean): void {
    this.clear()
    super.destroy(fromScene)
  }
}
