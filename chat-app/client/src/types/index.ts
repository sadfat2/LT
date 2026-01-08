// 用户类型
export interface User {
  id: number
  account: string
  nickname: string
  avatar: string | null
  signature: string | null
  pinyin?: string
  created_at?: string
}

// 好友类型
export interface Friend extends User {
  pinyin: string
}

// 好友申请类型
export interface FriendRequest {
  id: number
  from_user_id: number
  to_user_id?: number
  account: string
  nickname: string
  avatar: string | null
  message: string | null
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
}

// 会话类型
export interface Conversation {
  id: number
  type: 'private' | 'group'
  other_user: User | null
  last_message: Message | null
  unread_count: number
  updated_at: string
}

// 消息类型
export interface Message {
  id: number
  conversation_id: number
  sender_id: number
  sender_nickname?: string
  sender_avatar?: string
  type: 'text' | 'image' | 'voice'
  content: string
  media_url?: string
  duration?: number
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'revoked'
  created_at: string
}

// API 响应类型
export interface ApiResponse<T = any> {
  code: number
  message?: string
  data: T
}

// 登录响应
export interface LoginResponse {
  token: string
  user: User
}

// 好友列表响应
export interface FriendListResponse {
  list: Friend[]
  grouped: Record<string, Friend[]>
}

// 好友申请列表响应
export interface FriendRequestsResponse {
  received: FriendRequest[]
  sent: FriendRequest[]
}
