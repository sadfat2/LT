import Phaser from 'phaser'
import { FONTS, ANIMATION } from '../config'
import { getEventBus } from '../EventBus'
import { EMOJIS, QUICK_MESSAGES } from '@/game/chatConstants'

type TabType = 'emoji' | 'quick'

export class ChatPanel extends Phaser.GameObjects.Container {
  private eventBus = getEventBus()
  private background: Phaser.GameObjects.Graphics
  private tabs: Phaser.GameObjects.Container[] = []
  private contentContainer: Phaser.GameObjects.Container
  private currentTab: TabType = 'emoji'

  // 面板尺寸
  private readonly panelWidth = 300
  private readonly panelHeight = 280

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y)

    // 背景
    this.background = scene.add.graphics()
    this.drawBackground()
    this.add(this.background)

    // 标签页
    this.createTabs()

    // 内容区域
    this.contentContainer = scene.add.container(0, 40)
    this.add(this.contentContainer)

    // 初始显示表情
    this.showEmojiContent()

    this.setVisible(false)
    this.setDepth(150)

    scene.add.existing(this)
  }

  private drawBackground(): void {
    this.background.clear()

    // 半透明深色背景
    this.background.fillStyle(0x1a1a2e, 0.95)
    this.background.fillRoundedRect(
      -this.panelWidth / 2,
      -this.panelHeight / 2,
      this.panelWidth,
      this.panelHeight,
      12
    )

    // 边框
    this.background.lineStyle(2, 0x4a4a6a, 1)
    this.background.strokeRoundedRect(
      -this.panelWidth / 2,
      -this.panelHeight / 2,
      this.panelWidth,
      this.panelHeight,
      12
    )
  }

  private createTabs(): void {
    const tabConfigs: { text: string; type: TabType }[] = [
      { text: '表情', type: 'emoji' },
      { text: '快捷消息', type: 'quick' },
    ]

    const tabWidth = this.panelWidth / 2
    const tabHeight = 36
    const startX = -this.panelWidth / 2

    tabConfigs.forEach((config, index) => {
      const x = startX + tabWidth / 2 + index * tabWidth
      const y = -this.panelHeight / 2 + tabHeight / 2 + 4

      const tab = this.createTab(x, y, tabWidth - 8, tabHeight - 4, config)
      this.tabs.push(tab)
      this.add(tab)
    })
  }

  private createTab(
    x: number,
    y: number,
    width: number,
    height: number,
    config: { text: string; type: TabType }
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y)

    // 背景
    const bg = this.scene.add.graphics()
    container.add(bg)

    // 文字
    const text = this.scene.add.text(0, 0, config.text, {
      fontSize: `${FONTS.sizes.normal}px`,
      color: '#ffffff',
    })
    text.setOrigin(0.5)
    container.add(text)

    // 设置交互
    container.setSize(width, height)
    container.setInteractive({ useHandCursor: true })

    // 点击切换
    container.on('pointerdown', () => {
      this.switchTab(config.type)
    })

    // 存储引用
    container.setData('type', config.type)
    container.setData('bg', bg)
    container.setData('width', width)
    container.setData('height', height)

    // 初始样式
    this.updateTabStyle(container, config.type === this.currentTab)

    return container
  }

  private updateTabStyle(tab: Phaser.GameObjects.Container, isActive: boolean): void {
    const bg = tab.getData('bg') as Phaser.GameObjects.Graphics
    const width = tab.getData('width') as number
    const height = tab.getData('height') as number

    bg.clear()
    if (isActive) {
      bg.fillStyle(0x3498db, 1)
    } else {
      bg.fillStyle(0x2a2a4a, 1)
    }
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 6)
  }

  private switchTab(type: TabType): void {
    if (this.currentTab === type) return

    this.currentTab = type

    // 更新标签样式
    this.tabs.forEach(tab => {
      const tabType = tab.getData('type') as TabType
      this.updateTabStyle(tab, tabType === type)
    })

    // 更新内容
    if (type === 'emoji') {
      this.showEmojiContent()
    } else {
      this.showQuickMessageContent()
    }
  }

  private showEmojiContent(): void {
    this.contentContainer.removeAll(true)

    const cols = 4
    const cellSize = 60
    const startX = -cellSize * (cols - 1) / 2
    const startY = 10

    EMOJIS.forEach((emoji, index) => {
      const row = Math.floor(index / cols)
      const col = index % cols
      const x = startX + col * cellSize
      const y = startY + row * cellSize

      const button = this.createEmojiButton(x, y, emoji.symbol, emoji.id)
      this.contentContainer.add(button)
    })
  }

  private createEmojiButton(
    x: number,
    y: number,
    symbol: string,
    emojiId: string
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y)
    const size = 50

    // 背景
    const bg = this.scene.add.graphics()
    bg.fillStyle(0x3a3a5a, 1)
    bg.fillRoundedRect(-size / 2, -size / 2, size, size, 8)
    container.add(bg)

    // 表情符号
    const text = this.scene.add.text(0, 0, symbol, {
      fontSize: '32px',
    })
    text.setOrigin(0.5)
    container.add(text)

    // 交互
    container.setSize(size, size)
    container.setInteractive({ useHandCursor: true })

    // 悬停效果
    container.on('pointerover', () => {
      bg.clear()
      bg.fillStyle(0x5a5a7a, 1)
      bg.fillRoundedRect(-size / 2, -size / 2, size, size, 8)
    })

    container.on('pointerout', () => {
      bg.clear()
      bg.fillStyle(0x3a3a5a, 1)
      bg.fillRoundedRect(-size / 2, -size / 2, size, size, 8)
    })

    // 点击发送表情
    container.on('pointerdown', () => {
      this.eventBus.emitEvent('phaser:sendEmoji', { emojiId })
      this.hide()
    })

    return container
  }

  private showQuickMessageContent(): void {
    this.contentContainer.removeAll(true)

    const itemHeight = 40
    const itemWidth = this.panelWidth - 24
    const startY = 10

    QUICK_MESSAGES.forEach((msg, index) => {
      const y = startY + index * (itemHeight + 4)
      const button = this.createMessageButton(0, y, itemWidth, itemHeight, msg.text, msg.id)
      this.contentContainer.add(button)
    })
  }

  private createMessageButton(
    x: number,
    y: number,
    width: number,
    height: number,
    text: string,
    messageId: string
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y)

    // 背景
    const bg = this.scene.add.graphics()
    bg.fillStyle(0x3a3a5a, 1)
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 6)
    container.add(bg)

    // 文字（截断过长的文字）
    const displayText = text.length > 18 ? text.substring(0, 18) + '...' : text
    const textObj = this.scene.add.text(0, 0, displayText, {
      fontSize: `${FONTS.sizes.normal}px`,
      color: '#ffffff',
    })
    textObj.setOrigin(0.5)
    container.add(textObj)

    // 交互
    container.setSize(width, height)
    container.setInteractive({ useHandCursor: true })

    // 悬停效果
    container.on('pointerover', () => {
      bg.clear()
      bg.fillStyle(0x5a5a7a, 1)
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, 6)
    })

    container.on('pointerout', () => {
      bg.clear()
      bg.fillStyle(0x3a3a5a, 1)
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, 6)
    })

    // 点击发送快捷消息
    container.on('pointerdown', () => {
      this.eventBus.emitEvent('phaser:sendQuickMessage', { messageId })
      this.hide()
    })

    return container
  }

  // 切换显示/隐藏
  toggle(): void {
    if (this.visible) {
      this.hide()
    } else {
      this.show()
    }
  }

  // 显示面板
  show(): void {
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
