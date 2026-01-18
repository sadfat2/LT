import Phaser from 'phaser'
import { GAME_WIDTH, GAME_HEIGHT, CARD_CONFIG, COLORS } from '../config'
import { getEventBus } from '../EventBus'
import type { Suit, Rank } from '@/types'

export class BootScene extends Phaser.Scene {
  private loadingBar!: Phaser.GameObjects.Graphics
  private progressBar!: Phaser.GameObjects.Graphics
  private loadingText!: Phaser.GameObjects.Text

  constructor() {
    super({ key: 'BootScene' })
  }

  preload(): void {
    this.createLoadingUI()

    // 监听加载进度
    this.load.on('progress', (value: number) => {
      this.updateProgress(value)
    })

    this.load.on('complete', () => {
      this.loadingText.setText('生成扑克牌纹理...')
    })

    // 加载外部资源（如有）
    // this.load.image('card-back', '/assets/images/card-back.png')
    // this.load.image('landlord-badge', '/assets/images/landlord-badge.png')
  }

  create(): void {
    // 动态生成扑克牌纹理
    this.generateCardTextures()

    // 生成其他 UI 纹理
    this.generateUITextures()

    // 清理加载 UI
    this.loadingBar.destroy()
    this.progressBar.destroy()
    this.loadingText.destroy()

    // 发送完成事件
    getEventBus().emitEvent('scene:bootComplete')

    // 启动游戏场景
    this.scene.start('GameScene')
    this.scene.start('UIScene')
  }

  private createLoadingUI(): void {
    const centerX = GAME_WIDTH / 2
    const centerY = GAME_HEIGHT / 2

    // 背景条
    this.loadingBar = this.add.graphics()
    this.loadingBar.fillStyle(0x222222, 0.8)
    this.loadingBar.fillRect(centerX - 200, centerY - 15, 400, 30)

    // 进度条
    this.progressBar = this.add.graphics()

    // 加载文字
    this.loadingText = this.add.text(centerX, centerY - 50, '加载中...', {
      fontSize: '24px',
      color: '#ffffff',
    })
    this.loadingText.setOrigin(0.5)
  }

  private updateProgress(value: number): void {
    this.progressBar.clear()
    this.progressBar.fillStyle(COLORS.primary, 1)
    this.progressBar.fillRect(
      GAME_WIDTH / 2 - 195,
      GAME_HEIGHT / 2 - 10,
      390 * value,
      20
    )
    this.loadingText.setText(`加载中... ${Math.round(value * 100)}%`)
  }

  private generateCardTextures(): void {
    const { width, height } = CARD_CONFIG
    const suits: Suit[] = ['spade', 'heart', 'club', 'diamond']
    const ranks: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2']

    // 生成普通牌
    for (const suit of suits) {
      for (const rank of ranks) {
        const key = `card_${suit}_${rank}`
        this.generateCardTexture(key, suit, rank, width, height)
      }
    }

    // 生成大小王
    this.generateJokerTexture('card_joker_small', 'small', width, height)
    this.generateJokerTexture('card_joker_big', 'big', width, height)

    // 生成牌背
    this.generateCardBackTexture('card_back', width, height)
  }

  private generateCardTexture(
    key: string,
    suit: Suit,
    rank: Rank,
    width: number,
    height: number
  ): void {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!

    // 绘制牌面背景
    this.drawCardBackground(ctx, width, height)

    // 获取花色颜色
    const color = CARD_CONFIG.suitColors[suit]
    const symbol = CARD_CONFIG.suitSymbols[suit as keyof typeof CARD_CONFIG.suitSymbols]
    const rankText = CARD_CONFIG.rankDisplay[rank]

    // 绘制左上角点数
    ctx.font = 'bold 22px Arial'
    ctx.fillStyle = color
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(rankText, 8, 8)

    // 绘制左上角花色
    ctx.font = '18px Arial'
    ctx.fillText(symbol, 10, 32)

    // 绘制中央大花色
    ctx.font = '48px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(symbol, width / 2, height / 2)

    // 绘制右下角点数（倒置）
    ctx.save()
    ctx.translate(width - 8, height - 8)
    ctx.rotate(Math.PI)
    ctx.font = 'bold 22px Arial'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(rankText, 0, 0)
    ctx.font = '18px Arial'
    ctx.fillText(symbol, 2, 24)
    ctx.restore()

    // 创建纹理
    this.textures.addCanvas(key, canvas)
  }

