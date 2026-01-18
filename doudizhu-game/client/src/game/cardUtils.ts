/**
 * 斗地主扑克牌工具函数
 * 实现洗牌、发牌、排序等基础功能
 */

import type { Card, Suit, Rank } from '@/types'

// 牌点数对应的比较值（斗地主规则：3最小，大王最大）
const RANK_VALUES: Record<Rank, number> = {
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
  '2': 15,
  small: 16, // 小王
  big: 17, // 大王
}

// 花色列表（用于生成常规牌）
const SUITS: Suit[] = ['spade', 'heart', 'club', 'diamond']

// 点数列表（不含大小王）
const RANKS: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2']

/**
 * 创建一副完整的扑克牌（54张）
 * @returns Card[] 54张扑克牌
 */
export function createDeck(): Card[] {
  const cards: Card[] = []
  let id = 0

  // 创建52张常规牌
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({
        id: id++,
        suit,
        rank,
        value: RANK_VALUES[rank],
      })
    }
  }

  // 添加小王和大王
  cards.push({
    id: id++,
    suit: 'joker',
    rank: 'small',
    value: RANK_VALUES.small,
  })

  cards.push({
    id: id++,
    suit: 'joker',
    rank: 'big',
    value: RANK_VALUES.big,
  })

  return cards
}

/**
 * Fisher-Yates 洗牌算法
 * @param cards 要洗的牌
 * @returns Card[] 洗好的牌（返回新数组，不修改原数组）
 */
export function shuffleDeck(cards: Card[]): Card[] {
  const shuffled = [...cards]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * 发牌（斗地主规则：3人各17张，留3张底牌）
 * @returns { players: Card[][], bottomCards: Card[] }
 */
export function dealCards(): { players: Card[][]; bottomCards: Card[] } {
  const deck = shuffleDeck(createDeck())

  // 发牌：每人17张
  const players: Card[][] = [[], [], []]
  for (let i = 0; i < 51; i++) {
    players[i % 3].push(deck[i])
  }

  // 底牌：最后3张
  const bottomCards = deck.slice(51, 54)

  // 每个玩家的牌排序
  players.forEach((hand) => sortCards(hand))

  return { players, bottomCards }
}

/**
 * 手牌排序（从大到小）
 * @param cards 要排序的牌
 * @returns Card[] 排序后的牌（原地排序并返回）
 */
export function sortCards(cards: Card[]): Card[] {
  return cards.sort((a, b) => {
    // 先按点数从大到小排
    if (b.value !== a.value) {
      return b.value - a.value
    }
    // 点数相同按花色排（黑红梅方）
    const suitOrder: Record<Suit, number> = {
      spade: 4,
      heart: 3,
      club: 2,
      diamond: 1,
      joker: 5,
    }
    return suitOrder[b.suit] - suitOrder[a.suit]
  })
}

/**
 * 获取牌的显示名称
 * @param card 扑克牌
 * @returns string 显示名称（如 "黑桃A"）
 */
export function getCardName(card: Card): string {
  const suitNames: Record<Suit, string> = {
    spade: '♠',
    heart: '♥',
    club: '♣',
    diamond: '♦',
    joker: '',
  }

  if (card.suit === 'joker') {
    return card.rank === 'big' ? '大王' : '小王'
  }

  return `${suitNames[card.suit]}${card.rank}`
}

/**
 * 获取牌点数的数值（用于判断顺子等）
 * @param rank 牌点数
 * @returns number 数值
 */
export function getRankValue(rank: Rank): number {
  return RANK_VALUES[rank]
}

/**
 * 根据数值获取牌点数
 * @param value 数值
 * @returns Rank | undefined
 */
export function getValueRank(value: number): Rank | undefined {
  const entry = Object.entries(RANK_VALUES).find(([, v]) => v === value)
  return entry ? (entry[0] as Rank) : undefined
}

/**
 * 统计手牌中每种点数的数量
 * @param cards 手牌
 * @returns Map<number, Card[]> 点数值 -> 该点数的牌数组
 */
export function countByValue(cards: Card[]): Map<number, Card[]> {
  const map = new Map<number, Card[]>()
  for (const card of cards) {
    const existing = map.get(card.value) || []
    existing.push(card)
    map.set(card.value, existing)
  }
  return map
}

/**
 * 按数量分组（用于判断牌型）
 * @param cards 手牌
 * @returns { singles: Card[][], pairs: Card[][], triples: Card[][], quads: Card[][] }
 */
export function groupByCount(cards: Card[]): {
  singles: Card[][]
  pairs: Card[][]
  triples: Card[][]
  quads: Card[][]
} {
  const valueMap = countByValue(cards)
  const result = {
    singles: [] as Card[][],
    pairs: [] as Card[][],
    triples: [] as Card[][],
    quads: [] as Card[][],
  }

  for (const group of valueMap.values()) {
    switch (group.length) {
      case 1:
        result.singles.push(group)
        break
      case 2:
        result.pairs.push(group)
        break
      case 3:
        result.triples.push(group)
        break
      case 4:
        result.quads.push(group)
        break
    }
  }

  // 按点数从大到小排序
  result.singles.sort((a, b) => b[0].value - a[0].value)
  result.pairs.sort((a, b) => b[0].value - a[0].value)
  result.triples.sort((a, b) => b[0].value - a[0].value)
  result.quads.sort((a, b) => b[0].value - a[0].value)

  return result
}

/**
 * 检查是否为王炸（大小王）
 * @param cards 牌组
 * @returns boolean
 */
export function isRocket(cards: Card[]): boolean {
  if (cards.length !== 2) return false
  const values = cards.map((c) => c.value).sort((a, b) => a - b)
  return values[0] === RANK_VALUES.small && values[1] === RANK_VALUES.big
}

/**
 * 检查是否为炸弹（4张相同）
 * @param cards 牌组
 * @returns boolean
 */
export function isBomb(cards: Card[]): boolean {
  if (cards.length !== 4) return false
  return cards.every((c) => c.value === cards[0].value)
}

/**
 * 导出常量供其他模块使用
 */
export { RANK_VALUES, SUITS, RANKS }
