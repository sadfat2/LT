import Phaser from 'phaser'
import { COLORS, FONTS, ANIMATION } from '../config'
import { getEventBus } from '../EventBus'

export class BidPanel extends Phaser.GameObjects.Container {
  private background: Phaser.GameObjects.Image
  private titleText: Phaser.GameObjects.Text
  private buttons: Phaser.GameObjects.Container[] = []
  private eventBus = getEventBus()
  private currentBid = 0

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y)

    // 背景面板
    this.background = scene.add.image(0, 0, 'panel_bg')
    this.add(this.background)

    // 标题
    this.titleText = scene.add.text(0, -60, '请叫分', {
      fontSize: `${FONTS.sizes.large}px`,
      color: '#ffffff',
      fontStyle: 'bold',
    })
    this.titleText.setOrigin(0.5)
    this.add(this.titleText)

    // 创建按钮
    this.createButtons()

    this.setVisible(false)
    this.setDepth(100)

    scene.add.existing(this)
  }

  private createButtons(): void {
    const buttonConfigs = [
      { text: '不叫', score: 0, color: COLORS.danger },
      { text: '1分', score: 1, color: COLORS.secondary },
      { text: '2分', score: 2, color: COLORS.warning },
      { text: '3分', score: 3, color: COLORS.success },
    ]

    const buttonWidth = 80
    const buttonHeight = 40
    const spacing = 10
    const totalWidth = buttonConfigs.length * buttonWidth + (buttonConfigs.length - 1) * spacing
    const startX = -totalWidth / 2 + buttonWidth / 2

    buttonConfigs.forEach((config, index) => {
      const x = startX + index * (buttonWidth + spacing)
      const button = this.createButton(x, 20, buttonWidth, buttonHeight, config)
      this.buttons.push(button)
      this.add(button)
    })
  }

  private createButton(
    x: number,
    y: number,
    width: number,
    height: number,
    config: { text: string; score: number; color: number }
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y)

    // 按钮背景
    const bg = this.scene.add.graphics()
    bg.fillStyle(config.color, 1)
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 8)
    container.add(bg)

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
        scaleX: 1.1,
        scaleY: 1.1,
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

    // 点击事件
    container.on('pointerdown', () => {
      this.onBid(config.score)
    })

    // 存储分数引用
    container.setData('score', config.score)
    container.setData('bg', bg)
    container.setData('color', config.color)

    return container
  }

  private onBid(score: number): void {
    // 发送叫分事件
    this.eventBus.emitEvent('phaser:bid', { score })

    // 隐藏面板
    this.hide()
  }

  // 显示面板
  show(currentBid: number): void {
    this.currentBid = currentBid
    this.updateButtons()

    this.setVisible(true)
    this.setAlpha(0)
    this.setScale(0.8)

    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: ANIMATION.fadeIn,
      ease: 'Back.easeOut',
    })
  }

  // 更新按钮状态
  private updateButtons(): void {
    this.buttons.forEach((button) => {
      const score = button.getData('score') as number
      const bg = button.getData('bg') as Phaser.GameObjects.Graphics
      const color = button.getData('color') as number

      // 如果分数小于等于当前叫分，禁用按钮（不叫除外）
      const disabled = score !== 0 && score <= this.currentBid

      if (disabled) {
        bg.clear()
        bg.fillStyle(0x666666, 0.5)
        bg.fillRoundedRect(-40, -20, 80, 40, 8)
        button.disableInteractive()
      } else {
        bg.clear()
        bg.fillStyle(color, 1)
        bg.fillRoundedRect(-40, -20, 80, 40, 8)
        button.setInteractive({ useHandCursor: true })
      }
    })
  }

  // 隐藏面板
  hide(): void {
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 0.8,
      scaleY: 0.8,
      duration: ANIMATION.fadeOut,
      ease: 'Power2',
      onComplete: () => {
        this.setVisible(false)
      },
    })
  }
}
