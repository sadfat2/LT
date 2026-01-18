/**
 * 斗地主游戏核心逻辑
 * 导出所有游戏相关函数
 */

// 扑克牌工具函数
export {
  createDeck,
  shuffleDeck,
  dealCards,
  sortCards,
  getCardName,
  getRankValue,
  getValueRank,
  countByValue,
  groupByCount,
  isRocket,
  isBomb,
  RANK_VALUES,
  SUITS,
  RANKS,
} from './cardUtils'

// 牌型判断
export { getCardPattern, getPatternName, isBombType } from './cardTypes'

// 牌型比较
export {
  compareCards,
  comparePatterns,
  canBeat,
  findBeatingPatterns,
  getHint,
  type CompareResult,
} from './cardCompare'
