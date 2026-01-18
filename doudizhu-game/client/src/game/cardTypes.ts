/**
 * 斗地主牌型判断
 * 实现所有牌型的识别
 */

import type { Card, CardType, CardPattern } from '@/types'
import { countByValue, isRocket, isBomb, RANK_VALUES } from './cardUtils'

/**
 * 判断牌组的牌型
 * @param cards 要判断的牌组
 * @returns CardPattern | null 如果是有效牌型返回牌型信息，否则返回 null
 */
export function getCardPattern(cards: Card[]): CardPattern | null {
  if (!cards || cards.length === 0) return null

  // 按优先级检查各种牌型
  // 先检查特殊牌型
  if (checkRocket(cards)) return checkRocket(cards)
  if (checkBomb(cards)) return checkBomb(cards)

  // 常规牌型
  if (checkSingle(cards)) return checkSingle(cards)
  if (checkPair(cards)) return checkPair(cards)
  if (checkTriple(cards)) return checkTriple(cards)
  if (checkTripleOne(cards)) return checkTripleOne(cards)
  if (checkTripleTwo(cards)) return checkTripleTwo(cards)
  if (checkStraight(cards)) return checkStraight(cards)
  if (checkStraightPair(cards)) return checkStraightPair(cards)
  if (checkPlane(cards)) return checkPlane(cards)
  if (checkPlaneWings(cards)) return checkPlaneWings(cards)
  if (checkFourTwo(cards)) return checkFourTwo(cards)

  return null
}

/**
 * 检查王炸
 */
function checkRocket(cards: Card[]): CardPattern | null {
  if (!isRocket(cards)) return null
  return {
    type: 'rocket',
    cards: [...cards],
    mainValue: RANK_VALUES.big,
  }
}

/**
 * 检查炸弹
 */
function checkBomb(cards: Card[]): CardPattern | null {
  if (!isBomb(cards)) return null
  return {
    type: 'bomb',
    cards: [...cards],
    mainValue: cards[0].value,
  }
}

/**
 * 检查单张
 */
function checkSingle(cards: Card[]): CardPattern | null {
  if (cards.length !== 1) return null
  return {
    type: 'single',
    cards: [...cards],
    mainValue: cards[0].value,
  }
}

/**
 * 检查对子
 */
function checkPair(cards: Card[]): CardPattern | null {
  if (cards.length !== 2) return null
  if (cards[0].value !== cards[1].value) return null
  // 排除王炸
  if (cards[0].suit === 'joker' || cards[1].suit === 'joker') return null

  return {
    type: 'pair',
    cards: [...cards],
    mainValue: cards[0].value,
  }
}

/**
 * 检查三张
 */
function checkTriple(cards: Card[]): CardPattern | null {
  if (cards.length !== 3) return null
  if (!cards.every((c) => c.value === cards[0].value)) return null

  return {
    type: 'triple',
    cards: [...cards],
    mainValue: cards[0].value,
  }
}

/**
 * 检查三带一
 */
function checkTripleOne(cards: Card[]): CardPattern | null {
  if (cards.length !== 4) return null

  const valueMap = countByValue(cards)
  let tripleValue: number | null = null
  let hasKicker = false

  for (const [value, group] of valueMap.entries()) {
    if (group.length === 3) {
      tripleValue = value
    } else if (group.length === 1) {
      hasKicker = true
    }
  }

  if (tripleValue === null || !hasKicker) return null

  return {
    type: 'triple_one',
    cards: [...cards],
    mainValue: tripleValue,
  }
}

/**
 * 检查三带二
 */
function checkTripleTwo(cards: Card[]): CardPattern | null {
  if (cards.length !== 5) return null

  const valueMap = countByValue(cards)
  let tripleValue: number | null = null
  let hasPair = false

  for (const [value, group] of valueMap.entries()) {
    if (group.length === 3) {
      tripleValue = value
    } else if (group.length === 2) {
      // 排除大小王作为对子
      if (group.some((c) => c.suit === 'joker')) return null
      hasPair = true
    }
  }

  if (tripleValue === null || !hasPair) return null

  return {
    type: 'triple_two',
    cards: [...cards],
    mainValue: tripleValue,
  }
}

/**
 * 检查顺子（5张及以上连续单牌，不含2和王）
 */
function checkStraight(cards: Card[]): CardPattern | null {
  if (cards.length < 5) return null

  // 顺子不能包含2和大小王
  if (cards.some((c) => c.value >= RANK_VALUES['2'])) return null

  const values = cards.map((c) => c.value).sort((a, b) => a - b)

  // 检查是否连续
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== values[i - 1] + 1) return null
  }

  return {
    type: 'straight',
    cards: [...cards],
    mainValue: values[values.length - 1], // 最大牌
    length: cards.length,
  }
}

/**
 * 检查连对（3对及以上连续对子，不含2和王）
 */