  private generateJokerTexture(
    key: string,
    type: 'small' | 'big',
    width: number,
    height: number
  ): void {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!

    // 绘制牌面背景
    this.drawCardBackground(ctx, width, height)

    const color = type === 'big' ? '#e74c3c' : '#333333'
    const text = type === 'big' ? '大王' : '小王'
    const jokerText = 'JOKER'

    // 绘制 JOKER 文字（竖排）
    ctx.font = 'bold 16px Arial'
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // 左侧竖排
    const jokerChars = [...jokerText]
    for (let i = 0; i < jokerChars.length; i++) {
      ctx.fillText(jokerChars[i] ?? '', 15, 20 + i * 18)
    }

    // 中央大字
    ctx.font = 'bold 36px Arial'
    ctx.fillText(text, width / 2, height / 2)

    // 右侧竖排（倒置）
    ctx.save()
    ctx.translate(width - 15, height - 20)
    ctx.rotate(Math.PI)
    ctx.font = 'bold 16px Arial'
    for (let i = 0; i < jokerChars.length; i++) {
      ctx.fillText(jokerChars[i] ?? '', 0, i * 18)
    }
    ctx.restore()

    this.textures.addCanvas(key, canvas)
  }

  private generateCardBackTexture(key: string, width: number, height: number): void {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!

    // 绘制牌背
    ctx.fillStyle = '#1a5f2a'
    ctx.beginPath()
    ctx.roundRect(0, 0, width, height, 8)
    ctx.fill()

    // 绘制边框
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(4, 4, width - 8, height - 8, 6)
    ctx.stroke()

    // 绘制装饰图案
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
    const patternSize = 20
    for (let x = 10; x < width - 10; x += patternSize) {
      for (let y = 10; y < height - 10; y += patternSize) {
        if ((x + y) % (patternSize * 2) === 0) {
          ctx.fillRect(x, y, patternSize / 2, patternSize / 2)
        }
      }
    }

    this.textures.addCanvas(key, canvas)
  }

  private drawCardBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 白色背景
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.roundRect(0, 0, width, height, 8)
    ctx.fill()

    // 边框
    ctx.strokeStyle = '#cccccc'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(0, 0, width, height, 8)
    ctx.stroke()
  }

  private generateUITextures(): void {
    // 生成地主标识
    this.generateBadgeTexture('landlord_badge', '地主', 0xe74c3c)
    this.generateBadgeTexture('farmer_badge', '农民', 0x3498db)

    // 生成按钮背景
    this.generateButtonTexture('btn_primary', COLORS.primary, 120, 45)
    this.generateButtonTexture('btn_secondary', COLORS.secondary, 120, 45)
    this.generateButtonTexture('btn_success', COLORS.success, 120, 45)
    this.generateButtonTexture('btn_disabled', 0x666666, 120, 45)

    // 生成面板背景
    this.generatePanelTexture('panel_bg', 400, 200)
    this.generatePanelTexture('result_panel_bg', 500, 400)
  }

  private generateBadgeTexture(key: string, text: string, color: number): void {
    const size = 50
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!

    // 圆形背景
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
    ctx.fill()

    // 边框
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.stroke()

    // 文字
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 16px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, size / 2, size / 2)

    this.textures.addCanvas(key, canvas)
  }

  private generateButtonTexture(key: string, color: number, width: number, height: number): void {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!

    // 按钮背景
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    const colorHex = `#${color.toString(16).padStart(6, '0')}`
    gradient.addColorStop(0, colorHex)
    gradient.addColorStop(1, this.darkenColor(colorHex, 20))

    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.roundRect(0, 0, width, height, 8)
    ctx.fill()

    // 高光效果
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.beginPath()
    ctx.roundRect(2, 2, width - 4, height / 2 - 2, [6, 6, 0, 0])
    ctx.fill()

    this.textures.addCanvas(key, canvas)
  }

  private generatePanelTexture(key: string, width: number, height: number): void {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!

    // 半透明背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
    ctx.beginPath()
    ctx.roundRect(0, 0, width, height, 16)
    ctx.fill()

    // 边框
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(0, 0, width, height, 16)
    ctx.stroke()

    this.textures.addCanvas(key, canvas)
  }

  private darkenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16)
    const amt = Math.round(2.55 * percent)
    const R = Math.max((num >> 16) - amt, 0)
    const G = Math.max(((num >> 8) & 0x00ff) - amt, 0)
    const B = Math.max((num & 0x0000ff) - amt, 0)
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`
  }
}
