/**
 * 斗地主牌型比较
 * 实现牌型大小比较逻辑
 */

import type { Card, CardPattern } from '@/types'
import { getCardPattern, isBombType } from './cardTypes'

/**
 * 比较结果
 * 1: 牌组A大于牌组B
 * 0: 相等（通常表示无法比较）
 * -1: 牌组A小于牌组B
 */
export type CompareResult = 1 | 0 | -1

/**
 * 比较两组牌的大小
 * @param cardsA 出的牌
 * @param cardsB 上一手牌
 * @returns CompareResult
 */
export function compareCards(cardsA: Card[], cardsB: Card[]): CompareResult {
  const patternA = getCardPattern(cardsA)
  const patternB = getCardPattern(cardsB)

  if (!patternA || !patternB) return 0

  return comparePatterns(patternA, patternB)
}

/**
 * 比较两个牌型的大小
 * @param patternA 要出的牌型
 * @param patternB 上一手牌型
 * @returns CompareResult
 */
export function comparePatterns(patternA: CardPattern, patternB: CardPattern): CompareResult {
  // 王炸最大
  if (patternA.type === 'rocket') return 1
  if (patternB.type === 'rocket') return -1

  // 炸弹比较
  if (patternA.type === 'bomb' && patternB.type === 'bomb') {
    // 两个炸弹比较点数
    return patternA.mainValue > patternB.mainValue ? 1 : -1
  }

  // 炸弹压制非炸弹
  if (patternA.type === 'bomb') return 1
  if (patternB.type === 'bomb') return -1

  // 普通牌型：必须类型相同才能比较
  if (patternA.type !== patternB.type) return 0

  // 顺子和连对：还需要长度相同
  if (patternA.type === 'straight' || patternA.type === 'straight_pair' || patternA.type === 'plane' || patternA.type === 'plane_wings') {
    if (patternA.length !== patternB.length) return 0
  }

  // 同类型比较主牌点数
  if (patternA.mainValue > patternB.mainValue) return 1
  if (patternA.mainValue < patternB.mainValue) return -1
  return 0
}

/**
 * 判断是否可以出牌（压过上一手）
 * @param cards 要出的牌
 * @param lastPlay 上一手牌型
 * @returns boolean
 */
export function canBeat(cards: Card[], lastPlay: CardPattern | null): boolean {
  // 没有上一手牌，任何有效牌型都可以出
  if (!lastPlay) {
    return getCardPattern(cards) !== null
  }

  const pattern = getCardPattern(cards)
  if (!pattern) return false

  return comparePatterns(pattern, lastPlay) === 1
}

/**
 * 从手牌中找出所有能压过指定牌型的组合
 * @param handCards 手牌
 * @param lastPlay 上一手牌型（null表示可以自由出牌）
 * @returns CardPattern[] 所有能出的牌型
 */
export function findBeatingPatterns(handCards: Card[], lastPlay: CardPattern | null): CardPattern[] {
  const results: CardPattern[] = []

  if (!lastPlay) {
    // 自由出牌，返回所有可能的单张组合作为基础提示
    return findAllPatterns(handCards).slice(0, 10)
  }

  // 根据上一手的类型，找出能压过的牌
  switch (lastPlay.type) {
    case 'single':
      results.push(...findBiggerSingles(handCards, lastPlay.mainValue))
      break
    case 'pair':
      results.push(...findBiggerPairs(handCards, lastPlay.mainValue))
      break
    case 'triple':
      results.push(...findBiggerTriples(handCards, lastPlay.mainValue))
      break
    case 'triple_one':
      results.push(...findBiggerTripleOnes(handCards, lastPlay.mainValue))
      break
    case 'triple_two':
      results.push(...findBiggerTripleTwos(handCards, lastPlay.mainValue))
      break
    case 'straight':
      results.push(...findBiggerStraights(handCards, lastPlay.mainValue, lastPlay.length!))
      break
    case 'straight_pair':
      results.push(...findBiggerStraightPairs(handCards, lastPlay.mainValue, lastPlay.length!))
      break
    case 'plane':
    case 'plane_wings':
      results.push(...findBiggerPlanes(handCards, lastPlay.mainValue, lastPlay.length!))
      break
    case 'four_two':
      results.push(...findBiggerFourTwos(handCards, lastPlay.mainValue))
      break
    case 'bomb':
      results.push(...findBiggerBombs(handCards, lastPlay.mainValue))
      break
  }

  // 添加炸弹和王炸（除非上一手已经是炸弹，则只找更大的炸弹）
  if (lastPlay.type !== 'bomb' && lastPlay.type !== 'rocket') {
    results.push(...findAllBombs(handCards))
  }

  // 添加王炸
  const rocket = findRocket(handCards)
  if (rocket) results.push(rocket)

  return results
}

