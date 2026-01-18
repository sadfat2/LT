import Phaser from 'phaser'
import { COLORS, FONTS } from '../config'
import type { Player, PlayerRole } from '@/types'

export class PlayerAvatar extends Phaser.GameObjects.Container {
  private background: Phaser.GameObjects.Graphics
  private avatarCircle: Phaser.GameObjects.Graphics
  private avatarText: Phaser.GameObjects.Text
  private nicknameText: Phaser.GameObjects.Text
  private cardCountText: Phaser.GameObjects.Text
  private roleBadge: Phaser.GameObjects.Image | null = null
  private offlineOverlay: Phaser.GameObjects.Graphics

  private playerData: Player | null = null

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y)

    // 背景框
    this.background = scene.add.graphics()
    this.background.fillStyle(0x000000, 0.5)
    this.background.fillRoundedRect(-50, -30, 100, 100, 8)
    this.add(this.background)

    // 头像圆形
    this.avatarCircle = scene.add.graphics()
    this.avatarCircle.fillStyle(COLORS.bgSecondary, 1)
    this.avatarCircle.fillCircle(0, 10, 30)
    this.avatarCircle.lineStyle(2, 0xffffff, 0.5)
    this.avatarCircle.strokeCircle(0, 10, 30)
    this.add(this.avatarCircle)

    // 头像文字（首字母）
    this.avatarText = scene.add.text(0, 10, '?', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
    })
    this.avatarText.setOrigin(0.5)
    this.add(this.avatarText)

    // 昵称
    this.nicknameText = scene.add.text(0, 50, '', {
      fontSize: `${FONTS.sizes.small}px`,
      color: '#ffffff',
    })
    this.nicknameText.setOrigin(0.5)
    this.add(this.nicknameText)

    // 剩余牌数
    this.cardCountText = scene.add.text(35, -20, '', {
      fontSize: `${FONTS.sizes.normal}px`,
      color: '#ffeb3b',
      fontStyle: 'bold',
    })
    this.cardCountText.setOrigin(0.5)
    this.add(this.cardCountText)

    // 离线遮罩
    this.offlineOverlay = scene.add.graphics()
    this.offlineOverlay.fillStyle(0x000000, 0.7)
    this.offlineOverlay.fillRoundedRect(-50, -30, 100, 100, 8)
    this.offlineOverlay.setVisible(false)
    this.add(this.offlineOverlay)

    scene.add.existing(this)
  }

  // 设置玩家数据
  setPlayer(player: Player): void {
    this.playerData = player

    // 更新头像文字
    const initial = player.nickname.charAt(0).toUpperCase()
    this.avatarText.setText(initial)

    // 更新昵称（限制长度）
    const displayName =
      player.nickname.length > 6 ? player.nickname.slice(0, 6) + '...' : player.nickname
    this.nicknameText.setText(displayName)

    // 更新牌数
    this.updateCardCount(player.cardCount)

    // 更新在线状态
    this.setOnline(player.isOnline)

    // 更新角色
    if (player.role) {
      this.setRole(player.role)
    }
  }

  // 更新牌数
  updateCardCount(count: number): void {
    this.cardCountText.setText(count > 0 ? `${count}` : '')
  }

  // 设置角色（地主/农民）
  setRole(role: PlayerRole): void {
    // 移除旧的角色标识
    if (this.roleBadge) {
      this.roleBadge.destroy()
      this.roleBadge = null
    }

    // 添加新的角色标识
    const badgeKey = role === 'landlord' ? 'landlord_badge' : 'farmer_badge'
    this.roleBadge = this.scene.add.image(-40, -20, badgeKey)
    this.roleBadge.setScale(0.8)
    this.add(this.roleBadge)

    // 角色标识动画
    this.scene.tweens.add({
      targets: this.roleBadge,
      scaleX: 1,
      scaleY: 1,
      duration: 200,
      ease: 'Back.easeOut',
    })
  }

  // 设置在线状态
  setOnline(isOnline: boolean): void {
    this.offlineOverlay.setVisible(!isOnline)
  }

  // 高亮显示（当前回合）
  setHighlight(highlight: boolean): void {
    if (highlight) {
      this.background.clear()
      this.background.fillStyle(COLORS.primary, 0.5)
      this.background.fillRoundedRect(-50, -30, 100, 100, 8)
      this.background.lineStyle(2, COLORS.primary, 1)
      this.background.strokeRoundedRect(-50, -30, 100, 100, 8)
    } else {
      this.background.clear()
      this.background.fillStyle(0x000000, 0.5)
      this.background.fillRoundedRect(-50, -30, 100, 100, 8)
    }
  }

  // 清除数据
  clear(): void {
    this.playerData = null
    this.avatarText.setText('?')
    this.nicknameText.setText('')
    this.cardCountText.setText('')
    this.setHighlight(false)
    this.offlineOverlay.setVisible(false)

    if (this.roleBadge) {
      this.roleBadge.destroy()
      this.roleBadge = null
    }
  }

  // 获取玩家数据
  getPlayer(): Player | null {
    return this.playerData
  }
}
