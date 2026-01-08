import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '../types'
import { authApi, userApi } from '../api'
import { useSocketStore } from './socket'

export const useUserStore = defineStore('user', () => {
  const token = ref<string>('')
  const user = ref<User | null>(null)

  const isLoggedIn = computed(() => !!token.value && !!user.value)

  // 初始化检查登录状态
  const checkAuth = () => {
    const savedToken = uni.getStorageSync('token')
    const savedUser = uni.getStorageSync('user')

    if (savedToken && savedUser) {
      token.value = savedToken
      user.value = savedUser
      // 连接 socket
      const socketStore = useSocketStore()
      socketStore.connect()
    }
  }

  // 登录
  const login = async (account: string, password: string) => {
    const res = await authApi.login(account, password)
    token.value = res.data.token
    user.value = res.data.user

    uni.setStorageSync('token', res.data.token)
    uni.setStorageSync('user', res.data.user)

    // 连接 socket
    const socketStore = useSocketStore()
    socketStore.connect()

    return res.data
  }

  // 注册
  const register = async (account: string, password: string) => {
    const res = await authApi.register(account, password)
    token.value = res.data.token
    user.value = res.data.user

    uni.setStorageSync('token', res.data.token)
    uni.setStorageSync('user', res.data.user)

    // 连接 socket
    const socketStore = useSocketStore()
    socketStore.connect()

    return res.data
  }

  // 获取用户信息
  const fetchProfile = async () => {
    const res = await userApi.getProfile()
    user.value = res.data
    uni.setStorageSync('user', res.data)
    return res.data
  }

  // 更新用户信息
  const updateProfile = async (data: { nickname?: string; signature?: string }) => {
    const res = await userApi.updateProfile(data)
    user.value = res.data
    uni.setStorageSync('user', res.data)
    return res.data
  }

  // 更新头像
  const updateAvatar = (avatar: string) => {
    if (user.value) {
      user.value.avatar = avatar
      uni.setStorageSync('user', user.value)
    }
  }

  // 登出
  const logout = () => {
    // 断开 socket
    const socketStore = useSocketStore()
    socketStore.disconnect()

    token.value = ''
    user.value = null
    uni.removeStorageSync('token')
    uni.removeStorageSync('user')

    uni.reLaunch({ url: '/pages/login/index' })
  }

  return {
    token,
    user,
    isLoggedIn,
    checkAuth,
    login,
    register,
    fetchProfile,
    updateProfile,
    updateAvatar,
    logout
  }
})
