import { get, post, put, del, uploadFile } from '../utils/request'
import type {
  User,
  LoginResponse,
  FriendListResponse,
  FriendRequestsResponse,
  Conversation,
  Message,
  Group,
  SearchAllResult
} from '../types'

// 认证相关
export const authApi = {
  // 登录
  login: (account: string, password: string) =>
    post<LoginResponse>('/api/auth/login', { account, password }),

  // 注册
  register: (account: string, password: string, referralCode?: string) =>
    post<LoginResponse>('/api/auth/register', { account, password, referralCode }),

  // 验证推荐码
  verifyReferral: (code: string) =>
    get<{ valid: boolean; referrer: { id: number; nickname: string; avatar: string | null } }>(`/api/referral/verify/${code}`)
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
  reject: (id: number) => post('/api/friends/reject/' + id),

  // 更新好友备注
  updateRemark: (friendId: number, remark: string) =>
    put<{ remark: string | null }>(`/api/friends/${friendId}/remark`, { remark })
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
    ),

  // 综合搜索（好友+群聊+消息）
  searchAll: (keyword: string) =>
    get<SearchAllResult>('/api/conversations/search/all', { keyword })
}

// 群聊相关
export const groupApi = {
  // 创建群聊
  create: (name: string, memberIds: number[]) =>
    post<{ groupId: number; conversationId: number; group: Group }>('/api/groups', { name, memberIds }),

  // 获取群聊列表
  getList: () => get<Group[]>('/api/groups'),

  // 获取群详情
  getDetail: (id: number) => get<Group>(`/api/groups/${id}`),

  // 邀请成员
  invite: (groupId: number, userIds: number[]) =>
    post<Group>(`/api/groups/${groupId}/invite`, { userIds }),

  // 退出群聊
  leave: (groupId: number) => post(`/api/groups/${groupId}/leave`),

  // 更新群信息
  update: (groupId: number, data: { name?: string; avatar?: string }) =>
    put<Group>(`/api/groups/${groupId}`, data),

  // 移除成员
  removeMember: (groupId: number, userId: number) =>
    del(`/api/groups/${groupId}/members/${userId}`),

  // 解散群聊
  dissolve: (groupId: number) => del(`/api/groups/${groupId}`)
}

// 上传相关
export const uploadApi = {
  // 上传图片
  image: (filePath: string) => uploadFile('/api/upload/image', filePath),

  // 上传语音
  voice: (filePath: string, duration: number) =>
    uploadFile('/api/upload/voice', filePath, 'file', { duration }),

  // 上传文件（传递原始文件名）
  file: (filePath: string, originalName?: string) =>
    uploadFile('/api/upload/file', filePath, 'file', originalName ? { originalName } : undefined),

  // 上传视频
  video: (filePath: string, duration?: number) =>
    uploadFile('/api/upload/video', filePath, 'file', { duration })
}