/**
 * 找出所有比指定值大的单张
 */
function findBiggerSingles(cards: Card[], minValue: number): CardPattern[] {
  const results: CardPattern[] = []
  const seen = new Set<number>()

  for (const card of cards) {
    if (card.value > minValue && !seen.has(card.value)) {
      seen.add(card.value)
      results.push({
        type: 'single',
        cards: [card],
        mainValue: card.value,
      })
    }
  }

  return results.sort((a, b) => a.mainValue - b.mainValue)
}

/**
 * 找出所有比指定值大的对子
 */
function findBiggerPairs(cards: Card[], minValue: number): CardPattern[] {
  const results: CardPattern[] = []
  const valueMap = new Map<number, Card[]>()

  for (const card of cards) {
    if (card.suit === 'joker') continue // 王不能组成对子
    const existing = valueMap.get(card.value) || []
    existing.push(card)
    valueMap.set(card.value, existing)
  }

  for (const [value, group] of valueMap.entries()) {
    if (value > minValue && group.length >= 2) {
      results.push({
        type: 'pair',
        cards: group.slice(0, 2),
        mainValue: value,
      })
    }
  }

  return results.sort((a, b) => a.mainValue - b.mainValue)
}

/**
 * 找出所有比指定值大的三张
 */
function findBiggerTriples(cards: Card[], minValue: number): CardPattern[] {
  const results: CardPattern[] = []
  const valueMap = new Map<number, Card[]>()

  for (const card of cards) {
    const existing = valueMap.get(card.value) || []
    existing.push(card)
    valueMap.set(card.value, existing)
  }

  for (const [value, group] of valueMap.entries()) {
    if (value > minValue && group.length >= 3) {
      results.push({
        type: 'triple',
        cards: group.slice(0, 3),
        mainValue: value,
      })
    }
  }

  return results.sort((a, b) => a.mainValue - b.mainValue)
}

/**
 * 找出所有比指定值大的三带一
 */
function findBiggerTripleOnes(cards: Card[], minValue: number): CardPattern[] {
  const results: CardPattern[] = []
  const valueMap = new Map<number, Card[]>()

  for (const card of cards) {
    const existing = valueMap.get(card.value) || []
    existing.push(card)
    valueMap.set(card.value, existing)
  }

  // 找所有三张
  const triples: { value: number; cards: Card[] }[] = []
  for (const [value, group] of valueMap.entries()) {
    if (value > minValue && group.length >= 3) {
      triples.push({ value, cards: group.slice(0, 3) })
    }
  }

  // 为每个三张找单张
  for (const triple of triples) {
    for (const card of cards) {
      if (card.value !== triple.value) {
        results.push({
          type: 'triple_one',
          cards: [...triple.cards, card],
          mainValue: triple.value,
        })
        break // 只取第一个可用的单张
      }
    }
  }

  return results.sort((a, b) => a.mainValue - b.mainValue)
}

/**
 * 找出所有比指定值大的三带二
 */
function findBiggerTripleTwos(cards: Card[], minValue: number): CardPattern[] {
  const results: CardPattern[] = []
  const valueMap = new Map<number, Card[]>()

  for (const card of cards) {
    const existing = valueMap.get(card.value) || []
    existing.push(card)
    valueMap.set(card.value, existing)
  }

  // 找所有三张
  const triples: { value: number; cards: Card[] }[] = []
  for (const [value, group] of valueMap.entries()) {
    if (value > minValue && group.length >= 3) {
      triples.push({ value, cards: group.slice(0, 3) })
    }
  }

  // 找所有对子
  const pairs: Card[][] = []
  for (const [value, group] of valueMap.entries()) {
    if (group.length >= 2 && group[0].suit !== 'joker') {
      pairs.push(group.slice(0, 2))
    }
  }

  // 组合三带二
  for (const triple of triples) {
    for (const pair of pairs) {
      if (pair[0].value !== triple.value) {
        results.push({
          type: 'triple_two',
          cards: [...triple.cards, ...pair],
          mainValue: triple.value,
        })
        break // 只取第一个可用的对子
      }
    }
  }

  return results.sort((a, b) => a.mainValue - b.mainValue)
}

