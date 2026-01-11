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
  remark?: string | null
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

// 群组类型
export interface Group {
  id: number
  name: string
  avatar: string | null
  owner_id: number
  member_count: number
  conversation_id?: number
  created_at: string
  updated_at: string
  members?: GroupMember[]
}

// 群成员类型
export interface GroupMember {
  id: number
  user_id: number
  role: 'owner' | 'member'
  joined_at: string
  user: User
}

// 群聊信息（会话列表用）
export interface GroupInfo {
  id: number
  name: string
  avatar: string | null
  member_avatars: { id: number; avatar: string | null; nickname: string }[]
}

// 会话类型
export interface Conversation {
  id: number
  type: 'private' | 'group'
  group_id?: number
  group?: Group
  group_info?: GroupInfo  // 群聊信息（会话列表用）
  other_user: User | null  // 私聊对方
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
  type: 'text' | 'image' | 'voice' | 'file' | 'video' | 'system'
  content: string
  media_url?: string
  thumbnail_url?: string  // 缩略图URL（视频封面）
  duration?: number       // 语音/视频时长
  file_name?: string      // 文件名
  file_size?: number      // 文件大小
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

// ==================== 通话相关类型 ====================

// 通话状态
export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected' | 'ended'

// 通话结束原因
export type CallEndReason = 'hangup' | 'rejected' | 'timeout' | 'cancelled' | 'busy' | 'offline' | 'error' | 'disconnected'

// 通话对方信息
export interface CallPeerInfo {
  id: number
  nickname: string
  avatar: string | null
}

// 来电事件数据
export interface IncomingCallData {
  callId: string
  callerId: number
  callerInfo: CallPeerInfo
}

// 通话接听事件数据
export interface CallAcceptedData {
  callId: string
  receiverInfo: CallPeerInfo
}

// 通话结束事件数据
export interface CallEndedData {
  callId: string
  duration: number
  endedBy: number
  reason?: CallEndReason
}

// ==================== 搜索相关类型 ====================

// 搜索好友结果
export interface SearchFriendResult {
  id: number
  account: string
  nickname: string
  avatar: string | null
  remark: string | null
}

// 搜索群聊结果
export interface SearchGroupResult {
  id: number
  name: string
  avatar: string | null
  owner_id: number
  member_count: number
  conversation_id: number
  matched_member_nickname?: string
  matched_member_avatar?: string | null
  match_type: 'group_name' | 'member'
}

// 搜索消息结果
export interface SearchMessageResult {
  id: number
  conversation_id: number
  sender_id: number
  type: string
  content: string
  status: string
  created_at: string
  sender_nickname: string
  sender_avatar: string | null
  conversation_type: 'private' | 'group'
  // 私聊信息
  other_user_id?: number
  other_user_nickname?: string
  other_user_avatar?: string | null
  // 群聊信息
  group_id?: number
  group_name?: string
  group_avatar?: string | null
}

// 综合搜索结果
export interface SearchAllResult {
  friends: SearchFriendResult[]
  groups: SearchGroupResult[]
  messages: SearchMessageResult[]
}
