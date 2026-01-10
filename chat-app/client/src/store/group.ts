import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Group } from '../types'
import { groupApi } from '../api'
import { useSocketStore } from './socket'
import { useConversationStore } from './conversation'

export const useGroupStore = defineStore('group', () => {
  const groups = ref<Group[]>([])
  const currentGroup = ref<Group | null>(null)
  const loading = ref(false)

  // 获取群聊列表
  const fetchGroups = async () => {
    loading.value = true
    try {
      const res = await groupApi.getList()
      groups.value = res.data
    } finally {
      loading.value = false
    }
  }

  // 获取群详情
  const fetchGroupDetail = async (groupId: number) => {
    loading.value = true
    try {
      const res = await groupApi.getDetail(groupId)
      currentGroup.value = res.data
      return res.data
    } finally {
      loading.value = false
    }
  }

  // 创建群聊
  const createGroup = async (name: string, memberIds: number[]) => {
    const res = await groupApi.create(name, memberIds)
    groups.value.unshift(res.data.group)

    // 刷新会话列表
    const conversationStore = useConversationStore()
    await conversationStore.fetchConversations()

    return res.data
  }

  // 邀请成员
  const inviteMembers = async (groupId: number, userIds: number[]) => {
    const res = await groupApi.invite(groupId, userIds)
    // 更新当前群详情
    if (currentGroup.value?.id === groupId) {
      currentGroup.value = res.data
    }
    // 更新群列表
    const index = groups.value.findIndex(g => g.id === groupId)
    if (index !== -1) {
      groups.value[index] = { ...groups.value[index], member_count: res.data.member_count }
    }
    return res.data
  }

  // 退出群聊
  const leaveGroup = async (groupId: number) => {
    await groupApi.leave(groupId)
    // 从列表中移除
    groups.value = groups.value.filter(g => g.id !== groupId)
    if (currentGroup.value?.id === groupId) {
      currentGroup.value = null
    }
    // 刷新会话列表
    const conversationStore = useConversationStore()
    await conversationStore.fetchConversations()
  }

  // 更新群信息
  const updateGroup = async (groupId: number, data: { name?: string; avatar?: string }) => {
    const res = await groupApi.update(groupId, data)
    // 更新当前群详情
    if (currentGroup.value?.id === groupId) {
      currentGroup.value = res.data
    }
    // 更新群列表
    const index = groups.value.findIndex(g => g.id === groupId)
    if (index !== -1) {
      groups.value[index] = res.data
    }
    return res.data
  }

  // 移除成员
  const removeMember = async (groupId: number, userId: number) => {
    await groupApi.removeMember(groupId, userId)
    // 更新当前群详情
    if (currentGroup.value?.id === groupId && currentGroup.value.members) {
      currentGroup.value.members = currentGroup.value.members.filter(m => m.user_id !== userId)
      currentGroup.value.member_count--
    }
  }

  // 解散群聊
  const dissolveGroup = async (groupId: number) => {
    await groupApi.dissolve(groupId)
    groups.value = groups.value.filter(g => g.id !== groupId)
    if (currentGroup.value?.id === groupId) {
      currentGroup.value = null
    }
    // 刷新会话列表
    const conversationStore = useConversationStore()
    await conversationStore.fetchConversations()
  }

  // 初始化 Socket 监听
  const initSocketListeners = () => {
    const socketStore = useSocketStore()
    const conversationStore = useConversationStore()

    // 被邀请加入群聊
    socketStore.on('group_created', async (data: { group: Group; conversationId: number }) => {
      groups.value.unshift(data.group)
      await conversationStore.fetchConversations()
      uni.showToast({ title: `您已加入群聊: ${data.group.name}`, icon: 'none' })
    })

    // 加入群聊
    socketStore.on('group_joined', async (data: { group: Group; conversationId: number }) => {
      groups.value.unshift(data.group)
      await conversationStore.fetchConversations()
      uni.showToast({ title: `您已加入群聊: ${data.group.name}`, icon: 'none' })
    })

    // 新成员加入
    socketStore.on('member_joined', (data: { groupId: number; newMembers: any[] }) => {
      if (currentGroup.value?.id === data.groupId) {
        fetchGroupDetail(data.groupId)
      }
      const group = groups.value.find(g => g.id === data.groupId)
      if (group) {
        group.member_count += data.newMembers.length
      }
    })

    // 成员退出
    socketStore.on('member_left', (data: { groupId: number; userId: number; nickname: string }) => {
      if (currentGroup.value?.id === data.groupId && currentGroup.value.members) {
        currentGroup.value.members = currentGroup.value.members.filter(m => m.user_id !== data.userId)
        currentGroup.value.member_count--
      }
      const group = groups.value.find(g => g.id === data.groupId)
      if (group) {
        group.member_count--
      }
    })

    // 被移出群聊
    socketStore.on('removed_from_group', async (data: { groupId: number; groupName: string }) => {
      groups.value = groups.value.filter(g => g.id !== data.groupId)
      if (currentGroup.value?.id === data.groupId) {
        currentGroup.value = null
      }
      await conversationStore.fetchConversations()
      uni.showToast({ title: `您已被移出群聊: ${data.groupName}`, icon: 'none' })
    })

    // 群聊解散
    socketStore.on('group_dissolved', async (data: { groupId: number; groupName: string }) => {
      groups.value = groups.value.filter(g => g.id !== data.groupId)
      if (currentGroup.value?.id === data.groupId) {
        currentGroup.value = null
      }
      await conversationStore.fetchConversations()
      uni.showToast({ title: `群聊已解散: ${data.groupName}`, icon: 'none' })
    })

    // 群信息更新
    socketStore.on('group_updated', (data: { groupId: number; group: Group }) => {
      if (currentGroup.value?.id === data.groupId) {
        currentGroup.value = { ...currentGroup.value, ...data.group }
      }
      const index = groups.value.findIndex(g => g.id === data.groupId)
      if (index !== -1) {
        groups.value[index] = { ...groups.value[index], ...data.group }
      }
    })
  }

  // 清空数据
  const clear = () => {
    groups.value = []
    currentGroup.value = null
  }

  return {
    groups,
    currentGroup,
    loading,
    fetchGroups,
    fetchGroupDetail,
    createGroup,
    inviteMembers,
    leaveGroup,
    updateGroup,
    removeMember,
    dissolveGroup,
    initSocketListeners,
    clear
  }
})
