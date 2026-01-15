import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { io, Socket } from 'socket.io-client'
import type { Message } from '../types'

// Socket.io 连接地址
// 开发环境：使用当前页面 origin，通过 Vite 代理连接后端
// 生产环境：从 .env 文件读取 VITE_SOCKET_URL
const getSocketUrl = (): string => {
  if (!import.meta.env.DEV) {
    // 生产环境：优先使用环境变量，回退到默认值
    return import.meta.env.VITE_SOCKET_URL || 'https://chat.yourdomain.com'
  }
  // 开发环境：使用当前页面的 origin（包括协议、主机名、端口）
  // 例如：https://172.30.12.122:8080 或 https://localhost:8080
  // Vite 代理会将 /socket.io 请求转发到后端 localhost:3000
  console.log('[Socket] 开发模式，连接到:', window.location.origin)
  return window.location.origin
}
const SOCKET_URL = getSocketUrl()

export const useSocketStore = defineStore('socket', () => {
  const socket = ref<Socket | null>(null)
  const connected = ref(false)
  const onlineUsers = ref<Set<number>>(new Set())

  // 待注册的事件监听器（解决时序问题：on 调用早于 socket 连接）
  const pendingListeners = ref<Map<string, Set<(...args: any[]) => void>>>(new Map())

  const isConnected = computed(() => connected.value)

  // 连接 socket
  const connect = () => {
    const token = uni.getStorageSync('token')
    if (!token) return

    if (socket.value?.connected) return

    socket.value = io(SOCKET_URL, {
      auth: { token },
      // 优先使用 WebSocket（跳过轮询，减少延迟）
      transports: ['websocket', 'polling'],
      // 重连配置（跨境网络可能不稳定）
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      // 连接超时（跨境网络延迟较高）
      timeout: 20000
    })

    socket.value.on('connect', () => {
      console.log('[Socket] 已连接，ID:', socket.value?.id, '连接地址:', SOCKET_URL)
      connected.value = true

      // 注册之前挂起的事件监听器
      pendingListeners.value.forEach((handlers, event) => {
        handlers.forEach(handler => {
          socket.value?.on(event, handler)
        })
        console.log(`[Socket] 已注册 ${handlers.size} 个待挂起的 ${event} 监听器`)
      })
    })

    socket.value.on('disconnect', () => {
      console.log('Socket 已断开')
      connected.value = false
    })

    socket.value.on('connect_error', (error) => {
      console.error('Socket 连接错误:', error)
      connected.value = false
    })

    // 用户上线
    socket.value.on('user_online', ({ userId }) => {
      onlineUsers.value.add(userId)
    })

    // 用户下线
    socket.value.on('user_offline', ({ userId }) => {
      onlineUsers.value.delete(userId)
    })

    // 强制下线（被封停时触发）
    socket.value.on('force_logout', ({ reason, message }) => {
      console.log('[Socket] 强制下线:', reason, message)
      // 断开连接
      disconnect()
      // 清除本地存储
      uni.removeStorageSync('token')
      uni.removeStorageSync('user')
      // 显示提示
      uni.showModal({
        title: '账号已被封停',
        content: message || '您的账号已被管理员封停，如有疑问请联系客服',
        showCancel: false,
        success: () => {
          // 跳转到登录页
          uni.reLaunch({ url: '/pages/login/index' })
        }
      })
    })
  }

  // 断开连接
  const disconnect = () => {
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
      connected.value = false
    }
  }

  // 发送消息
  const sendMessage = (
    data: {
      conversationId?: number
      receiverId?: number
      type: 'text' | 'image' | 'voice' | 'file' | 'video'
      content: string
      mediaUrl?: string
      duration?: number
      fileName?: string
      fileSize?: number
      thumbnailUrl?: string
    },
    callback?: (result: { success: boolean; message?: Message; conversationId?: number; error?: string }) => void
  ) => {
    if (!socket.value?.connected) {
      callback?.({ success: false, error: '未连接到服务器' })
      return
    }

    socket.value.emit('send_message', data, callback)
  }

  // 标记消息已读
  const markMessageRead = (conversationId: number, messageId: number) => {
    if (socket.value?.connected) {
      socket.value.emit('message_read', { conversationId, messageId })
    }
  }

  // 撤回消息
  const revokeMessage = (
    messageId: number,
    conversationId: number,
    callback?: (result: { success: boolean; error?: string }) => void
  ) => {
    if (!socket.value?.connected) {
      callback?.({ success: false, error: '未连接到服务器' })
      return
    }

    socket.value.emit('revoke_message', { messageId, conversationId }, callback)
  }

  // 发送正在输入
  const sendTyping = (conversationId: number, receiverId: number) => {
    if (socket.value?.connected) {
      socket.value.emit('typing', { conversationId, receiverId })
    }
  }

  // 监听事件（支持 socket 未连接时挂起）
  const on = (event: string, handler: (...args: any[]) => void) => {
    // 添加到待挂起列表（用于 socket 断开重连后恢复）
    if (!pendingListeners.value.has(event)) {
      pendingListeners.value.set(event, new Set())
    }
    pendingListeners.value.get(event)!.add(handler)

    // 如果 socket 已连接，立即注册
    if (socket.value?.connected) {
      socket.value.on(event, handler)
    }
  }

  // 移除事件监听
  const off = (event: string, handler?: (...args: any[]) => void) => {
    // 从待挂起列表移除
    if (handler && pendingListeners.value.has(event)) {
      pendingListeners.value.get(event)!.delete(handler)
    }
    socket.value?.off(event, handler)
  }

  // 检查用户是否在线
  const isUserOnline = (userId: number) => {
    return onlineUsers.value.has(userId)
  }

  return {
    socket,
    connected,
    isConnected,
    onlineUsers,
    connect,
    disconnect,
    sendMessage,
    markMessageRead,
    revokeMessage,
    sendTyping,
    on,
    off,
    isUserOnline
  }
})
