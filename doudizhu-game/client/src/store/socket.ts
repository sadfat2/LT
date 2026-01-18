import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { io, Socket } from 'socket.io-client'
import { useUserStore } from './user'

export const useSocketStore = defineStore('socket', () => {
  const socket = ref<Socket | null>(null)
  const isConnected = ref(false)
  const isConnecting = ref(false)
  const onlineUsers = ref<number[]>([])

  const connectionStatus = computed(() => {
    if (isConnecting.value) return 'connecting'
    if (isConnected.value) return 'connected'
    return 'disconnected'
  })

  // 连接 Socket
  function connect() {
    const userStore = useUserStore()

    if (!userStore.token) {
      console.warn('Socket 连接失败：未登录')
      return
    }

    if (socket.value?.connected) {
      console.warn('Socket 已连接')
      return
    }

    isConnecting.value = true

    socket.value = io('/', {
      auth: {
        token: userStore.token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    // 连接成功
    socket.value.on('connect', () => {
      console.log('Socket 连接成功')
      isConnected.value = true
      isConnecting.value = false

      // 获取在线用户列表
      fetchOnlineUsers()
    })

    // 连接断开
    socket.value.on('disconnect', (reason) => {
      console.log('Socket 断开连接:', reason)
      isConnected.value = false
    })

    // 连接错误
    socket.value.on('connect_error', (error) => {
      console.error('Socket 连接错误:', error.message)
      isConnecting.value = false
    })

    // 用户上线
    socket.value.on('user:online', (data: { userId: number; nickname: string }) => {
      console.log(`用户上线: ${data.nickname}`)
      if (!onlineUsers.value.includes(data.userId)) {
        onlineUsers.value.push(data.userId)
      }
    })

    // 用户下线
    socket.value.on('user:offline', (data: { userId: number }) => {
      console.log(`用户下线: ${data.userId}`)
      onlineUsers.value = onlineUsers.value.filter((id) => id !== data.userId)
    })
  }

  // 断开连接
  function disconnect() {
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
    }
    isConnected.value = false
    isConnecting.value = false
    onlineUsers.value = []
  }

  // 获取在线用户列表
  function fetchOnlineUsers() {
    if (!socket.value?.connected) return

    socket.value.emit('online:list', (response: { userIds?: number[]; error?: string }) => {
      if (response.userIds) {
        onlineUsers.value = response.userIds
      }
    })
  }

  // 检查用户是否在线
  function checkUserOnline(userId: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (!socket.value?.connected) {
        resolve(false)
        return
      }

      socket.value.emit(
        'online:check',
        { userId },
        (response: { isOnline?: boolean; error?: string }) => {
          resolve(response.isOnline ?? false)
        }
      )
    })
  }

  // 发送事件
  function emit<T = unknown>(event: string, data?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!socket.value?.connected) {
        reject(new Error('Socket 未连接'))
        return
      }

      socket.value.emit(event, data, (response: T & { error?: string }) => {
        if (response && typeof response === 'object' && 'error' in response) {
          reject(new Error(response.error as string))
        } else {
          resolve(response)
        }
      })
    })
  }

  // 监听事件
  function on<T = unknown>(event: string, callback: (data: T) => void) {
    if (!socket.value) return

    socket.value.on(event, callback)
  }

  // 移除事件监听
  function off(event: string, callback?: (...args: unknown[]) => void) {
    if (!socket.value) return

    if (callback) {
      socket.value.off(event, callback)
    } else {
      socket.value.off(event)
    }
  }

  return {
    socket,
    isConnected,
    isConnecting,
    connectionStatus,
    onlineUsers,
    connect,
    disconnect,
    fetchOnlineUsers,
    checkUserOnline,
    emit,
    on,
    off,
  }
})
