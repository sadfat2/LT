import Phaser from 'phaser'
import { LAYOUT } from '../config'
import { getEventBus } from '../EventBus'
import { BidPanel } from '../ui/BidPanel'
import { ActionButtons } from '../ui/ActionButtons'
import { ResultPanel } from '../ui/ResultPanel'
import { ChatPanel } from '../ui/ChatPanel'
import { ChatButton } from '../ui/ChatButton'
import type { GameResult } from '@/types'

export class UIScene extends Phaser.Scene {
  private eventBus = getEventBus()

  private bidPanel!: BidPanel
  private actionButtons!: ActionButtons
  private resultPanel!: ResultPanel
  private chatPanel!: ChatPanel
  // chatButton 创建后自动工作，不需要存储引用

  constructor() {
    super({ key: 'UIScene' })
  }

  create(): void {
    // 创建 UI 组件
    this.createUIComponents()

    // 设置事件监听
    this.setupEventListeners()
  }

  private createUIComponents(): void {
    // 叫地主面板
    this.bidPanel = new BidPanel(
      this,
      LAYOUT.ui.bidPanel.x,
      LAYOUT.ui.bidPanel.y
    )

    // 出牌按钮
    this.actionButtons = new ActionButtons(
      this,
      LAYOUT.ui.actionButtons.x,
      LAYOUT.ui.actionButtons.y
    )

    // 结算面板
    this.resultPanel = new ResultPanel(
      this,
      LAYOUT.ui.resultPanel.x,
      LAYOUT.ui.resultPanel.y
    )

    // 聊天面板
    this.chatPanel = new ChatPanel(
      this,
      LAYOUT.ui.chatPanel.x,
      LAYOUT.ui.chatPanel.y
    )

    // 聊天按钮（创建后自动工作）
    new ChatButton(
      this,
      LAYOUT.ui.chatButton.x,
      LAYOUT.ui.chatButton.y
    )
  }

  private setupEventListeners(): void {
    // 显示叫分面板
    this.eventBus.onEvent('ui:showBidPanel', ({ currentBid }) => {
      this.bidPanel.show(currentBid)
    })

    // 隐藏叫分面板
    this.eventBus.onEvent('ui:hideBidPanel', () => {
      this.bidPanel.hide()
    })

    // 显示出牌按钮
    this.eventBus.onEvent('ui:showActionButtons', ({ canPass, canPlay }) => {
      this.actionButtons.show({ canPass, canPlay })
    })

    // 隐藏出牌按钮
    this.eventBus.onEvent('ui:hideActionButtons', () => {
      this.actionButtons.hide()
    })

    // 显示结算面板
    this.eventBus.onEvent('ui:showResult', ({ results }) => {
      // 从结果中判断是否胜利（需要知道当前玩家ID）
      // 这里先用第一个结果的 isWin 作为示例
      const firstResult = results[0]
      const isWin = results.length > 0 && firstResult?.isWin === true
      this.resultPanel.show(isWin, results)
    })

    // 监听游戏结束事件
    this.eventBus.onEvent('vue:gameEnded', ({ results }) => {
      // 隐藏其他 UI
      this.bidPanel.hide()
      this.actionButtons.hide()

      // 延迟显示结算（等待最后一手牌动画完成）
      this.time.delayedCall(500, () => {
        const isWin = results.some((r: GameResult) => r.isWin)
        this.resultPanel.show(isWin, results)
      })
    })

    // 叫分后隐藏面板
    this.eventBus.onEvent('phaser:bid', () => {
      this.bidPanel.hide()
    })

    // 出牌后隐藏按钮
    this.eventBus.onEvent('phaser:playCards', () => {
      this.actionButtons.hide()
    })

    // 不出后隐藏按钮
    this.eventBus.onEvent('phaser:pass', () => {
      this.actionButtons.hide()
    })

    // 游戏重置
    this.eventBus.onEvent('vue:resetGame', () => {
      this.bidPanel.hide()
      this.actionButtons.hide()
      this.resultPanel.hide()
      this.chatPanel.hide()
    })

    // 切换聊天面板
    this.eventBus.onEvent('ui:toggleChatPanel', () => {
      this.chatPanel.toggle()
    })
  }

  // 更新出牌按钮状态
  updatePlayButton(canPlay: boolean): void {
    this.actionButtons.setPlayEnabled(canPlay)
  }

  // 获取叫分面板
  getBidPanel(): BidPanel {
    return this.bidPanel
  }

  // 获取出牌按钮
  getActionButtons(): ActionButtons {
    return this.actionButtons
  }

  // 获取结算面板
  getResultPanel(): ResultPanel {
    return this.resultPanel
  }
}
