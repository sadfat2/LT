// Phaser 游戏模块入口

// 配置
export * from './config'

// 事件总线
export { getEventBus, destroyEventBus } from './EventBus'
export type { GameEvents } from './EventBus'

// 游戏管理器
export { GameManager, getGameManager, destroyGameManager } from './GameManager'

// 场景
export { BootScene } from './scenes/BootScene'
export { GameScene } from './scenes/GameScene'
export { UIScene } from './scenes/UIScene'

// 游戏对象
export { CardSprite } from './objects/Card'
export { CardGroup } from './objects/CardGroup'
export { PlayedCardsArea } from './objects/PlayedCardsArea'
export { PlayerAvatar } from './objects/PlayerAvatar'
export { Timer } from './objects/Timer'

// UI 组件
export { BidPanel } from './ui/BidPanel'
export { ActionButtons } from './ui/ActionButtons'
export { ResultPanel } from './ui/ResultPanel'

// 动画工具
export * from './animations'