function checkStraightPair(cards: Card[]): CardPattern | null {
  if (cards.length < 6 || cards.length % 2 !== 0) return null

  // 不能包含2和大小王
  if (cards.some((c) => c.value >= RANK_VALUES['2'])) return null

  const valueMap = countByValue(cards)

  // 必须全是对子
  for (const group of valueMap.values()) {
    if (group.length !== 2) return null
  }

  const values = Array.from(valueMap.keys()).sort((a, b) => a - b)

  // 检查是否连续
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== values[i - 1] + 1) return null
  }

  return {
    type: 'straight_pair',
    cards: [...cards],
    mainValue: values[values.length - 1],
    length: values.length, // 对子数量
  }
}

/**
 * 检查飞机（2个及以上连续三张，不含2和王）
 */
function checkPlane(cards: Card[]): CardPattern | null {
  if (cards.length < 6 || cards.length % 3 !== 0) return null

  // 不能包含2和大小王
  if (cards.some((c) => c.value >= RANK_VALUES['2'])) return null

  const valueMap = countByValue(cards)

  // 必须全是三张
  for (const group of valueMap.values()) {
    if (group.length !== 3) return null
  }

  const values = Array.from(valueMap.keys()).sort((a, b) => a - b)

  // 检查是否连续
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== values[i - 1] + 1) return null
  }

  return {
    type: 'plane',
    cards: [...cards],
    mainValue: values[values.length - 1],
    length: values.length, // 三张的数量
  }
}

/**
 * 检查飞机带翅膀（连续三张 + 等数量的单牌或对子）
 */
function checkPlaneWings(cards: Card[]): CardPattern | null {
  const valueMap = countByValue(cards)

  // 找出所有三张
  const triples: number[] = []
  const kickers: Card[][] = []

  for (const [value, group] of valueMap.entries()) {
    if (group.length === 3) {
      triples.push(value)
    } else if (group.length === 4) {
      // 四张可以拆成三张+单张，但我们先不支持这种复杂情况
      return null
    } else {
      kickers.push(group)
    }
  }

  // 至少需要2个连续三张
  if (triples.length < 2) return null

  // 三张不能包含2和王
  if (triples.some((v) => v >= RANK_VALUES['2'])) return null

  // 检查三张是否连续
  triples.sort((a, b) => a - b)
  for (let i = 1; i < triples.length; i++) {
    if (triples[i] !== triples[i - 1] + 1) return null
  }

  const planeCount = triples.length

  // 计算踢牌情况
  let singleCount = 0
  let pairCount = 0
  for (const kicker of kickers) {
    if (kicker.length === 1) {
      singleCount++
    } else if (kicker.length === 2) {
      pairCount++
    }
  }

  // 飞机带单牌
  if (singleCount === planeCount && pairCount === 0) {
    return {
      type: 'plane_wings',
      cards: [...cards],
      mainValue: triples[triples.length - 1],
      length: planeCount,
    }
  }

  // 飞机带对子
  if (pairCount === planeCount && singleCount === 0) {
    return {
      type: 'plane_wings',
      cards: [...cards],
      mainValue: triples[triples.length - 1],
      length: planeCount,
    }
  }

  return null
}

/**
 * 检查四带二（四张 + 两张单牌或两对）
 * 注意：有些规则不认四带二，这里实现作为可选牌型
 */
function checkFourTwo(cards: Card[]): CardPattern | null {
  const valueMap = countByValue(cards)

  let quadValue: number | null = null
  const kickers: Card[][] = []

  for (const [value, group] of valueMap.entries()) {
    if (group.length === 4) {
      quadValue = value
    } else {
      kickers.push(group)
    }
  }

  if (quadValue === null) return null

  // 四带两张单牌
  if (cards.length === 6) {
    let singleCount = 0
    for (const kicker of kickers) {
      singleCount += kicker.length
    }
    if (singleCount === 2) {
      return {
        type: 'four_two',
        cards: [...cards],
        mainValue: quadValue,
      }
    }
  }

  // 四带两对
  if (cards.length === 8) {
    let pairCount = 0
    for (const kicker of kickers) {
      if (kicker.length === 2) pairCount++
    }
    if (pairCount === 2) {
      return {
        type: 'four_two',
        cards: [...cards],
        mainValue: quadValue,
      }
    }
  }

  return null
}

/**
 * 获取牌型的中文名称
 */
export function getPatternName(pattern: CardPattern): string {
  const names: Record<CardType, string> = {
    single: '单张',
    pair: '对子',
    triple: '三张',
    triple_one: '三带一',
    triple_two: '三带二',
    straight: '顺子',
    straight_pair: '连对',
    plane: '飞机',
    plane_wings: '飞机带翅膀',
    four_two: '四带二',
    bomb: '炸弹',
    rocket: '王炸',
  }
  return names[pattern.type]
}

/**
 * 判断是否为炸弹类型（包括王炸）
 */
export function isBombType(pattern: CardPattern | null): boolean {
  if (!pattern) return false
  return pattern.type === 'bomb' || pattern.type === 'rocket'
}
