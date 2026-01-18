import Phaser from 'phaser'
import { COLORS, FONTS, ANIMATION } from '../config'

export class Timer extends Phaser.GameObjects.Container {
  private background: Phaser.GameObjects.Graphics
  private timeText: Phaser.GameObjects.Text
  private progressArc: Phaser.GameObjects.Graphics

  private maxTime = 30
  private currentTime = 0
  private timerEvent: Phaser.Time.TimerEvent | null = null
  private onTimeout: (() => void) | null = null

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y)

    // 背景圆圈
    this.background = scene.add.graphics()
    this.background.fillStyle(0x000000, 0.7)
    this.background.fillCircle(0, 0, 35)
    this.add(this.background)

    // 进度弧线
    this.progressArc = scene.add.graphics()
    this.add(this.progressArc)

    // 时间文字
    this.timeText = scene.add.text(0, 0, '', {
      fontSize: `${FONTS.sizes.large}px`,
      color: '#ffffff',
      fontStyle: 'bold',
    })
    this.timeText.setOrigin(0.5)
    this.add(this.timeText)

    this.setVisible(false)
    scene.add.existing(this)
  }

  // 开始计时
  start(seconds: number, onTimeout?: () => void): void {
    this.stop()

    this.maxTime = seconds
    this.currentTime = seconds
    this.onTimeout = onTimeout || null

    this.updateDisplay()
    this.setVisible(true)

    // 淡入动画
    this.setAlpha(0)
    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      duration: ANIMATION.fadeIn,
      ease: 'Power2',
    })

    // 开始计时
    this.timerEvent = this.scene.time.addEvent({
      delay: 1000,
      callback: this.tick,
      callbackScope: this,
      repeat: seconds - 1,
    })
  }

  // 每秒更新
  private tick(): void {
    this.currentTime--
    this.updateDisplay()

    if (this.currentTime <= 0) {
      this.hide()
      if (this.onTimeout) {
        this.onTimeout()
      }
    }
  }

  // 更新显示
  private updateDisplay(): void {
    // 更新文字
    this.timeText.setText(`${this.currentTime}`)

    // 更新颜色
    if (this.currentTime <= 5) {
      this.timeText.setColor('#ff4444')
    } else if (this.currentTime <= 10) {
      this.timeText.setColor('#ffaa00')
    } else {
      this.timeText.setColor('#ffffff')
    }

    // 更新进度弧线
    this.updateProgressArc()
  }

  // 更新进度弧线
  private updateProgressArc(): void {
    this.progressArc.clear()

    const progress = this.currentTime / this.maxTime
    const startAngle = -Math.PI / 2
    const endAngle = startAngle + Math.PI * 2 * progress

    // 背景弧线
    this.progressArc.lineStyle(4, 0x333333, 0.5)
    this.progressArc.beginPath()
    this.progressArc.arc(0, 0, 30, 0, Math.PI * 2)
    this.progressArc.strokePath()

    // 进度弧线
    const color =
      this.currentTime <= 5
        ? 0xff4444
        : this.currentTime <= 10
          ? 0xffaa00
          : COLORS.success

    this.progressArc.lineStyle(4, color, 1)
    this.progressArc.beginPath()
    this.progressArc.arc(0, 0, 30, startAngle, endAngle)
    this.progressArc.strokePath()
  }

  // 停止计时
  stop(): void {
    if (this.timerEvent) {
      this.timerEvent.remove()
      this.timerEvent = null
    }
    this.onTimeout = null
  }

  // 隐藏
  hide(): void {
    this.stop()

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

  // 更新剩余时间
  setTime(seconds: number): void {
    this.currentTime = seconds
    this.updateDisplay()
  }

  // 获取当前时间
  getTime(): number {
    return this.currentTime
  }

  // 销毁
  destroy(fromScene?: boolean): void {
    this.stop()
    super.destroy(fromScene)
  }
}