/**
 * 找出所有比指定值大的顺子
 */
function findBiggerStraights(cards: Card[], minValue: number, length: number): CardPattern[] {
  const results: CardPattern[] = []
  const valueMap = new Map<number, Card[]>()

  // 顺子不能包含2和王
  for (const card of cards) {
    if (card.value < 15) {
      // value 15 是 2
      const existing = valueMap.get(card.value) || []
      existing.push(card)
      valueMap.set(card.value, existing)
    }
  }

  // 找所有可能的起始点
  // minValue 是上家顺子的最大值，我们需要的最小值的起始是 minValue - length + 2
  const minStartValue = minValue - length + 2

  for (let start = minStartValue; start <= 14 - length + 1; start++) {
    const straightCards: Card[] = []
    let valid = true

    for (let v = start; v < start + length; v++) {
      const group = valueMap.get(v)
      if (!group || group.length === 0) {
        valid = false
        break
      }
      straightCards.push(group[0])
    }

    if (valid) {
      const maxValue = start + length - 1
      if (maxValue > minValue) {
        results.push({
          type: 'straight',
          cards: straightCards,
          mainValue: maxValue,
          length,
        })
      }
    }
  }

  return results.sort((a, b) => a.mainValue - b.mainValue)
}

/**
 * 找出所有比指定值大的连对
 */
function findBiggerStraightPairs(cards: Card[], minValue: number, length: number): CardPattern[] {
  const results: CardPattern[] = []
  const valueMap = new Map<number, Card[]>()

  for (const card of cards) {
    if (card.value < 15 && card.suit !== 'joker') {
      const existing = valueMap.get(card.value) || []
      existing.push(card)
      valueMap.set(card.value, existing)
    }
  }

  const minStartValue = minValue - length + 2

  for (let start = minStartValue; start <= 14 - length + 1; start++) {
    const pairCards: Card[] = []
    let valid = true

    for (let v = start; v < start + length; v++) {
      const group = valueMap.get(v)
      if (!group || group.length < 2) {
        valid = false
        break
      }
      pairCards.push(group[0], group[1])
    }

    if (valid) {
      const maxValue = start + length - 1
      if (maxValue > minValue) {
        results.push({
          type: 'straight_pair',
          cards: pairCards,
          mainValue: maxValue,
          length,
        })
      }
    }
  }

  return results.sort((a, b) => a.mainValue - b.mainValue)
}

/**
 * 找出所有比指定值大的飞机
 */
function findBiggerPlanes(cards: Card[], minValue: number, length: number): CardPattern[] {
  const results: CardPattern[] = []
  const valueMap = new Map<number, Card[]>()

  for (const card of cards) {
    if (card.value < 15) {
      const existing = valueMap.get(card.value) || []
      existing.push(card)
      valueMap.set(card.value, existing)
    }
  }

  const minStartValue = minValue - length + 2

  for (let start = minStartValue; start <= 14 - length + 1; start++) {
    const planeCards: Card[] = []
    let valid = true

    for (let v = start; v < start + length; v++) {
      const group = valueMap.get(v)
      if (!group || group.length < 3) {
        valid = false
        break
      }
      planeCards.push(group[0], group[1], group[2])
    }

    if (valid) {
      const maxValue = start + length - 1
      if (maxValue > minValue) {
        results.push({
          type: 'plane',
          cards: planeCards,
          mainValue: maxValue,
          length,
        })
      }
    }
  }

  return results.sort((a, b) => a.mainValue - b.mainValue)
}

/**
 * 找出所有比指定值大的四带二
 */
function findBiggerFourTwos(cards: Card[], minValue: number): CardPattern[] {
  const results: CardPattern[] = []
  const valueMap = new Map<number, Card[]>()

  for (const card of cards) {
    const existing = valueMap.get(card.value) || []
    existing.push(card)
    valueMap.set(card.value, existing)
  }

  // 找四张
  for (const [value, group] of valueMap.entries()) {
    if (value > minValue && group.length === 4) {
      // 找两张单牌
      const kickers: Card[] = []
      for (const card of cards) {
        if (card.value !== value && kickers.length < 2) {
          kickers.push(card)
        }
      }

      if (kickers.length === 2) {
        results.push({
          type: 'four_two',
          cards: [...group, ...kickers],
          mainValue: value,
        })
      }
    }
  }

  return results.sort((a, b) => a.mainValue - b.mainValue)
}

