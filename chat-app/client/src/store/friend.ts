import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Friend, FriendRequest } from '../types'
import { friendApi } from '../api'
import { useSocketStore } from './socket'

export const useFriendStore = defineStore('friend', () => {
  const friends = ref<Friend[]>([])
  const groupedFriends = ref<Record<string, Friend[]>>({})
  const receivedRequests = ref<FriendRequest[]>([])
  const sentRequests = ref<FriendRequest[]>([])
  const pendingCount = ref(0)
  const loading = ref(false)

  // 获取好友列表
  const fetchFriends = async () => {
    loading.value = true
    try {
      const res = await friendApi.getList()
      friends.value = res.data.list
      groupedFriends.value = res.data.grouped
    } finally {
      loading.value = false
    }
  }

  // 获取好友申请列表
  const fetchRequests = async () => {
    const res = await friendApi.getRequests()
    receivedRequests.value = res.data.received
    sentRequests.value = res.data.sent
  }

  // 获取待处理申请数量
  const fetchPendingCount = async () => {
    const res = await friendApi.getPendingCount()
    pendingCount.value = res.data.count
  }

  // 发送好友申请
  const sendRequest = async (toUserId: number, message?: string) => {
    await friendApi.sendRequest(toUserId, message)
    uni.showToast({ title: '申请已发送', icon: 'success' })
  }

  // 同意好友申请
  const acceptRequest = async (id: number) => {
    await friendApi.accept(id)
    // 更新申请状态
    const request = receivedRequests.value.find(r => r.id === id)
    if (request) {
      request.status = 'accepted'
    }
    pendingCount.value = Math.max(0, pendingCount.value - 1)
    // 刷新好友列表
    await fetchFriends()
    uni.showToast({ title: '已同意', icon: 'success' })
  }

  // 拒绝好友申请
  const rejectRequest = async (id: number) => {
    await friendApi.reject(id)
    // 更新申请状态
    const request = receivedRequests.value.find(r => r.id === id)
    if (request) {
      request.status = 'rejected'
    }
    pendingCount.value = Math.max(0, pendingCount.value - 1)
    uni.showToast({ title: '已拒绝', icon: 'none' })
  }

  // 初始化事件监听
  const initSocketListeners = () => {
    const socketStore = useSocketStore()

    // 收到好友申请
    socketStore.on('friend_request', (data: FriendRequest) => {
      receivedRequests.value.unshift(data)
      pendingCount.value++
      uni.showToast({ title: '收到新的好友申请', icon: 'none' })
    })

    // 好友申请被接受
    socketStore.on('friend_accepted', (data) => {
      // 刷新好友列表
      fetchFriends()
      uni.showToast({ title: `${data.nickname} 已同意你的好友申请`, icon: 'none' })
    })
  }

  return {
    friends,
    groupedFriends,
    receivedRequests,
    sentRequests,
    pendingCount,
    loading,
    fetchFriends,
    fetchRequests,
    fetchPendingCount,
    sendRequest,
    acceptRequest,
    rejectRequest,
    initSocketListeners
  }
})
