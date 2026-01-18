import Phaser from 'phaser'
import { COLORS, FONTS, ANIMATION } from '../config'
import { getEventBus } from '../EventBus'

export class ActionButtons extends Phaser.GameObjects.Container {
  private passButton: Phaser.GameObjects.Container | null = null
  private playButton: Phaser.GameObjects.Container | null = null
  private hintButton: Phaser.GameObjects.Container | null = null
  private eventBus = getEventBus()

  private canPass = false
  private canPlay = false

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y)

    this.createButtons()

    this.setVisible(false)
    this.setDepth(100)

    scene.add.existing(this)
  }

  private createButtons(): void {
    const buttonWidth = 100
    const buttonHeight = 45
    const spacing = 20

    // 不出按钮
    this.passButton = this.createButton(-buttonWidth - spacing, 0, buttonWidth, buttonHeight, {
      text: '不出',
      color: COLORS.danger,
      onClick: () => this.onPass(),
    })
    this.add(this.passButton)

    // 提示按钮
    this.hintButton = this.createButton(0, 0, buttonWidth, buttonHeight, {
      text: '提示',
      color: COLORS.warning,
      onClick: () => this.onHint(),
    })
    this.add(this.hintButton)

    // 出牌按钮
    this.playButton = this.createButton(buttonWidth + spacing, 0, buttonWidth, buttonHeight, {
      text: '出牌',
      color: COLORS.success,
      onClick: () => this.onPlay(),
    })
    this.add(this.playButton)
  }

  private createButton(
    x: number,
    y: number,
    width: number,
    height: number,
    config: { text: string; color: number; onClick: () => void }
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y)

    // 按钮背景
    const bg = this.scene.add.graphics()
    bg.fillStyle(config.color, 1)
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 8)
    container.add(bg)

    // 高光效果
    const highlight = this.scene.add.graphics()
    highlight.fillStyle(0xffffff, 0.2)
    highlight.fillRoundedRect(-width / 2 + 2, -height / 2 + 2, width - 4, height / 2 - 2, { tl: 6, tr: 6, bl: 0, br: 0 })
    container.add(highlight)

    // 按钮文字
    const text = this.scene.add.text(0, 0, config.text, {
      fontSize: `${FONTS.sizes.normal}px`,
      color: '#ffffff',
      fontStyle: 'bold',
    })
    text.setOrigin(0.5)
    container.add(text)

    // 设置交互
    container.setSize(width, height)
    container.setInteractive({ useHandCursor: true })

    // 悬停效果
    container.on('pointerover', () => {
      this.scene.tweens.add({
        targets: container,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 100,
      })
    })

    container.on('pointerout', () => {
      this.scene.tweens.add({
        targets: container,
        scaleX: 1,
        scaleY: 1,
        duration: 100,
      })
    })

    // 点击效果
    container.on('pointerdown', () => {
      this.scene.tweens.add({
        targets: container,
        scaleX: 0.95,
        scaleY: 0.95,
        duration: 50,
        yoyo: true,
        onComplete: () => config.onClick(),
      })
    })

    // 存储引用
    container.setData('bg', bg)
    container.setData('color', config.color)

    return container
  }

  private onPass(): void {
    if (!this.canPass) return
    this.eventBus.emitEvent('phaser:pass')
  }

  private onPlay(): void {
    this.eventBus.emitEvent('phaser:playCards', { cards: [] })
  }

  private onHint(): void {
    this.eventBus.emitEvent('phaser:hint')
  }

  // 显示按钮
  show(options: { canPass: boolean; canPlay: boolean }): void {
    this.canPass = options.canPass
    this.canPlay = options.canPlay

    this.updateButtonStates()

    this.setVisible(true)
    this.setAlpha(0)

    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      duration: ANIMATION.fadeIn,
      ease: 'Power2',
    })
  }

  // 更新按钮状态
  private updateButtonStates(): void {
    // 不出按钮
    if (this.passButton) {
      this.setButtonEnabled(this.passButton, this.canPass)
    }

    // 出牌按钮 - 初始禁用，选牌后启用
    if (this.playButton) {
      this.setButtonEnabled(this.playButton, this.canPlay)
    }
  }

  // 设置按钮启用/禁用
  private setButtonEnabled(button: Phaser.GameObjects.Container, enabled: boolean): void {
    const bg = button.getData('bg') as Phaser.GameObjects.Graphics
    const color = button.getData('color') as number
    const width = 100
    const height = 45

    bg.clear()
    if (enabled) {
      bg.fillStyle(color, 1)
      button.setInteractive({ useHandCursor: true })
    } else {
      bg.fillStyle(0x666666, 0.5)
      button.disableInteractive()
    }
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 8)
  }

  // 更新出牌按钮状态
  setPlayEnabled(enabled: boolean): void {
    this.canPlay = enabled
    if (this.playButton) {
      this.setButtonEnabled(this.playButton, enabled)
    }
  }

  // 隐藏按钮
  hide(): void {
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: ANIMATION.fadeOut,
      ease: 'Power2',
      onComplete: () => {
        this.setVisible(false)
      },
    })
  }
}
