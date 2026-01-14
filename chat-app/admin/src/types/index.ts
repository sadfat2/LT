// API 响应类型
export interface ApiResponse<T = any> {
  code: number
  message?: string
  data: T
}

// 分页响应
export interface PaginatedResponse<T> {
  list: T[]
  total: number
  page: number
  limit: number
}

// 管理员
export interface Admin {
  id: number
  username: string
  nickname: string | null
  avatar: string | null
  last_login_at: string | null
  last_login_ip: string | null
  created_at: string
}

// 用户
export interface User {
  id: number
  account: string
  nickname: string
  avatar: string | null
  signature: string | null
  status: 'active' | 'banned'
  banned_at: string | null
  banned_reason: string | null
  created_at: string
  is_online?: boolean
  referral_link_id?: number | null
  referral_code?: string | null
  referral_active?: boolean | null
}

// 用户详情
export interface UserDetail extends User {
  friend_count: number
  group_count: number
  message_count: number
  referral_link: ReferralLink | null
}

// 推荐链接
export interface ReferralLink {
  id: number
  user_id: number
  code: string
  is_active: boolean
  click_count: number
  register_count: number
  created_at: string
  updated_at?: string
  user_nickname?: string
  user_avatar?: string | null
  user_account?: string
}

// 推荐注册记录
export interface ReferralRegistration {
  id: number
  referral_link_id: number
  referrer_id: number
  referee_id: number
  user_id: number
  account: string
  nickname: string
  avatar: string | null
  user_created_at: string
  created_at: string
}

// 会话
export interface Conversation {
  id: number
  type: 'private' | 'group'
  created_at: string
  target: {
    id: number
    nickname?: string
    name?: string
    avatar: string | null
  } | null
  message_count: number
  last_message_at: string | null
}

// 消息
export interface Message {
  id: number
  conversation_id: number
  sender_id: number
  type: 'text' | 'image' | 'voice' | 'file' | 'video' | 'system'
  content: string
  media_url: string | null
  thumbnail_url: string | null
  duration: number | null
  file_name: string | null
  file_size: number | null
  status: string
  created_at: string
  sender_nickname: string
  sender_avatar: string | null
  conversation_type: 'private' | 'group'
}

// 统计概览
export interface StatisticsOverview {
  total_users: number
  today_new_users: number
  today_active_users: number
  online_count: number
  total_messages: number
  total_groups: number
  banned_users: number
  total_referrals: number
  referral_registrations: number
}

// 统计趋势
export interface StatisticsTrends {
  dates: string[]
  new_users: number[]
  active_users: number[]
  messages: number[]
}
