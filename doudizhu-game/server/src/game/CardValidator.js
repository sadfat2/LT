/**
 * 斗地主牌型验证器
 * 实现牌型判断和比较（服务端版本）
 */

// 牌点数值
const RANK_VALUES = {
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
  2: 15,
  small: 16,
  big: 17,
}

/**
 * 统计每种点数的牌数量
 */
function countByValue(cards) {
  const map = new Map()
  for (const card of cards) {
    const existing = map.get(card.value) || []
    existing.push(card)
    map.set(card.value, existing)
  }
  return map
}

/**
 * 检查王炸
 */
function isRocket(cards) {
  if (cards.length !== 2) return false
  const values = cards.map((c) => c.value).sort((a, b) => a - b)
  return values[0] === RANK_VALUES.small && values[1] === RANK_VALUES.big
}

/**
 * 检查炸弹
 */
function isBomb(cards) {
  if (cards.length !== 4) return false
  return cards.every((c) => c.value === cards[0].value)
}

/**
 * 判断牌型
 */
function getCardPattern(cards) {
  if (!cards || cards.length === 0) return null

  // 王炸
  if (isRocket(cards)) {
    return { type: 'rocket', cards: [...cards], mainValue: RANK_VALUES.big }
  }

  // 炸弹
  if (isBomb(cards)) {
    return { type: 'bomb', cards: [...cards], mainValue: cards[0].value }
  }

  // 单张
  if (cards.length === 1) {
    return { type: 'single', cards: [...cards], mainValue: cards[0].value }
  }

  // 对子
  if (cards.length === 2) {
    if (cards[0].value === cards[1].value && cards[0].suit !== 'joker') {
      return { type: 'pair', cards: [...cards], mainValue: cards[0].value }
    }
    return null
  }

  // 三张
  if (cards.length === 3) {
    if (cards.every((c) => c.value === cards[0].value)) {
      return { type: 'triple', cards: [...cards], mainValue: cards[0].value }
    }
    return null
  }

  // 三带一
  if (cards.length === 4) {
    const valueMap = countByValue(cards)
    let tripleValue = null
    let hasKicker = false

    for (const [value, group] of valueMap.entries()) {
      if (group.length === 3) tripleValue = value
      else if (group.length === 1) hasKicker = true
    }

    if (tripleValue !== null && hasKicker) {
      return { type: 'triple_one', cards: [...cards], mainValue: tripleValue }
    }
  }

  // 三带二
  if (cards.length === 5) {
    const valueMap = countByValue(cards)
    let tripleValue = null
    let hasPair = false

    for (const [value, group] of valueMap.entries()) {
      if (group.length === 3) tripleValue = value
      else if (group.length === 2 && group[0].suit !== 'joker') hasPair = true
    }

    if (tripleValue !== null && hasPair) {
      return { type: 'triple_two', cards: [...cards], mainValue: tripleValue }
    }
  }

  // 顺子（5张及以上连续单牌）
  if (cards.length >= 5) {
    const pattern = checkStraight(cards)
    if (pattern) return pattern
  }

  // 连对（3对及以上）
  if (cards.length >= 6 && cards.length % 2 === 0) {
    const pattern = checkStraightPair(cards)
    if (pattern) return pattern
  }

  // 飞机
  if (cards.length >= 6 && cards.length % 3 === 0) {
    const pattern = checkPlane(cards)
    if (pattern) return pattern
  }

  // 飞机带翅膀
  if (cards.length >= 8) {
    const pattern = checkPlaneWings(cards)
    if (pattern) return pattern
  }

  // 四带二
  if (cards.length === 6 || cards.length === 8) {
    const pattern = checkFourTwo(cards)
    if (pattern) return pattern
  }

  return null
}

/**
 * 检查顺子
 */
