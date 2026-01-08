import { get, post, put, del, uploadFile } from '../utils/request'
import type {
  User,
  LoginResponse,
  FriendListResponse,
  FriendRequestsResponse,
  Conversation,
  Message
} from '../types'

// 认证相关
export const authApi = {
  // 登录
  login: (account: string, password: string) =>
    post<LoginResponse>('/api/auth/login', { account, password }),

  // 注册
  register: (account: string, password: string) =>
    post<LoginResponse>('/api/auth/register', { account, password })
}

// 用户相关
export const userApi = {
  // 获取当前用户信息
  getProfile: () => get<User>('/api/user/profile'),

  // 更新用户信息
  updateProfile: (data: { nickname?: string; signature?: string }) =>
    put<User>('/api/user/profile', data),

  // 搜索用户
  search: (keyword: string) => get<User[]>('/api/user/search', { keyword }),

  // 上传头像
  uploadAvatar: (filePath: string) => uploadFile('/api/upload/avatar', filePath)
}

// 好友相关
export const friendApi = {
  // 获取好友列表
  getList: () => get<FriendListResponse>('/api/friends'),

  // 发送好友申请
  sendRequest: (toUserId: number, message?: string) =>
    post<{ requestId: number }>('/api/friends/request', { toUserId, message }),

  // 获取好友申请列表
  getRequests: () => get<FriendRequestsResponse>('/api/friends/requests'),

  // 获取待处理申请数量
  getPendingCount: () => get<{ count: number }>('/api/friends/requests/pending-count'),

  // 同意好友申请
  accept: (id: number) => post('/api/friends/accept/' + id),

  // 拒绝好友申请
  reject: (id: number) => post('/api/friends/reject/' + id)
}

// 会话相关
export const conversationApi = {
  // 获取会话列表
  getList: () => get<Conversation[]>('/api/conversations'),

  // 创建私聊会话
  createPrivate: (userId: number) =>
    post<{ conversationId: number; isNew: boolean }>('/api/conversations/private', { userId }),

  // 删除会话
  delete: (id: number) => del('/api/conversations/' + id),

  // 获取会话消息
  getMessages: (id: number, page = 1, limit = 20) =>
    get<{ messages: Message[]; page: number; limit: number; hasMore: boolean }>(
      `/api/conversations/${id}/messages`,
      { page, limit }
    )
}

// 上传相关
export const uploadApi = {
  // 上传图片
  image: (filePath: string) => uploadFile('/api/upload/image', filePath),

  // 上传语音
  voice: (filePath: string, duration: number) =>
    uploadFile('/api/upload/voice', filePath, 'file', { duration })
}
