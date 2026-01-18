<script setup lang="ts">
import { onMounted } from 'vue'
import { useUserStore } from '@/store/user'
import { useSocketStore } from '@/store/socket'

const userStore = useUserStore()
const socketStore = useSocketStore()

onMounted(async () => {
  // 如果已登录，获取用户信息并连接 Socket
  if (userStore.isLoggedIn) {
    await userStore.fetchProfile()
    socketStore.connect()
  }
})
</script>

<template>
  <router-view />
</template>

<style lang="scss">
#app {
  width: 100%;
  height: 100%;
}
</style>
