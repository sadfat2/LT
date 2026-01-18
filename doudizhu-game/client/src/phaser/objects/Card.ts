import Phaser from 'phaser'
import { CARD_CONFIG, ANIMATION, COLORS, LAYOUT } from '../config'
import { getEventBus } from '../EventBus'
import type { Card as CardData } from '@/types'

export class CardSprite extends Phaser.GameObjects.Container {
  private cardData: CardData
  private cardImage: Phaser.GameObjects.Image
  private backImage: Phaser.GameObjects.Image
  private selectedHighlight: Phaser.GameObjects.Graphics
  private disabledOverlay: Phaser.GameObjects.Graphics

  private _isSelected = false
  private _isDisabled = false
  private _isFaceUp = true
  private _isInteractive = true

  private originalY = 0
  private eventBus = getEventBus()

  constructor(scene: Phaser.Scene, x: number, y: number, cardData: CardData) {
    super(scene, x, y)

    this.cardData = cardData
    this.originalY = y

    // 创建卡牌图像
    const textureKey = this.getTextureKey()
    this.cardImage = scene.add.image(0, 0, textureKey)
    this.cardImage.setDisplaySize(CARD_CONFIG.width, CARD_CONFIG.height)

    // 创建牌背
    this.backImage = scene.add.image(0, 0, 'card_back')
    this.backImage.setDisplaySize(CARD_CONFIG.width, CARD_CONFIG.height)
    this.backImage.setVisible(false)

    // 创建选中高亮
    this.selectedHighlight = scene.add.graphics()
    this.selectedHighlight.lineStyle(3, COLORS.cardSelected, 1)
    this.selectedHighlight.strokeRoundedRect(
      -CARD_CONFIG.width / 2 - 2,
      -CARD_CONFIG.height / 2 - 2,
      CARD_CONFIG.width + 4,
      CARD_CONFIG.height + 4,
      10
    )
    this.selectedHighlight.setVisible(false)

    // 创建禁用遮罩
    this.disabledOverlay = scene.add.graphics()
    this.disabledOverlay.fillStyle(0x000000, 0.5)
    this.disabledOverlay.fillRoundedRect(
      -CARD_CONFIG.width / 2,
      -CARD_CONFIG.height / 2,
      CARD_CONFIG.width,
      CARD_CONFIG.height,
      8
    )
    this.disabledOverlay.setVisible(false)

    // 添加到容器
    this.add([this.backImage, this.cardImage, this.selectedHighlight, this.disabledOverlay])

    // 设置大小和交互
    this.setSize(CARD_CONFIG.width, CARD_CONFIG.height)
    this.setupInteraction()

    // 添加到场景（不使用 scene.add.existing 以避免类型问题）
    scene.sys.displayList.add(this)
  }

  private getTextureKey(): string {
    const { suit, rank } = this.cardData
    return `card_${suit}_${rank}`
  }

  private setupInteraction(): void {
    this.setInteractive({ useHandCursor: true })

    this.on('pointerdown', this.onPointerDown, this)
    this.on('pointerover', this.onPointerOver, this)
    this.on('pointerout', this.onPointerOut, this)
  }

  private onPointerDown(): void {
    if (!this._isInteractive || this._isDisabled || !this._isFaceUp) return

    this.toggleSelected()

    if (this._isSelected) {
      this.eventBus.emitEvent('phaser:cardSelected', { cardId: this.cardData.id })
    } else {
      this.eventBus.emitEvent('phaser:cardDeselected', { cardId: this.cardData.id })
    }
  }

