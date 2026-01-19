import Phaser from 'phaser'

// 游戏尺寸配置
export const GAME_WIDTH = 1280
export const GAME_HEIGHT = 720

// 布局常量
export const LAYOUT = {
  // 底牌区域
  bottomCards: {
    x: GAME_WIDTH / 2,
    y: 60,
    spacing: 85,
  },

  // 玩家位置（三个玩家：0=自己下方，1=右边，2=左边）
  players: [
    { // 自己
      avatar: { x: 80, y: 580 },
      cards: { x: GAME_WIDTH / 2, y: 640 },
      playedCards: { x: GAME_WIDTH / 2, y: 450 },
      badge: { x: 140, y: 580 },
      timer: { x: 80, y: 520 },
    },
    { // 下家（右边）
      avatar: { x: GAME_WIDTH - 100, y: 280 },
      cards: { x: GAME_WIDTH - 100, y: 280 },
      playedCards: { x: GAME_WIDTH - 280, y: 350 },
      badge: { x: GAME_WIDTH - 40, y: 280 },
      timer: { x: GAME_WIDTH - 100, y: 220 },
    },
    { // 上家（左边）
      avatar: { x: 100, y: 280 },
      cards: { x: 100, y: 280 },
      playedCards: { x: 280, y: 350 },
      badge: { x: 160, y: 280 },
      timer: { x: 100, y: 220 },
    },
  ],

  // UI 元素位置
  ui: {
    bidPanel: { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 },
    actionButtons: { x: GAME_WIDTH / 2, y: 540 },
    resultPanel: { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 },
    gameInfo: { x: GAME_WIDTH - 20, y: 20 },
    chatPanel: { x: GAME_WIDTH - 160, y: GAME_HEIGHT - 200 },
    chatButton: { x: GAME_WIDTH - 50, y: GAME_HEIGHT - 50 },
  },

  // 表情气泡位置偏移（相对于玩家头像）
  emojiBubble: [
    { offsetX: 80, offsetY: -60 },   // 自己
    { offsetX: -80, offsetY: -60 },  // 下家（右边）
    { offsetX: 80, offsetY: -60 },   // 上家（左边）
  ],

  // 手牌配置
  handCards: {
    overlap: 35,  // 牌的重叠间距
    selectedOffset: -30, // 选中牌的上移距离
    maxWidth: 900, // 手牌最大宽度
  },

  // 出牌区配置
  playedCardsArea: {
    spacing: 30, // 出牌的间距
  },
}

// 扑克牌配置
export const CARD_CONFIG = {
  width: 90,
  height: 126,
  scale: 1,
  backColor: 0x1a5f2a,

  // 花色颜色
  suitColors: {
    spade: '#000000',
    club: '#000000',
    heart: '#e74c3c',
    diamond: '#e74c3c',
    joker: '#e74c3c',
  },

  // 花色符号
  suitSymbols: {
    spade: '\u2660',   // ♠
    club: '\u2663',    // ♣
    heart: '\u2665',   // ♥
    diamond: '\u2666', // ♦
  },

  // 点数显示
  rankDisplay: {
    '3': '3', '4': '4', '5': '5', '6': '6', '7': '7',
    '8': '8', '9': '9', '10': '10', 'J': 'J', 'Q': 'Q',
    'K': 'K', 'A': 'A', '2': '2', 'small': '小', 'big': '大',
  },
}

// 动画时长（毫秒）
export const ANIMATION = {
  deal: 150,        // 发牌
  play: 200,        // 出牌
  cardSelect: 100,  // 选牌
  cardArrange: 200, // 整理牌
  fadeIn: 300,      // 淡入
  fadeOut: 200,     // 淡出
  result: 500,      // 结果展示
  flip: 200,        // 翻牌
}

// 颜色配置
export const COLORS = {
  primary: 0xe74c3c,
  secondary: 0x3498db,
  success: 0x2ecc71,
  warning: 0xf39c12,
  danger: 0xe74c3c,

  bgPrimary: 0x1a5f2a,
  bgSecondary: 0x2d8b4e,
  bgDark: 0x0d3015,

  textLight: 0xffffff,
  textDark: 0x333333,

  cardSelected: 0xffeb3b,
  cardDisabled: 0x808080,
}

// 字体配置
export const FONTS = {
  primary: 'Arial, sans-serif',

  sizes: {
    small: 14,
    normal: 18,
    large: 24,
    xlarge: 32,
    xxlarge: 48,
  },
}

// Phaser 游戏配置
export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: COLORS.bgDark,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      antialias: true,
      pixelArt: false,
    },
    // 场景在 GameManager 中添加
    scene: [],
  }
}
