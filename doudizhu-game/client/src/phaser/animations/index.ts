import Phaser from 'phaser'
import { ANIMATION, COLORS } from '../config'
import { CardSprite } from '../objects/Card'

/**
 * 发牌动画
 * 从指定位置将牌飞入到目标位置
 */
export function dealAnimation(
  scene: Phaser.Scene,
  cards: CardSprite[],
  fromX: number,
  fromY: number,
  positions: { x: number; y: number }[],
  options?: {
    stagger?: number // 每张牌的间隔时间
    duration?: number
    faceUp?: boolean
  }
): Promise<void> {
  return new Promise((resolve) => {
    const stagger = options?.stagger ?? 50
    const duration = options?.duration ?? ANIMATION.deal
    const faceUp = options?.faceUp ?? true

    let completed = 0

    cards.forEach((card, index) => {
      const pos = positions[index]
      if (!pos) return

      // 设置初始位置
      card.setPosition(fromX, fromY)
      card.setScale(0.5)
      card.setAlpha(0)
      card.setFaceUp(false)

      // 延迟飞入
      scene.time.delayedCall(index * stagger, () => {
        scene.tweens.add({
          targets: card,
          x: pos.x,
          y: pos.y,
          scaleX: 1,
          scaleY: 1,
          alpha: 1,
          duration,
          ease: 'Power2.easeOut',
          onComplete: () => {
            // 翻牌
            if (faceUp) {
              card.setFaceUp(true, true)
            }

            completed++
            if (completed >= cards.length) {
              resolve()
            }
          },
        })
      })
    })

    // 如果没有牌，直接 resolve
    if (cards.length === 0) {
      resolve()
    }
  })
}

/**
 * 出牌动画
 * 将选中的牌飞向出牌区
 */
export function playCardsAnimation(
  scene: Phaser.Scene,
  cards: CardSprite[],
  targetX: number,
  targetY: number,
  options?: {
    duration?: number
    scale?: number
    stagger?: number
  }
): Promise<void> {
  return new Promise((resolve) => {
    const duration = options?.duration ?? ANIMATION.play
    const scale = options?.scale ?? 0.7
    const stagger = options?.stagger ?? 30

    let completed = 0

    cards.forEach((card, index) => {
      // 计算目标位置（居中排列）
      const spacing = 30
      const startX = targetX - ((cards.length - 1) * spacing) / 2
      const finalX = startX + index * spacing

      scene.time.delayedCall(index * stagger, () => {
        scene.tweens.add({
          targets: card,
          x: finalX,
          y: targetY,
          scaleX: scale,
          scaleY: scale,
          duration,
          ease: 'Power2.easeOut',
          onComplete: () => {
            completed++
            if (completed >= cards.length) {
              resolve()
            }
          },
        })
      })
    })

    if (cards.length === 0) {
      resolve()
    }
  })
}

/**
 * 胜利动画
 * 金币飞入效果
 */
export function winAnimation(
  scene: Phaser.Scene,
  targetX: number,
  targetY: number,
  coinCount: number = 10
): Promise<void> {
  return new Promise((resolve) => {
    const graphics: Phaser.GameObjects.Text[] = []
    let completed = 0

    for (let i = 0; i < coinCount; i++) {
      // 随机起始位置
      const startX = Phaser.Math.Between(100, scene.cameras.main.width - 100)
      const startY = scene.cameras.main.height + 50

      // 创建金币符号
      const coin = scene.add.text(startX, startY, '💰', {
        fontSize: '32px',
      })
      coin.setOrigin(0.5)
      coin.setDepth(1000)
      graphics.push(coin)

      // 飞入动画
      scene.tweens.add({
        targets: coin,
        x: targetX + Phaser.Math.Between(-30, 30),
        y: targetY + Phaser.Math.Between(-30, 30),
        scaleX: 0.5,
        scaleY: 0.5,
        alpha: 0,
        duration: 1000,
        delay: i * 100,
        ease: 'Power2.easeIn',
        onComplete: () => {
          coin.destroy()
          completed++
          if (completed >= coinCount) {
            resolve()
          }
        },
      })
    }
  })
}

/**
 * 失败动画
 * 简单的抖动效果
 */
export function loseAnimation(scene: Phaser.Scene, target: Phaser.GameObjects.Container): Promise<void> {
  return new Promise((resolve) => {
    scene.tweens.add({
      targets: target,
      x: target.x + 10,
      duration: 50,
      yoyo: true,
      repeat: 5,
      ease: 'Power2',
      onComplete: () => resolve(),
    })
  })
}

/**
 * 淡入动画
 */
export function fadeIn(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject,
  duration: number = ANIMATION.fadeIn
): Promise<void> {
  return new Promise((resolve) => {
    if ('setAlpha' in target) {
      (target as Phaser.GameObjects.Container).setAlpha(0)
    }

    scene.tweens.add({
      targets: target,
      alpha: 1,
      duration,
      ease: 'Power2',
      onComplete: () => resolve(),
    })
  })
}

/**
 * 淡出动画
 */
export function fadeOut(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject,
  duration: number = ANIMATION.fadeOut
): Promise<void> {
  return new Promise((resolve) => {
    scene.tweens.add({
      targets: target,
      alpha: 0,
      duration,
      ease: 'Power2',
      onComplete: () => resolve(),
    })
  })
}

/**
 * 缩放弹出动画
 */
export function popIn(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Container,
  duration: number = 300
): Promise<void> {
  return new Promise((resolve) => {
    target.setScale(0)
    target.setAlpha(0)

    scene.tweens.add({
      targets: target,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration,
      ease: 'Back.easeOut',
      onComplete: () => resolve(),
    })
  })
}

/**
 * 缩放消失动画
 */
export function popOut(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Container,
  duration: number = 200
): Promise<void> {
  return new Promise((resolve) => {
    scene.tweens.add({
      targets: target,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration,
      ease: 'Back.easeIn',
      onComplete: () => resolve(),
    })
  })
}

/**
 * 高亮闪烁动画
 */
export function highlight(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Container,
  color: number = COLORS.primary,
  duration: number = 500,
  repeat: number = 2
): Promise<void> {
  return new Promise((resolve) => {
    // 创建高亮遮罩
    const bounds = target.getBounds()
    const graphics = scene.add.graphics()
    graphics.fillStyle(color, 0.3)
    graphics.fillRoundedRect(
      bounds.x - target.x,
      bounds.y - target.y,
      bounds.width,
      bounds.height,
      8
    )
    target.add(graphics)

    // 闪烁动画
    scene.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: duration / 2,
      yoyo: true,
      repeat,
      ease: 'Power2',
      onComplete: () => {
        graphics.destroy()
        resolve()
      },
    })
  })
}

/**
 * 震动屏幕效果
 */
export function shakeCamera(scene: Phaser.Scene, intensity: number = 0.01, duration: number = 200): void {
  scene.cameras.main.shake(duration, intensity)
}

/**
 * 数字滚动动画
 */
export function numberRoll(
  scene: Phaser.Scene,
  textObject: Phaser.GameObjects.Text,
  from: number,
  to: number,
  duration: number = 1000,
  prefix: string = '',
  suffix: string = ''
): Promise<void> {
  return new Promise((resolve) => {
    const obj = { value: from }

    scene.tweens.add({
      targets: obj,
      value: to,
      duration,
      ease: 'Power2',
      onUpdate: () => {
        textObject.setText(`${prefix}${Math.round(obj.value)}${suffix}`)
      },
      onComplete: () => {
        textObject.setText(`${prefix}${to}${suffix}`)
        resolve()
      },
    })
  })
}
