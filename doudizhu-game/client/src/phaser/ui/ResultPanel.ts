import Phaser from 'phaser'
import { COLORS, FONTS, ANIMATION, GAME_WIDTH, GAME_HEIGHT } from '../config'
import { getEventBus } from '../EventBus'
import type { GameResult } from '@/types'

export class ResultPanel extends Phaser.GameObjects.Container {
  private overlay: Phaser.GameObjects.Graphics
  private background: Phaser.GameObjects.Image
  private titleText: Phaser.GameObjects.Text
  private resultList: Phaser.GameObjects.Container
  private closeButton: Phaser.GameObjects.Container | null = null
  private eventBus = getEventBus()

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y)

    // 全屏遮罩
    this.overlay = scene.add.graphics()
    this.overlay.fillStyle(0x000000, 0.6)
    this.overlay.fillRect(-GAME_WIDTH / 2, -GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT)
    this.add(this.overlay)

    // 背景面板
    this.background = scene.add.image(0, 0, 'result_panel_bg')
    this.add(this.background)

    // 标题
    this.titleText = scene.add.text(0, -150, '', {
      fontSize: `${FONTS.sizes.xxlarge}px`,
      color: '#ffffff',
      fontStyle: 'bold',
    })
    this.titleText.setOrigin(0.5)
    this.add(this.titleText)

    // 结果列表容器
    this.resultList = scene.add.container(0, 0)
    this.add(this.resultList)

    // 关闭按钮
    this.createCloseButton()

    this.setVisible(false)
    this.setDepth(200)

    scene.add.existing(this)
  }

  private createCloseButton(): void {
    const width = 150
    const height = 50

    this.closeButton = this.scene.add.container(0, 140)

    // 按钮背景
    const bg = this.scene.add.graphics()
    bg.fillStyle(COLORS.primary, 1)
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 10)
    this.closeButton.add(bg)

    // 按钮文字
    const text = this.scene.add.text(0, 0, '确定', {
      fontSize: `${FONTS.sizes.large}px`,
      color: '#ffffff',
      fontStyle: 'bold',
    })
    text.setOrigin(0.5)
    this.closeButton.add(text)

    // 设置交互
    this.closeButton.setSize(width, height)
    this.closeButton.setInteractive({ useHandCursor: true })

    this.closeButton.on('pointerover', () => {
      this.scene.tweens.add({
        targets: this.closeButton,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 100,
      })
    })

    this.closeButton.on('pointerout', () => {
      this.scene.tweens.add({
        targets: this.closeButton,
        scaleX: 1,
        scaleY: 1,
        duration: 100,
      })
    })

    this.closeButton.on('pointerdown', () => {
      this.hide()
      this.eventBus.emitEvent('phaser:resultClosed')
    })

    this.add(this.closeButton)
  }

  // 显示结果
  show(isWin: boolean, results: GameResult[]): void {
    // 清除旧的结果列表
    this.resultList.removeAll(true)

    // 设置标题
    this.titleText.setText(isWin ? '胜利!' : '失败')
    this.titleText.setColor(isWin ? '#2ecc71' : '#e74c3c')

    // 添加结果条目
    results.forEach((result, index) => {
      const item = this.createResultItem(result, index)
      this.resultList.add(item)
    })

    // 显示动画
    this.setVisible(true)
    this.setAlpha(0)
    this.setScale(0.5)

    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: ANIMATION.result,
      ease: 'Back.easeOut',
    })

    // 胜利特效
    if (isWin) {
      this.playWinEffect()
    }
  }

  private createResultItem(result: GameResult, index: number): Phaser.GameObjects.Container {
    const y = -60 + index * 50
    const container = this.scene.add.container(0, y)

    // 角色图标
    const roleText = result.role === 'landlord' ? '地主' : '农民'
    const roleColor = result.role === 'landlord' ? '#e74c3c' : '#3498db'

    const roleLabel = this.scene.add.text(-150, 0, roleText, {
      fontSize: `${FONTS.sizes.normal}px`,
      color: roleColor,
      fontStyle: 'bold',
    })
    roleLabel.setOrigin(0, 0.5)
    container.add(roleLabel)

    // 胜负标记
    const statusText = result.isWin ? '胜' : '负'
    const statusColor = result.isWin ? '#2ecc71' : '#e74c3c'

    const statusLabel = this.scene.add.text(-50, 0, statusText, {
      fontSize: `${FONTS.sizes.normal}px`,
      color: statusColor,
      fontStyle: 'bold',
    })
    statusLabel.setOrigin(0.5)
    container.add(statusLabel)

    // 金币变化
    const coinText = result.coinChange >= 0 ? `+${result.coinChange}` : `${result.coinChange}`
    const coinColor = result.coinChange >= 0 ? '#f39c12' : '#e74c3c'

    const coinLabel = this.scene.add.text(100, 0, coinText, {
      fontSize: `${FONTS.sizes.large}px`,
      color: coinColor,
      fontStyle: 'bold',
    })
    coinLabel.setOrigin(0.5)
    container.add(coinLabel)

    // 金币图标
    const coinIcon = this.scene.add.text(150, 0, '💰', {
      fontSize: `${FONTS.sizes.large}px`,
    })
    coinIcon.setOrigin(0, 0.5)
    container.add(coinIcon)

    return container
  }

  private playWinEffect(): void {
    // 创建粒子效果（简化版）
    for (let i = 0; i < 20; i++) {
      const x = Phaser.Math.Between(-200, 200)
      const y = Phaser.Math.Between(-200, 200)
      const star = this.scene.add.text(x, y, '⭐', {
        fontSize: '24px',
      })
      star.setOrigin(0.5)
      this.add(star)

      this.scene.tweens.add({
        targets: star,
        y: y - 100,
        alpha: 0,
        scaleX: 0,
        scaleY: 0,
        duration: 1000,
        delay: i * 50,
        ease: 'Power2',
        onComplete: () => star.destroy(),
      })
    }
  }

  // 隐藏面板
  hide(): void {
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 0.5,
      scaleY: 0.5,
      duration: ANIMATION.fadeOut,
      ease: 'Power2',
      onComplete: () => {
        this.setVisible(false)
      },
    })
  }
}
