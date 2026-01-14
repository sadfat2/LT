import { defineStore } from 'pinia'
import { ref } from 'vue'
import { configApi } from '../api'

export const useConfigStore = defineStore('config', () => {
  // 功能开关状态
  const registerEnabled = ref(true)
  const voiceCallEnabled = ref(true)
  const loaded = ref(false)

  // 获取配置（每次都获取最新值）
  async function fetchConfig() {
    try {
      const res = await configApi.getPublicConfig()
      registerEnabled.value = res.data.registerEnabled
      voiceCallEnabled.value = res.data.voiceCallEnabled
      loaded.value = true
    } catch (error) {
      console.error('获取配置失败:', error)
      // 失败时保持默认值（全部启用）
    }
  }

  return {
    registerEnabled,
    voiceCallEnabled,
    loaded,
    fetchConfig
  }
})
