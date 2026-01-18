// 用户类型
export interface User {
  id: number
  account: string
  nickname: string
  avatar: string | null
  coins: number
  level: number
  experience: number
  totalGames: number
  wins: number
  createdAt: string
}

// 认证响应
export interface AuthResponse {
  token: string
  user: User
}

// 扑克牌花色
export type Suit = 'spade' | 'heart' | 'club' | 'diamond' | 'joker'

// 扑克牌点数
export type Rank = '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | '2' | 'small' | 'big'

// 扑克牌
export interface Card {
  id: number
  suit: Suit
  rank: Rank
  value: number // 用于比较大小的数值
}

// 牌型类型
export type CardType =
  | 'single'        // 单张
  | 'pair'          // 对子
  | 'triple'        // 三张
  | 'triple_one'    // 三带一
  | 'triple_two'    // 三带二
  | 'straight'      // 顺子
  | 'straight_pair' // 连对
  | 'plane'         // 飞机
  | 'plane_wings'   // 飞机带翅膀
  | 'four_two'      // 四带二
  | 'bomb'          // 炸弹
  | 'rocket'        // 王炸

// 牌型信息
export interface CardPattern {
  type: CardType
  cards: Card[]
  mainValue: number  // 主牌点数，用于比较
  length?: number    // 顺子/连对长度
}

// 玩家角色
export type PlayerRole = 'landlord' | 'farmer'

// 玩家状态
export interface Player {
  id: number
  nickname: string
  avatar: string | null
  coins: number
  seat: number
  isReady: boolean
  role?: PlayerRole
  cards?: Card[]
  cardCount: number
  isOnline: boolean
}

// 房间状态
export type RoomStatus = 'waiting' | 'playing' | 'finished'

// 房间信息
export interface Room {
  id: string
  name: string
  baseScore: number
  players: Player[]
  maxPlayers: number
  status: RoomStatus
  ownerId: number
  createdAt: string
}

// 房间列表项
export interface RoomListItem {
  id: string
  name: string
  baseScore: number
  playerCount: number
  maxPlayers: number
  ownerId: number
}

// 游戏阶段
export type GamePhase = 'dealing' | 'bidding' | 'playing' | 'finished'

// 游戏状态
export interface GameState {
  roomId: string
  phase: GamePhase
  players: Player[]
  currentSeat: number
  landlordSeat: number
  bottomCards: Card[]
  lastPlay: CardPattern | null
  lastPlaySeat: number
  bidScore: number
  multiplier: number
  passCount: number
  winnerId?: number
}

// 叫分信息
export interface BidInfo {
  seat: number
  score: number // 0=不叫, 1-3=分数
}

// 出牌信息
export interface PlayInfo {
  seat: number
  cards: Card[]
  pattern: CardPattern | null
  isPass: boolean
}

// 游戏记录
export interface GameRecord {
  id: number
  roomId: string
  role: PlayerRole
  isWin: boolean
  coinChange: number
  multiplier: number
  createdAt: string
}

// 交易记录
export interface Transaction {
  id: number
  type: 'checkin' | 'game' | 'bankrupt_aid'
  amount: number
  description: string
  createdAt: string
}

// 签到状态
export interface CheckinStatus {
  hasCheckedIn: boolean
  consecutiveDays: number
  todayReward: number
}

// Socket 事件数据类型
export interface SocketEvents {
  // 房间事件
  'room:created': { room: Room }
  'room:joined': { room: Room; player: Player }
  'room:left': { roomId: string; playerId: number }
  'room:ready': { roomId: string; playerId: number; isReady: boolean }
  'room:kicked': { roomId: string; playerId: number }
  'room:updated': { room: Room }

  // 匹配事件
  'match:started': { playerId: number }
  'match:found': { room: Room }
  'match:cancelled': { playerId: number }
  'match:timeout': { playerId: number }

  // 游戏事件
  'game:started': { gameState: GameState }
  'game:dealt': { cards: Card[]; seat: number }
  'game:bid_turn': { seat: number; timeout: number }
  'game:bid': { bidInfo: BidInfo }
  'game:landlord_decided': { seat: number; bottomCards: Card[]; bidScore: number }
  'game:play_turn': { seat: number; timeout: number }
  'game:played': { playInfo: PlayInfo }
  'game:ended': { winnerId: number; results: GameResult[] }

  // 聊天事件
  'chat:emoji': { roomId: string; playerId: number; emojiId: string }
  'chat:quick': { roomId: string; playerId: number; messageId: string }
}

// 游戏结果
export interface GameResult {
  playerId: number
  role: PlayerRole
  isWin: boolean
  coinChange: number
}

// API 响应基础类型
export interface ApiResponse<T = unknown> {
  code: number
  message?: string
  data?: T
}
