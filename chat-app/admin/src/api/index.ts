import { get, post, put, del } from '@/utils/request'
import type {
  Admin,
  User,
  UserDetail,
  ReferralLink,
  ReferralRegistration,
  Conversation,
  Message,
  StatisticsOverview,
  StatisticsTrends,
  PaginatedResponse
} from '@/types'

// 认证 API
export const authApi = {
  login: (username: string, password: string) =>
    post<{ token: string; admin: Admin }>('/api/admin/auth/login', { username, password }),

  getProfile: () =>
    get<Admin>('/api/admin/auth/profile'),

  updateProfile: (data: { nickname?: string; avatar?: string; password?: string; oldPassword?: string }) =>
    put<Admin>('/api/admin/auth/profile', data)
}

// 用户管理 API
export const usersApi = {
  getList: (params: { page?: number; limit?: number; keyword?: string; status?: string }) =>
    get<PaginatedResponse<User>>('/api/admin/users', params),

  getDetail: (id: number) =>
    get<UserDetail>(`/api/admin/users/${id}`),

  create: (data: { account: string; password: string; nickname?: string }) =>
    post<User>('/api/admin/users', data),

  update: (id: number, data: { nickname?: string; avatar?: string; signature?: string }) =>
    put(`/api/admin/users/${id}`, data),

  ban: (id: number, reason?: string) =>
    post(`/api/admin/users/${id}/ban`, { reason }),

  unban: (id: number) =>
    post(`/api/admin/users/${id}/unban`),

  resetPassword: (id: number, newPassword: string) =>
    put(`/api/admin/users/${id}/password`, { newPassword }),

  getConversations: (id: number) =>
    get<Conversation[]>(`/api/admin/users/${id}/conversations`),

  getMessages: (id: number, params: { conversationId?: number; page?: number; limit?: number }) =>
    get<PaginatedResponse<Message>>(`/api/admin/users/${id}/messages`, params)
}

// 推荐链接 API
export const referralsApi = {
  getList: (params: { page?: number; limit?: number; userId?: number }) =>
    get<PaginatedResponse<ReferralLink>>('/api/admin/referrals', params),

  getDetail: (id: number) =>
    get<ReferralLink>(`/api/admin/referrals/${id}`),

  create: (userId: number) =>
    post<ReferralLink>('/api/admin/referrals', { userId }),

  toggle: (id: number) =>
    put<ReferralLink>(`/api/admin/referrals/${id}/toggle`),

  delete: (id: number) =>
    del(`/api/admin/referrals/${id}`),

  getRegistrations: (id: number, params: { page?: number; limit?: number }) =>
    get<PaginatedResponse<ReferralRegistration>>(`/api/admin/referrals/${id}/registrations`, params)
}

// 统计 API
export const statisticsApi = {
  getOverview: () =>
    get<StatisticsOverview>('/api/admin/statistics/overview'),

  getTrends: (days: number = 30) =>
    get<StatisticsTrends>('/api/admin/statistics/trends', { days }),

  getOnlineUsers: (params: { page?: number; limit?: number }) =>
    get<PaginatedResponse<User>>('/api/admin/statistics/online', params)
}

// 管理员 API
export const adminsApi = {
  getList: () =>
    get<Admin[]>('/api/admin/admins'),

  getDetail: (id: number) =>
    get<Admin>(`/api/admin/admins/${id}`),

  create: (data: { username: string; password: string; nickname?: string }) =>
    post<Admin>('/api/admin/admins', data),

  update: (id: number, data: { nickname?: string; password?: string }) =>
    put<Admin>(`/api/admin/admins/${id}`, data),

  delete: (id: number) =>
    del(`/api/admin/admins/${id}`)
}
