import Phaser from 'phaser'
import { FONTS, ANIMATION } from '../config'

export class EmojiBubble extends Phaser.GameObjects.Container {
  private background: Phaser.GameObjects.Graphics
  private emojiText: Phaser.GameObjects.Text
  private messageText: Phaser.GameObjects.Text
  private hideTimer?: Phaser.Time.TimerEvent

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y)

    // 背景气泡
    this.background = scene.add.graphics()
    this.add(this.background)

    // 表情文字（用于显示 emoji 符号）
    this.emojiText = scene.add.text(0, 0, '', {
      fontSize: '48px',
    })
    this.emojiText.setOrigin(0.5)
    this.add(this.emojiText)

    // 消息文字（用于显示快捷消息）
    this.messageText = scene.add.text(0, 0, '', {
      fontSize: `${FONTS.sizes.normal}px`,
      color: '#333333',
      wordWrap: { width: 160 },
      align: 'center',
    })
    this.messageText.setOrigin(0.5)
    this.add(this.messageText)

    this.setVisible(false)
    this.setDepth(200)

    scene.add.existing(this)
  }

  // 显示表情
  showEmoji(symbol: string): void {
    // 清除之前的隐藏计时器
    if (this.hideTimer) {
      this.hideTimer.destroy()
    }

    // 设置表情
    this.emojiText.setText(symbol)
    this.emojiText.setVisible(true)
    this.messageText.setVisible(false)

    // 绘制圆形背景
    this.drawBackground(70, 70, true)

    // 显示动画
    this.playShowAnimation()

    // 3秒后自动隐藏
    this.hideTimer = this.scene.time.delayedCall(3000, () => {
      this.hide()
    })
  }

  // 显示快捷消息
  showMessage(text: string): void {
    // 清除之前的隐藏计时器
    if (this.hideTimer) {
      this.hideTimer.destroy()
    }

    // 设置消息文字
    this.messageText.setText(text)
    this.emojiText.setVisible(false)
    this.messageText.setVisible(true)

    // 计算消息背景大小
    const padding = 16
    const width = Math.max(this.messageText.width + padding * 2, 80)
    const height = this.messageText.height + padding * 2

    // 绘制圆角矩形背景
    this.drawBackground(width, height, false)

    // 显示动画
    this.playShowAnimation()

    // 4秒后自动隐藏
    this.hideTimer = this.scene.time.delayedCall(4000, () => {
      this.hide()
    })
  }

  // 绘制背景
  private drawBackground(width: number, height: number, isCircle: boolean): void {
    this.background.clear()

    // 白色背景
    this.background.fillStyle(0xffffff, 0.95)

    if (isCircle) {
      // 圆形背景（表情）
      this.background.fillCircle(0, 0, width / 2)
      // 边框
      this.background.lineStyle(2, 0xcccccc, 1)
      this.background.strokeCircle(0, 0, width / 2)
    } else {
      // 圆角矩形背景（消息）
      this.background.fillRoundedRect(-width / 2, -height / 2, width, height, 12)
      // 边框
      this.background.lineStyle(2, 0xcccccc, 1)
      this.background.strokeRoundedRect(-width / 2, -height / 2, width, height, 12)
    }

    // 小三角指向玩家头像
    this.background.fillStyle(0xffffff, 0.95)
    this.background.fillTriangle(
      -10, height / 2 - 5,
      10, height / 2 - 5,
      0, height / 2 + 10
    )
  }

  // 播放显示动画
  private playShowAnimation(): void {
    this.setVisible(true)
    this.setAlpha(0)
    this.setScale(0.5)

    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: ANIMATION.fadeIn,
      ease: 'Back.easeOut',
    })
  }

  // 隐藏
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

  // 销毁
  destroy(fromScene?: boolean): void {
    if (this.hideTimer) {
      this.hideTimer.destroy()
    }
    super.destroy(fromScene)
  }
}
