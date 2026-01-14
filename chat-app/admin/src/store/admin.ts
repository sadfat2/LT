import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api'
import type { Admin } from '@/types'
import router from '@/router'

export const useAdminStore = defineStore('admin', () => {
  const token = ref<string | null>(localStorage.getItem('admin_token'))
  const adminInfo = ref<Admin | null>(
    localStorage.getItem('admin_info')
      ? JSON.parse(localStorage.getItem('admin_info')!)
      : null
  )

  const isLoggedIn = computed(() => !!token.value)

  async function login(username: string, password: string) {
    const res = await authApi.login(username, password)
    token.value = res.data.token
    adminInfo.value = res.data.admin
    localStorage.setItem('admin_token', res.data.token)
    localStorage.setItem('admin_info', JSON.stringify(res.data.admin))
    return res
  }

  function logout() {
    token.value = null
    adminInfo.value = null
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_info')
    router.push('/login')
  }

  async function fetchProfile() {
    const res = await authApi.getProfile()
    adminInfo.value = res.data
    localStorage.setItem('admin_info', JSON.stringify(res.data))
    return res
  }

  async function updateProfile(data: { nickname?: string; password?: string; oldPassword?: string }) {
    const res = await authApi.updateProfile(data)
    adminInfo.value = res.data
    localStorage.setItem('admin_info', JSON.stringify(res.data))
    return res
  }

  return {
    token,
    adminInfo,
    isLoggedIn,
    login,
    logout,
    fetchProfile,
    updateProfile
  }
})
