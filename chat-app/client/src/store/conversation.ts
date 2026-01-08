import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Conversation, Message } from '../types'
import { conversationApi } from '../api'
import { useSocketStore } from './socket'

export const useConversationStore = defineStore('conversation', () => {
  const conversations = ref<Conversation[]>([])
  const currentConversation = ref<Conversation | null>(null)
  const messages = ref<Message[]>([])
  const loading = ref(false)

  // 总未读数
  const totalUnread = computed(() =>
    conversations.value.reduce((sum, conv) => sum + conv.unread_count, 0)
  )

  // 获取会话列表
  const fetchConversations = async () => {
    loading.value = true
    try {
      const res = await conversationApi.getList()
      conversations.value = res.data
    } finally {
      loading.value = false
    }
  }

  // 创建私聊会话
  const createPrivate = async (userId: number) => {
    const res = await conversationApi.createPrivate(userId)
    if (res.data.isNew) {
      await fetchConversations()
    }
    return res.data.conversationId
  }

  // 删除会话
  const deleteConversation = async (id: number) => {
    await conversationApi.delete(id)
    conversations.value = conversations.value.filter(c => c.id !== id)
  }

  // 获取消息
  const fetchMessages = async (conversationId: number, page = 1) => {
    loading.value = true
    try {
      const res = await conversationApi.getMessages(conversationId, page)
      if (page === 1) {
        messages.value = res.data.messages
      } else {
        messages.value = [...res.data.messages, ...messages.value]
      }
      return res.data
    } finally {
      loading.value = false
    }
  }

  // 设置当前会话
  const setCurrentConversation = (conversation: Conversation | null) => {
    currentConversation.value = conversation
    if (conversation) {
      // 清除未读数
      const conv = conversations.value.find(c => c.id === conversation.id)
      if (conv) {
        conv.unread_count = 0
      }
    }
  }

  // 添加新消息
  const addMessage = (message: Message) => {
    messages.value.push(message)

    // 更新会话列表中的最后消息
    const conv = conversations.value.find(c => c.id === message.conversation_id)
    if (conv) {
      conv.last_message = message
      conv.updated_at = message.created_at

      // 如果不是当前会话，增加未读数
      if (currentConversation.value?.id !== message.conversation_id) {
        conv.unread_count++
      }

      // 排序会话列表
      sortConversations()
    }
  }

  // 更新消息状态
  const updateMessageStatus = (messageId: number, status: Message['status']) => {
    const message = messages.value.find(m => m.id === messageId)
    if (message) {
      message.status = status
    }
  }

  // 撤回消息
  const revokeMessage = (messageId: number) => {
    const message = messages.value.find(m => m.id === messageId)
    if (message) {
      message.status = 'revoked'
      message.content = '此消息已撤回'
    }
  }

  // 排序会话列表
  const sortConversations = () => {
    conversations.value.sort((a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
  }

  // 初始化事件监听
  const initSocketListeners = () => {
    const socketStore = useSocketStore()

    // 新消息
    socketStore.on('new_message', ({ conversationId, message }) => {
      // 如果是当前会话，添加消息
      if (currentConversation.value?.id === conversationId) {
        addMessage(message)
        // 标记已读
        socketStore.markMessageRead(conversationId, message.id)
      } else {
        // 更新会话列表
        const conv = conversations.value.find(c => c.id === conversationId)
        if (conv) {
          conv.last_message = message
          conv.unread_count++
          conv.updated_at = message.created_at
          sortConversations()
        } else {
          // 新会话，刷新列表
          fetchConversations()
        }
      }
    })

    // 消息已读回执
    socketStore.on('message_read_ack', ({ messageId }) => {
      updateMessageStatus(messageId, 'read')
    })

    // 消息撤回
    socketStore.on('message_revoked', ({ messageId }) => {
      revokeMessage(messageId)
    })
  }

  return {
    conversations,
    currentConversation,
    messages,
    loading,
    totalUnread,
    fetchConversations,
    createPrivate,
    deleteConversation,
    fetchMessages,
    setCurrentConversation,
    addMessage,
    updateMessageStatus,
    revokeMessage,
    initSocketListeners
  }
})