/**
 * 找出所有比指定值大的炸弹
 */
function findBiggerBombs(cards: Card[], minValue: number): CardPattern[] {
  const results: CardPattern[] = []
  const valueMap = new Map<number, Card[]>()

  for (const card of cards) {
    const existing = valueMap.get(card.value) || []
    existing.push(card)
    valueMap.set(card.value, existing)
  }

  for (const [value, group] of valueMap.entries()) {
    if (value > minValue && group.length === 4) {
      results.push({
        type: 'bomb',
        cards: group,
        mainValue: value,
      })
    }
  }

  return results.sort((a, b) => a.mainValue - b.mainValue)
}

/**
 * 找出所有炸弹
 */
function findAllBombs(cards: Card[]): CardPattern[] {
  const results: CardPattern[] = []
  const valueMap = new Map<number, Card[]>()

  for (const card of cards) {
    const existing = valueMap.get(card.value) || []
    existing.push(card)
    valueMap.set(card.value, existing)
  }

  for (const [value, group] of valueMap.entries()) {
    if (group.length === 4) {
      results.push({
        type: 'bomb',
        cards: group,
        mainValue: value,
      })
    }
  }

  return results.sort((a, b) => a.mainValue - b.mainValue)
}

/**
 * 找出王炸
 */
function findRocket(cards: Card[]): CardPattern | null {
  const jokers = cards.filter((c) => c.suit === 'joker')
  if (jokers.length === 2) {
    return {
      type: 'rocket',
      cards: jokers,
      mainValue: 17,
    }
  }
  return null
}

/**
 * 找出所有可能的牌型（用于自由出牌）
 */
function findAllPatterns(cards: Card[]): CardPattern[] {
  const results: CardPattern[] = []
  const seen = new Set<string>()

  // 单张
  for (const card of cards) {
    const key = `single:${card.value}`
    if (!seen.has(key)) {
      seen.add(key)
      results.push({
        type: 'single',
        cards: [card],
        mainValue: card.value,
      })
    }
  }

  // 对子
  const valueMap = new Map<number, Card[]>()
  for (const card of cards) {
    const existing = valueMap.get(card.value) || []
    existing.push(card)
    valueMap.set(card.value, existing)
  }

  for (const [value, group] of valueMap.entries()) {
    if (group.length >= 2 && group[0].suit !== 'joker') {
      results.push({
        type: 'pair',
        cards: group.slice(0, 2),
        mainValue: value,
      })
    }
    if (group.length >= 3) {
      results.push({
        type: 'triple',
        cards: group.slice(0, 3),
        mainValue: value,
      })
    }
  }

  // 炸弹和王炸
  results.push(...findAllBombs(cards))
  const rocket = findRocket(cards)
  if (rocket) results.push(rocket)

  // 按牌力排序：单张 < 对子 < 三张 < 炸弹 < 王炸
  return results.sort((a, b) => {
    const typeOrder: Record<string, number> = {
      single: 1,
      pair: 2,
      triple: 3,
      bomb: 10,
      rocket: 11,
    }
    const orderA = typeOrder[a.type] || 5
    const orderB = typeOrder[b.type] || 5
    if (orderA !== orderB) return orderA - orderB
    return a.mainValue - b.mainValue
  })
}

/**
 * 获取出牌提示（返回最小的能压过上家的牌）
 * @param handCards 手牌
 * @param lastPlay 上一手牌型
 * @returns Card[] | null 提示的牌组，或 null 表示无法出牌
 */
export function getHint(handCards: Card[], lastPlay: CardPattern | null): Card[] | null {
  const patterns = findBeatingPatterns(handCards, lastPlay)
  if (patterns.length === 0) return null

  // 优先出非炸弹
  const nonBombs = patterns.filter((p) => !isBombType(p))
  if (nonBombs.length > 0) {
    return nonBombs[0].cards
  }

  // 只有炸弹可出
  return patterns[0].cards
}