  private onPointerOver(): void {
    if (!this._isInteractive || this._isDisabled || !this._isFaceUp) return

    // 悬停效果：轻微放大
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 100,
      ease: 'Power2',
    })
  }

  private onPointerOut(): void {
    if (!this._isInteractive || this._isDisabled || !this._isFaceUp) return

    // 恢复原始大小
    this.scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      duration: 100,
      ease: 'Power2',
    })
  }

  // 切换选中状态
  toggleSelected(): void {
    this.setSelected(!this._isSelected)
  }

  // 设置选中状态
  setSelected(selected: boolean, animate = true): void {
    if (this._isSelected === selected) return

    this._isSelected = selected
    this.selectedHighlight.setVisible(selected)

    const targetY = selected ? this.originalY + LAYOUT.handCards.selectedOffset : this.originalY

    if (animate) {
      this.scene.tweens.add({
        targets: this,
        y: targetY,
        duration: ANIMATION.cardSelect,
        ease: 'Power2',
      })
    } else {
      this.y = targetY
    }
  }

  // 设置禁用状态
  setDisabled(disabled: boolean): void {
    this._isDisabled = disabled
    this.disabledOverlay.setVisible(disabled)

    if (disabled && this._isSelected) {
      this.setSelected(false, false)
    }
  }

  // 设置是否显示正面
  setFaceUp(faceUp: boolean, animate = false): void {
    if (this._isFaceUp === faceUp) return

    if (animate) {
      // 翻牌动画
      this.scene.tweens.add({
        targets: this,
        scaleX: 0,
        duration: ANIMATION.flip / 2,
        ease: 'Power2',
        onComplete: () => {
          this._isFaceUp = faceUp
          this.cardImage.setVisible(faceUp)
          this.backImage.setVisible(!faceUp)

          this.scene.tweens.add({
            targets: this,
            scaleX: 1,
            duration: ANIMATION.flip / 2,
            ease: 'Power2',
          })
        },
      })
    } else {
      this._isFaceUp = faceUp
      this.cardImage.setVisible(faceUp)
      this.backImage.setVisible(!faceUp)
    }
  }

  // 设置是否可交互
  setInteractiveState(interactive: boolean): void {
    this._isInteractive = interactive

    if (interactive) {
      this.setInteractive({ useHandCursor: true })
    } else {
      this.disableInteractive()
    }
  }

  // 更新原始 Y 位置
  setOriginalY(y: number): void {
    this.originalY = y
  }

  // 移动到指定位置（带动画）
  moveToPosition(x: number, y: number, duration = ANIMATION.cardArrange): Promise<void> {
    return new Promise((resolve) => {
      this.originalY = y

      this.scene.tweens.add({
        targets: this,
        x,
        y: this._isSelected ? y + LAYOUT.handCards.selectedOffset : y,
        duration,
        ease: 'Power2',
        onComplete: () => resolve(),
      })
    })
  }

  // 飞入动画
  flyIn(fromX: number, fromY: number, toX: number, toY: number, delay = 0): Promise<void> {
    return new Promise((resolve) => {
      this.setPosition(fromX, fromY)
      this.setScale(0.5)
      this.setAlpha(0)
      this.originalY = toY

      this.scene.tweens.add({
        targets: this,
        x: toX,
        y: toY,
        scaleX: 1,
        scaleY: 1,
        alpha: 1,
        duration: ANIMATION.deal,
        delay,
        ease: 'Power2',
        onComplete: () => resolve(),
      })
    })
  }

  // 飞出动画（出牌）
  flyOut(toX: number, toY: number): Promise<void> {
    return new Promise((resolve) => {
      this.setInteractiveState(false)

      this.scene.tweens.add({
        targets: this,
        x: toX,
        y: toY,
        scaleX: 0.7,
        scaleY: 0.7,
        duration: ANIMATION.play,
        ease: 'Power2',
        onComplete: () => resolve(),
      })
    })
  }

  // Getters
  get isSelected(): boolean {
    return this._isSelected
  }

  get isDisabled(): boolean {
    return this._isDisabled
  }

  get isFaceUp(): boolean {
    return this._isFaceUp
  }

  get cardInfo(): CardData {
    return this.cardData
  }

  get cardId(): number {
    return this.cardData.id
  }
}
