import axios from 'axios'
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import type { AuthResponse, User, CheckinStatus, Transaction, Room, GameRecord } from '@/types'

// 创建 axios 实例
const http: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

// 请求拦截器
http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('doudizhu_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截器
http.interceptors.response.use(
  (response) => {
    const res = response.data
    if (res.code !== 200) {
      return Promise.reject(new Error(res.message || '请求失败'))
    }
    return res.data
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('doudizhu_token')
      window.location.href = '/login'
    }
    return Promise.reject(error.response?.data?.message || error.message)
  }
)

// 认证相关 API
const auth = {
  // 登录
  login(account: string, password: string): Promise<AuthResponse> {
    return http.post('/auth/login', { account, password })
  },

  // 注册
  register(account: string, password: string, nickname: string): Promise<AuthResponse> {
    return http.post('/auth/register', { account, password, nickname })
  },

  // 从聊天应用登录
  loginFromChat(chatToken: string): Promise<AuthResponse> {
    return http.post('/auth/login-from-chat', { chatToken })
  },
}

// 用户相关 API
const user = {
  // 获取用户信息
  getProfile(): Promise<{ user: User }> {
    return http.get('/user/profile')
  },

  // 更新用户信息
  updateProfile(data: { nickname?: string }): Promise<{ user: User }> {
    return http.put('/user/profile', data)
  },

  // 获取战绩统计
  getStats(): Promise<{
    totalGames: number
    wins: number
    winRate: number
    landlordGames: number
    landlordWins: number
    farmerGames: number
    farmerWins: number
  }> {
    return http.get('/user/stats')
  },

  // 获取游戏记录
  getGameRecords(page: number = 1, limit: number = 20): Promise<{
    records: GameRecord[]
    total: number
  }> {
    return http.get('/user/records', { params: { page, limit } })
  },
}

// 金币相关 API
const coins = {
  // 签到
  checkin(): Promise<{ coins: number; reward: number; consecutiveDays: number }> {
    return http.post('/coins/checkin')
  },

  // 获取签到状态
  getCheckinStatus(): Promise<CheckinStatus> {
    return http.get('/coins/checkin-status')
  },

  // 领取破产补助
  getBankruptAid(): Promise<{ coins: number; aidAmount: number }> {
    return http.post('/coins/bankrupt-aid')
  },

  // 获取交易记录
  getTransactions(page: number = 1, limit: number = 20): Promise<{
    transactions: Transaction[]
    total: number
  }> {
    return http.get('/coins/transactions', { params: { page, limit } })
  },
}

// 房间相关 API
const room = {
  // 获取房间列表
  getRooms(): Promise<{ rooms: Room[] }> {
    return http.get('/rooms')
  },

  // 创建房间
  createRoom(data: { name: string; baseScore: number }): Promise<{ room: Room }> {
    return http.post('/rooms', data)
  },

  // 获取房间详情
  getRoom(id: string): Promise<{ room: Room }> {
    return http.get(`/rooms/${id}`)
  },
}

export default {
  auth,
  user,
  coins,
  room,
}