function checkStraight(cards) {
  if (cards.length < 5) return null
  if (cards.some((c) => c.value >= RANK_VALUES['2'])) return null

  const values = cards.map((c) => c.value).sort((a, b) => a - b)

  // 检查每张牌值唯一
  const uniqueValues = [...new Set(values)]
  if (uniqueValues.length !== cards.length) return null

  // 检查连续
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== values[i - 1] + 1) return null
  }

  return {
    type: 'straight',
    cards: [...cards],
    mainValue: values[values.length - 1],
    length: cards.length,
  }
}

/**
 * 检查连对
 */
function checkStraightPair(cards) {
  if (cards.length < 6 || cards.length % 2 !== 0) return null
  if (cards.some((c) => c.value >= RANK_VALUES['2'])) return null

  const valueMap = countByValue(cards)

  // 必须全是对子
  for (const group of valueMap.values()) {
    if (group.length !== 2) return null
  }

  const values = Array.from(valueMap.keys()).sort((a, b) => a - b)

  // 检查连续
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== values[i - 1] + 1) return null
  }

  return {
    type: 'straight_pair',
    cards: [...cards],
    mainValue: values[values.length - 1],
    length: values.length,
  }
}

/**
 * 检查飞机（不带）
 */
function checkPlane(cards) {
  if (cards.length < 6 || cards.length % 3 !== 0) return null
  if (cards.some((c) => c.value >= RANK_VALUES['2'])) return null

  const valueMap = countByValue(cards)

  // 必须全是三张
  for (const group of valueMap.values()) {
    if (group.length !== 3) return null
  }

  const values = Array.from(valueMap.keys()).sort((a, b) => a - b)

  // 检查连续
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== values[i - 1] + 1) return null
  }

  return {
    type: 'plane',
    cards: [...cards],
    mainValue: values[values.length - 1],
    length: values.length,
  }
}

/**
 * 检查飞机带翅膀
 */
