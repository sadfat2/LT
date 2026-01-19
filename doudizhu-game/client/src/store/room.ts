import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useSocketStore } from './socket'
import { useUserStore } from './user'
import type { Room, Player, RoomListItem } from '@/types'

export const useRoomStore = defineStore('room', () => {
  const socketStore = useSocketStore()

  const currentRoom = ref<Room | null>(null)
  const roomList = ref<RoomListItem[]>([])
  const isLoading = ref(false)
  const isMatching = ref(false)

  // 当前用户在房间中的玩家信息
  const myPlayer = computed(() => {
    if (!currentRoom.value) return null
    const userStore = useUserStore()
    return currentRoom.value.players.find((p) => p.id === userStore.user?.id) || null
  })

  // 是否是房主
  const isOwner = computed(() => {
    if (!currentRoom.value) return false
    const userStore = useUserStore()
    return currentRoom.value.ownerId === userStore.user?.id
  })

  // 房间是否满员
  const isFull = computed(() => {
    if (!currentRoom.value) return false
    return currentRoom.value.players.length >= currentRoom.value.maxPlayers
  })

  // 所有人是否都准备好了
  const allReady = computed(() => {
    if (!currentRoom.value) return false
    return (
      currentRoom.value.players.length === 3 && currentRoom.value.players.every((p) => p.isReady)
    )
  })

  // 初始化房间事件监听
  function initRoomListeners() {
    // 有玩家加入
    socketStore.on<{ room: Room; player: Player }>('room:joined', (data) => {
      if (currentRoom.value && currentRoom.value.id === data.room.id) {
        currentRoom.value = data.room
      }
    })

    // 有玩家离开
    socketStore.on<{ roomId: string; playerId: number }>('room:left', (data) => {
      if (currentRoom.value && currentRoom.value.id === data.roomId) {
        currentRoom.value.players = currentRoom.value.players.filter(
          (p) => p.id !== data.playerId
        )
      }
    })

    // 玩家准备状态变化
    socketStore.on<{ roomId: string; playerId: number; isReady: boolean }>('room:ready', (data) => {
      if (currentRoom.value && currentRoom.value.id === data.roomId) {
        const player = currentRoom.value.players.find((p) => p.id === data.playerId)
        if (player) {
          player.isReady = data.isReady
        }
      }
    })

    // 被踢出房间
    socketStore.on<{ roomId: string; playerId: number }>('room:kicked', () => {
      currentRoom.value = null
    })

    // 游戏即将开始
    socketStore.on<{ roomId: string }>('game:starting', (data) => {
      console.log('[roomStore] 收到 game:starting', data)
      if (currentRoom.value && currentRoom.value.id === data.roomId) {
        console.log('[roomStore] 更新房间状态为 starting')
        currentRoom.value.status = 'starting'
      }
    })

    // 玩家上线
    socketStore.on<{ playerId: number }>('player:online', (data) => {
      if (currentRoom.value) {
        const player = currentRoom.value.players.find((p) => p.id === data.playerId)
        if (player) {
          player.isOnline = true
        }
      }
    })

    // 玩家离线
    socketStore.on<{ playerId: number }>('player:offline', (data) => {
      if (currentRoom.value) {
        const player = currentRoom.value.players.find((p) => p.id === data.playerId)
        if (player) {
          player.isOnline = false
        }
      }
    })
  }

  // 获取房间列表
  async function fetchRoomList() {
    isLoading.value = true
    try {
      const response = await socketStore.emit<{ rooms: RoomListItem[] }>('room:list')
      roomList.value = response.rooms || []
    } catch (error) {
      console.error('获取房间列表失败:', error)
    } finally {
      isLoading.value = false
    }
  }

  // 创建房间
  async function createRoom(name: string, baseScore: number = 100) {
    isLoading.value = true
    try {
      const response = await socketStore.emit<{ room: Room }>('room:create', { name, baseScore })
      currentRoom.value = response.room
      return response.room
    } catch (error) {
      console.error('创建房间失败:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  // 加入房间
  async function joinRoom(roomId: string) {
    isLoading.value = true
    try {
      const response = await socketStore.emit<{ room: Room }>('room:join', { roomId })
      currentRoom.value = response.room
      return response.room
    } catch (error) {
      console.error('加入房间失败:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  // 离开房间
  async function leaveRoom() {
    if (!currentRoom.value) return
    try {
      await socketStore.emit('room:leave', {})
      currentRoom.value = null
    } catch (error) {
      console.error('离开房间失败:', error)
      throw error
    }
  }

  // 切换准备状态
  async function toggleReady() {
    try {
      const response = await socketStore.emit<{ success: boolean; isReady: boolean }>('room:ready', {})
      return response.isReady
    } catch (error) {
      console.error('切换准备状态失败:', error)
      throw error
    }
  }

  // 踢出玩家
  async function kickPlayer(playerId: number) {
    try {
      await socketStore.emit('room:kick', { playerId })
    } catch (error) {
      console.error('踢出玩家失败:', error)
      throw error
    }
  }

  // 快速匹配
  async function quickMatch(baseScore: number = 100) {
    isMatching.value = true
    try {
      const response = await socketStore.emit<{ room: Room }>('room:quickMatch', { baseScore })
      currentRoom.value = response.room
      return response.room
    } catch (error) {
      console.error('快速匹配失败:', error)
      throw error
    } finally {
      isMatching.value = false
    }
  }

  // 设置当前房间
  function setCurrentRoom(room: Room | null) {
    currentRoom.value = room
  }

  // 清空状态
  function clearRoom() {
    currentRoom.value = null
    roomList.value = []
    isLoading.value = false
    isMatching.value = false
  }

  return {
    currentRoom,
    roomList,
    isLoading,
    isMatching,
    myPlayer,
    isOwner,
    isFull,
    allReady,
    initRoomListeners,
    fetchRoomList,
    createRoom,
    joinRoom,
    leaveRoom,
    toggleReady,
    kickPlayer,
    quickMatch,
    setCurrentRoom,
    clearRoom,
  }
})
