import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@/types'
import api from '@/api'
import { useSocketStore } from './socket'

export const useUserStore = defineStore('user', () => {
  const token = ref<string | null>(localStorage.getItem('doudizhu_token'))
  const user = ref<User | null>(null)

  const isLoggedIn = computed(() => !!token.value)

  // 登录
  async function login(account: string, password: string) {
    const res = await api.auth.login(account, password)
    token.value = res.token
    user.value = res.user
    localStorage.setItem('doudizhu_token', res.token)

    // 连接 Socket
    const socketStore = useSocketStore()
    socketStore.connect()

    return res
  }

  // 注册
  async function register(account: string, password: string, nickname: string) {
    const res = await api.auth.register(account, password, nickname)
    token.value = res.token
    user.value = res.user
    localStorage.setItem('doudizhu_token', res.token)

    // 连接 Socket
    const socketStore = useSocketStore()
    socketStore.connect()

    return res
  }

  // 从聊天应用登录
  async function loginFromChat(chatToken: string) {
    const res = await api.auth.loginFromChat(chatToken)
    token.value = res.token
    user.value = res.user
    localStorage.setItem('doudizhu_token', res.token)

    // 连接 Socket
    const socketStore = useSocketStore()
    socketStore.connect()

    return res
  }

  // 获取用户信息
  async function fetchProfile() {
    if (!token.value) return
    try {
      const res = await api.user.getProfile()
      user.value = res.user
    } catch {
      logout()
    }
  }

  // 登出
  function logout() {
    // 断开 Socket
    const socketStore = useSocketStore()
    socketStore.disconnect()

    token.value = null
    user.value = null
    localStorage.removeItem('doudizhu_token')
  }

  // 更新金币
  function updateCoins(coins: number) {
    if (user.value) {
      user.value.coins = coins
    }
  }

  // 设置用户信息
  function setUser(newUser: User) {
    user.value = newUser
  }

  return {
    token,
    user,
    isLoggedIn,
    login,
    register,
    loginFromChat,
    fetchProfile,
    logout,
    updateCoins,
    setUser,
  }
})