function checkPlaneWings(cards) {
  const valueMap = countByValue(cards)

  // 找出所有三张
  const triples = []
  const kickers = []

  for (const [value, group] of valueMap.entries()) {
    if (group.length === 3) {
      triples.push(value)
    } else if (group.length === 4) {
      return null // 暂不支持四张拆成三张
    } else {
      kickers.push(group)
    }
  }

  if (triples.length < 2) return null
  if (triples.some((v) => v >= RANK_VALUES['2'])) return null

  // 检查三张是否连续
  triples.sort((a, b) => a - b)
  for (let i = 1; i < triples.length; i++) {
    if (triples[i] !== triples[i - 1] + 1) return null
  }

  const planeCount = triples.length

  // 计算踢牌
  let singleCount = 0
  let pairCount = 0
  for (const kicker of kickers) {
    if (kicker.length === 1) singleCount++
    else if (kicker.length === 2) pairCount++
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
 * 检查四带二
 */
function checkFourTwo(cards) {
  const valueMap = countByValue(cards)

  let quadValue = null
  const kickers = []

  for (const [value, group] of valueMap.entries()) {
    if (group.length === 4) quadValue = value
    else kickers.push(group)
  }

  if (quadValue === null) return null

  // 四带两张单牌
  if (cards.length === 6) {
    let singleCount = 0
    for (const kicker of kickers) {
      singleCount += kicker.length
    }
    if (singleCount === 2) {
      return { type: 'four_two', cards: [...cards], mainValue: quadValue }
    }
  }

  // 四带两对
  if (cards.length === 8) {
    let pairCount = 0
    for (const kicker of kickers) {
      if (kicker.length === 2) pairCount++
    }
    if (pairCount === 2) {
      return { type: 'four_two', cards: [...cards], mainValue: quadValue }
    }
  }

  return null
}

/**
 * 判断是否炸弹类型
 */
function isBombType(pattern) {
  if (!pattern) return false
  return pattern.type === 'bomb' || pattern.type === 'rocket'
}

/**
 * 比较两个牌型
 * @returns {number} 1: patternA 大, -1: patternA 小, 0: 无法比较
 */
function comparePatterns(patternA, patternB) {
  // 王炸最大
  if (patternA.type === 'rocket') return 1
  if (patternB.type === 'rocket') return -1

  // 炸弹比较
  if (patternA.type === 'bomb' && patternB.type === 'bomb') {
    return patternA.mainValue > patternB.mainValue ? 1 : -1
  }

  // 炸弹压制非炸弹
  if (patternA.type === 'bomb') return 1
  if (patternB.type === 'bomb') return -1

  // 普通牌型必须类型相同
  if (patternA.type !== patternB.type) return 0

  // 顺子等需要长度相同
  if (['straight', 'straight_pair', 'plane', 'plane_wings'].includes(patternA.type)) {
    if (patternA.length !== patternB.length) return 0
  }

  // 比较主牌点数
  if (patternA.mainValue > patternB.mainValue) return 1
  if (patternA.mainValue < patternB.mainValue) return -1
  return 0
}

/**
 * 判断是否能压过上家
 */
function canBeat(patternA, patternB) {
  if (!patternB) return true // 没有上家牌可以随便出
  return comparePatterns(patternA, patternB) === 1
}

/**
 * 获取出牌提示
 */
function getHint(handCards, lastPlay) {
  const patterns = findBeatingPatterns(handCards, lastPlay)
  if (patterns.length === 0) return null

  // 优先出非炸弹
  const nonBombs = patterns.filter((p) => !isBombType(p))
  if (nonBombs.length > 0) {
    return nonBombs[0].cards
  }

  return patterns[0].cards
}

/**
 * 找出所有能压过的牌型
 */
function findBeatingPatterns(handCards, lastPlay) {
  const results = []

  if (!lastPlay) {
    // 自由出牌，返回基础提示
    const seen = new Set()
    for (const card of handCards) {
      if (!seen.has(card.value)) {
        seen.add(card.value)
        results.push({ type: 'single', cards: [card], mainValue: card.value })
      }
    }
    return results.slice(0, 5)
  }

  // 根据上一手类型找牌
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
      results.push(...findBiggerStraights(handCards, lastPlay.mainValue, lastPlay.length))
      break
    case 'straight_pair':
      results.push(...findBiggerStraightPairs(handCards, lastPlay.mainValue, lastPlay.length))
      break
    case 'bomb':
      results.push(...findBiggerBombs(handCards, lastPlay.mainValue))
      break
  }

  // 添加炸弹
  if (lastPlay.type !== 'bomb' && lastPlay.type !== 'rocket') {
    results.push(...findAllBombs(handCards))
  }

  // 添加王炸
  const rocket = findRocket(handCards)
  if (rocket) results.push(rocket)

  return results
}

function findBiggerSingles(cards, minValue) {
  const results = []
  const seen = new Set()

  for (const card of cards) {
    if (card.value > minValue && !seen.has(card.value)) {
      seen.add(card.value)
      results.push({ type: 'single', cards: [card], mainValue: card.value })
    }
  }

  return results.sort((a, b) => a.mainValue - b.mainValue)
}

function findBiggerPairs(cards, minValue) {
  const results = []
  const valueMap = new Map()

  for (const card of cards) {
    if (card.suit === 'joker') continue
    const existing = valueMap.get(card.value) || []
    existing.push(card)
    valueMap.set(card.value, existing)
  }

  for (const [value, group] of valueMap.entries()) {
    if (value > minValue && group.length >= 2) {
      results.push({ type: 'pair', cards: group.slice(0, 2), mainValue: value })
    }
  }

  return results.sort((a, b) => a.mainValue - b.mainValue)
}

function findBiggerTriples(cards, minValue) {
  const results = []
  const valueMap = new Map()

  for (const card of cards) {
    const existing = valueMap.get(card.value) || []
    existing.push(card)
    valueMap.set(card.value, existing)
  }

  for (const [value, group] of valueMap.entries()) {
    if (value > minValue && group.length >= 3) {
      results.push({ type: 'triple', cards: group.slice(0, 3), mainValue: value })
    }
  }

  return results.sort((a, b) => a.mainValue - b.mainValue)
}

function findBiggerTripleOnes(cards, minValue) {
  const results = []
  const valueMap = new Map()

  for (const card of cards) {
    const existing = valueMap.get(card.value) || []
    existing.push(card)
    valueMap.set(card.value, existing)
  }

  const triples = []
  for (const [value, group] of valueMap.entries()) {
    if (value > minValue && group.length >= 3) {
      triples.push({ value, cards: group.slice(0, 3) })
    }
  }

  for (const triple of triples) {
    for (const card of cards) {
      if (card.value !== triple.value) {
        results.push({
          type: 'triple_one',
          cards: [...triple.cards, card],
          mainValue: triple.value,
        })
        break
      }
    }
  }

  return results.sort((a, b) => a.mainValue - b.mainValue)
}

function findBiggerTripleTwos(cards, minValue) {
  const results = []
  const valueMap = new Map()

  for (const card of cards) {
    const existing = valueMap.get(card.value) || []
    existing.push(card)
    valueMap.set(card.value, existing)
  }

  const triples = []
  const pairs = []

  for (const [value, group] of valueMap.entries()) {
    if (value > minValue && group.length >= 3) {
      triples.push({ value, cards: group.slice(0, 3) })
    }
    if (group.length >= 2 && group[0].suit !== 'joker') {
      pairs.push(group.slice(0, 2))
    }
  }

  for (const triple of triples) {
    for (const pair of pairs) {
      if (pair[0].value !== triple.value) {
        results.push({
          type: 'triple_two',
          cards: [...triple.cards, ...pair],
          mainValue: triple.value,
        })
        break
      }
    }
  }

  return results.sort((a, b) => a.mainValue - b.mainValue)
}

function findBiggerStraights(cards, minValue, length) {
  const results = []
  const valueMap = new Map()

  for (const card of cards) {
    if (card.value < 15) {
      const existing = valueMap.get(card.value) || []
      existing.push(card)
      valueMap.set(card.value, existing)
    }
  }

  const minStartValue = minValue - length + 2

  for (let start = minStartValue; start <= 14 - length + 1; start++) {
    const straightCards = []
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

function findBiggerStraightPairs(cards, minValue, length) {
  const results = []
  const valueMap = new Map()

  for (const card of cards) {
    if (card.value < 15 && card.suit !== 'joker') {
      const existing = valueMap.get(card.value) || []
      existing.push(card)
      valueMap.set(card.value, existing)
    }
  }

  const minStartValue = minValue - length + 2

  for (let start = minStartValue; start <= 14 - length + 1; start++) {
    const pairCards = []
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

function findBiggerBombs(cards, minValue) {
  const results = []
  const valueMap = new Map()

  for (const card of cards) {
    const existing = valueMap.get(card.value) || []
    existing.push(card)
    valueMap.set(card.value, existing)
  }

  for (const [value, group] of valueMap.entries()) {
    if (value > minValue && group.length === 4) {
      results.push({ type: 'bomb', cards: group, mainValue: value })
    }
  }

  return results.sort((a, b) => a.mainValue - b.mainValue)
}

function findAllBombs(cards) {
  const results = []
  const valueMap = new Map()

  for (const card of cards) {
    const existing = valueMap.get(card.value) || []
    existing.push(card)
    valueMap.set(card.value, existing)
  }

  for (const [value, group] of valueMap.entries()) {
    if (group.length === 4) {
      results.push({ type: 'bomb', cards: group, mainValue: value })
    }
  }

  return results.sort((a, b) => a.mainValue - b.mainValue)
}

function findRocket(cards) {
  const jokers = cards.filter((c) => c.suit === 'joker')
  if (jokers.length === 2) {
    return { type: 'rocket', cards: jokers, mainValue: 17 }
  }
  return null
}

module.exports = {
  getCardPattern,
  comparePatterns,
  canBeat,
  isBombType,
  getHint,
  findBeatingPatterns,
  countByValue,
  isRocket,
  isBomb,
  RANK_VALUES,
}
