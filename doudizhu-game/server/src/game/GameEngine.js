/**
 * 斗地主游戏引擎
 * 管理游戏状态、发牌、叫地主、出牌等核心逻辑
 */

const { v4: uuidv4 } = require('uuid')
const CardValidator = require('./CardValidator')

// 游戏阶段
const GamePhase = {
  DEALING: 'dealing', // 发牌中
  BIDDING: 'bidding', // 叫地主
  PLAYING: 'playing', // 出牌
  FINISHED: 'finished', // 结束
}

// 牌点数对应的比较值
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

// 花色列表
const SUITS = ['spade', 'heart', 'club', 'diamond']
const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2']

class GameEngine {
  constructor(roomId, players, baseScore = 100) {
    this.roomId = roomId
    this.gameId = uuidv4()
    this.baseScore = baseScore
    this.phase = GamePhase.DEALING

    // 初始化玩家
    this.players = players.map((p, index) => ({
      id: p.id,
      nickname: p.nickname,
      avatar: p.avatar,
      coins: p.coins,
      seat: index,
      role: null, // landlord 或 farmer
      cards: [],
      cardCount: 0,
      isOnline: true,
    }))

    // 游戏状态
    this.currentSeat = 0 // 当前操作玩家座位
    this.landlordSeat = -1 // 地主座位
    this.bottomCards = [] // 底牌
    this.bidScore = 0 // 叫地主分数
    this.bidHistory = [] // 叫分历史
    this.lastBidSeat = -1 // 最后叫分的座位

    // 出牌状态
    this.lastPlay = null // 上一手牌型
    this.lastPlaySeat = -1 // 上一手出牌的座位
    this.passCount = 0 // 连续不出次数

    // 倍数计算
    this.multiplier = 1 // 初始倍数
    this.bombCount = 0 // 炸弹数量
    this.isSpring = false // 春天（地主一轮出完或农民一张没出）

    // 计时器
    this.turnTimeout = null
    this.turnStartTime = null
  }

  /**
   * 创建一副扑克牌
   */
  createDeck() {
    const cards = []
    let id = 0

    // 52张常规牌
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

    // 大小王
    cards.push({ id: id++, suit: 'joker', rank: 'small', value: RANK_VALUES.small })
    cards.push({ id: id++, suit: 'joker', rank: 'big', value: RANK_VALUES.big })

    return cards
  }

