import Phaser from 'phaser'
import { getEventBus } from '../EventBus'

export class ChatButton extends Phaser.GameObjects.Container {
  private eventBus = getEventBus()
  private background: Phaser.GameObjects.Graphics
  private icon: Phaser.GameObjects.Text

  private readonly size = 50

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y)

    // 背景
    this.background = scene.add.graphics()
    this.drawBackground(false)
    this.add(this.background)

    // 聊天图标
    this.icon = scene.add.text(0, 0, '💬', {
      fontSize: '28px',
    })
    this.icon.setOrigin(0.5)
    this.add(this.icon)

    // 交互
    this.setSize(this.size, this.size)
    this.setInteractive({ useHandCursor: true })

    // 悬停效果
    this.on('pointerover', () => {
      this.drawBackground(true)
    })

    this.on('pointerout', () => {
      this.drawBackground(false)
    })

    // 点击切换聊天面板
    this.on('pointerdown', () => {
      this.eventBus.emitEvent('ui:toggleChatPanel')
    })

    this.setDepth(100)
    scene.add.existing(this)
  }

  private drawBackground(isHover: boolean): void {
    this.background.clear()

    // 圆形背景
    const color = isHover ? 0x4a8cca : 0x3498db
    this.background.fillStyle(color, 0.9)
    this.background.fillCircle(0, 0, this.size / 2)

    // 边框
    this.background.lineStyle(2, 0x2980b9, 1)
    this.background.strokeCircle(0, 0, this.size / 2)
  }
}