  /**
   * Fisher-Yates 洗牌
   */
  shuffleDeck(cards) {
    const shuffled = [...cards]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  /**
   * 发牌
   */
  dealCards() {
    const deck = this.shuffleDeck(this.createDeck())

    // 每人17张
    for (let i = 0; i < 51; i++) {
      this.players[i % 3].cards.push(deck[i])
    }

    // 底牌3张
    this.bottomCards = deck.slice(51, 54)

    // 排序每个玩家的手牌
    this.players.forEach((player) => {
      this.sortCards(player.cards)
      player.cardCount = player.cards.length
    })

    // 随机选择第一个叫地主的人
    this.currentSeat = Math.floor(Math.random() * 3)
    this.phase = GamePhase.BIDDING
  }

  /**
   * 手牌排序（从大到小）
   */
  sortCards(cards) {
    return cards.sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value
      const suitOrder = { spade: 4, heart: 3, club: 2, diamond: 1, joker: 5 }
      return suitOrder[b.suit] - suitOrder[a.suit]
    })
  }

  /**
   * 叫地主
   * @param {number} playerId 玩家ID
   * @param {number} score 叫分 (0=不叫, 1-3=叫分)
   * @returns {object} 结果
   */
  bid(playerId, score) {
    if (this.phase !== GamePhase.BIDDING) {
      return { success: false, error: '当前不是叫地主阶段' }
    }

    const player = this.players.find((p) => p.id === playerId)
    if (!player) {
      return { success: false, error: '玩家不在游戏中' }
    }

    if (player.seat !== this.currentSeat) {
      return { success: false, error: '还没轮到你叫地主' }
    }

    // 验证叫分
    if (score < 0 || score > 3) {
      return { success: false, error: '无效的叫分' }
    }

    // 叫分必须比之前高
    if (score > 0 && score <= this.bidScore) {
      return { success: false, error: '叫分必须比之前高' }
    }

    // 记录叫分
    this.bidHistory.push({ seat: this.currentSeat, score })

    if (score > 0) {
      this.bidScore = score
      this.lastBidSeat = this.currentSeat
    }

    // 判断叫地主结果
    const result = this.checkBidResult()
    if (result.decided) {
      return { success: true, decided: true, ...result }
    }

    // 下一个玩家
    this.currentSeat = (this.currentSeat + 1) % 3

    return { success: true, decided: false, nextSeat: this.currentSeat }
  }

  /**
   * 检查叫地主结果
   */
  checkBidResult() {
    // 叫了3分直接成为地主
    if (this.bidScore === 3) {
      return this.decideLandlord(this.lastBidSeat)
    }

    // 三个人都叫过了
    if (this.bidHistory.length >= 3) {
      // 没人叫分，重新发牌
      if (this.bidScore === 0) {
        return { decided: true, redeal: true }
      }

      // 最后叫分的人当地主
      return this.decideLandlord(this.lastBidSeat)
    }

    return { decided: false }
  }

  /**
   * 确定地主
   */
  decideLandlord(seat) {
    this.landlordSeat = seat
    this.phase = GamePhase.PLAYING
    this.currentSeat = seat

    // 设置角色
    this.players.forEach((p) => {
      p.role = p.seat === seat ? 'landlord' : 'farmer'
    })

    // 地主获得底牌
    const landlord = this.players.find((p) => p.seat === seat)
    landlord.cards = [...landlord.cards, ...this.bottomCards]
    this.sortCards(landlord.cards)
    landlord.cardCount = landlord.cards.length

    // 初始倍数 = 叫分
    this.multiplier = this.bidScore

    return {
      decided: true,
      redeal: false,
      landlordSeat: seat,
      bottomCards: this.bottomCards,
      bidScore: this.bidScore,
    }
  }

  /**
   * 出牌
   * @param {number} playerId 玩家ID
   * @param {array} cardIds 出的牌的ID数组
   * @returns {object} 结果
   */
  playCards(playerId, cardIds) {
    if (this.phase !== GamePhase.PLAYING) {
      return { success: false, error: '当前不是出牌阶段' }
    }

    const player = this.players.find((p) => p.id === playerId)
    if (!player) {
      return { success: false, error: '玩家不在游戏中' }
    }

    if (player.seat !== this.currentSeat) {
      return { success: false, error: '还没轮到你出牌' }
    }

    // 获取要出的牌
    const playedCards = []
    for (const cardId of cardIds) {
      const card = player.cards.find((c) => c.id === cardId)
      if (!card) {
        return { success: false, error: '你没有这张牌' }
      }
      playedCards.push(card)
    }

    // 验证牌型
    const pattern = CardValidator.getCardPattern(playedCards)
    if (!pattern) {
      return { success: false, error: '无效的牌型' }
    }

    // 如果有上一手牌，检查是否能压过
    if (this.lastPlay && this.lastPlaySeat !== this.currentSeat) {
      if (!CardValidator.canBeat(pattern, this.lastPlay)) {
        return { success: false, error: '出的牌压不过上家' }
      }
    }

    // 记录炸弹倍数
    if (pattern.type === 'bomb') {
      this.bombCount++
      this.multiplier *= 2
    } else if (pattern.type === 'rocket') {
      this.bombCount++
      this.multiplier *= 2
    }

    // 从手牌中移除
    player.cards = player.cards.filter((c) => !cardIds.includes(c.id))
    player.cardCount = player.cards.length

    // 更新出牌状态
    this.lastPlay = pattern
    this.lastPlaySeat = this.currentSeat
    this.passCount = 0

    // 检查游戏是否结束
    if (player.cardCount === 0) {
      return this.endGame(player)
    }

    // 下一个玩家
    this.currentSeat = (this.currentSeat + 1) % 3

    return {
      success: true,
      pattern,
      cards: playedCards,
      nextSeat: this.currentSeat,
      remainingCards: player.cardCount,
    }
  }

  /**
   * 不出
   * @param {number} playerId 玩家ID
   * @returns {object} 结果
   */
  pass(playerId) {
    if (this.phase !== GamePhase.PLAYING) {
      return { success: false, error: '当前不是出牌阶段' }
    }

    const player = this.players.find((p) => p.id === playerId)
    if (!player) {
      return { success: false, error: '玩家不在游戏中' }
    }

    if (player.seat !== this.currentSeat) {
      return { success: false, error: '还没轮到你出牌' }
    }

    // 如果是新一轮或自己是最后出牌的人，必须出牌
    if (!this.lastPlay || this.lastPlaySeat === this.currentSeat) {
      return { success: false, error: '你必须出牌' }
    }

    this.passCount++

    // 如果两个人都不出，清空上一手牌，轮到最后出牌的人
    if (this.passCount >= 2) {
      this.lastPlay = null
      this.currentSeat = this.lastPlaySeat
    } else {
      this.currentSeat = (this.currentSeat + 1) % 3
    }

    return {
      success: true,
      isPass: true,
      nextSeat: this.currentSeat,
      newRound: this.passCount >= 2,
    }
  }

  /**
   * 结束游戏
   */
  endGame(winner) {
    this.phase = GamePhase.FINISHED

    // 检查春天
    const landlord = this.players.find((p) => p.role === 'landlord')
    const farmers = this.players.filter((p) => p.role === 'farmer')

    if (winner.role === 'landlord') {
      // 地主赢，检查是否春天（农民一张没出）
      if (farmers.every((f) => f.cardCount === 17)) {
        this.isSpring = true
        this.multiplier *= 2
      }
    } else {
      // 农民赢，检查是否反春天（地主只出了3张底牌）
      if (landlord.cardCount === 17) {
        this.isSpring = true
        this.multiplier *= 2
      }
    }

    // 计算积分变化
    const baseChange = this.baseScore * this.multiplier
    const results = []

    for (const player of this.players) {
      let coinChange = 0

      if (player.role === 'landlord') {
        // 地主赢得或输掉双倍
        coinChange = winner.role === 'landlord' ? baseChange * 2 : -baseChange * 2
      } else {
        // 农民
        coinChange = winner.role === 'farmer' ? baseChange : -baseChange
      }

      results.push({
        playerId: player.id,
        role: player.role,
        isWin: player.role === winner.role,
        coinChange,
      })
    }

    return {
      success: true,
      gameOver: true,
      winnerId: winner.id,
      winnerRole: winner.role,
      results,
      multiplier: this.multiplier,
      isSpring: this.isSpring,
      bombCount: this.bombCount,
    }
  }

  /**
   * 获取玩家的手牌（用于发送给客户端）
   */
  getPlayerCards(playerId) {
    const player = this.players.find((p) => p.id === playerId)
    return player ? player.cards : []
  }

  /**
   * 获取游戏状态（用于发送给客户端）
   */
  getGameState(forPlayerId = null) {
    // 基础状态
    const state = {
      roomId: this.roomId,
      gameId: this.gameId,
      phase: this.phase,
      currentSeat: this.currentSeat,
      landlordSeat: this.landlordSeat,
      bottomCards: this.phase === GamePhase.PLAYING ? this.bottomCards : [],
      bidScore: this.bidScore,
      multiplier: this.multiplier,
      lastPlay: this.lastPlay,
      lastPlaySeat: this.lastPlaySeat,
      passCount: this.passCount,
      players: this.players.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        avatar: p.avatar,
        coins: p.coins,
        seat: p.seat,
        role: p.role,
        cardCount: p.cardCount,
        isOnline: p.isOnline,
        // 只给自己的手牌
        cards: forPlayerId === p.id ? p.cards : undefined,
      })),
    }

    return state
  }

  /**
   * 获取出牌提示
   */
  getHint(playerId) {
    const player = this.players.find((p) => p.id === playerId)
    if (!player || player.seat !== this.currentSeat) {
      return null
    }

    return CardValidator.getHint(player.cards, this.lastPlay)
  }

  /**
   * 玩家断线
   */
  playerDisconnect(playerId) {
    const player = this.players.find((p) => p.id === playerId)
    if (player) {
      player.isOnline = false
      player.disconnectTime = Date.now()
    }
  }

  /**
   * 玩家重连
   */
  playerReconnect(playerId) {
    const player = this.players.find((p) => p.id === playerId)
    if (player) {
      player.isOnline = true
      player.disconnectTime = null
    }
  }

  /**
   * 超时自动处理
   */
  handleTimeout() {
    if (this.phase === GamePhase.BIDDING) {
      // 叫地主超时，自动不叫
      return this.bid(this.players[this.currentSeat].id, 0)
    } else if (this.phase === GamePhase.PLAYING) {
      // 出牌超时
      if (!this.lastPlay || this.lastPlaySeat === this.currentSeat) {
        // 必须出牌，自动出最小的单张
        const player = this.players[this.currentSeat]
        const smallestCard = player.cards[player.cards.length - 1]
        return this.playCards(player.id, [smallestCard.id])
      } else {
        // 可以不出，自动不出
        return this.pass(this.players[this.currentSeat].id)
      }
    }
    return { success: false }
  }
}

module.exports = GameEngine
module.exports.GamePhase = GamePhase
