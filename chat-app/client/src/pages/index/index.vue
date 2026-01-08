<template>
  <view class="message-page">
    <!-- 会话列表 -->
    <scroll-view
      scroll-y
      class="conversation-list"
      @scrolltolower="onLoadMore"
    >
      <view
        v-for="conversation in conversations"
        :key="conversation.id"
        class="conversation-item"
        @click="goChat(conversation)"
        @longpress="showActions(conversation)"
      >
        <image
          class="avatar"
          :src="conversation.other_user?.avatar || '/static/images/default-avatar.png'"
          mode="aspectFill"
        />
        <view class="content">
          <view class="top">
            <text class="name">{{ conversation.other_user?.nickname || '未知用户' }}</text>
            <text class="time">{{ formatTime(conversation.last_message?.created_at) }}</text>
          </view>
          <view class="bottom">
            <text class="message" :class="{ revoked: conversation.last_message?.status === 'revoked' }">
              {{ getMessagePreview(conversation.last_message) }}
            </text>
            <view v-if="conversation.unread_count > 0" class="badge">
              {{ conversation.unread_count > 99 ? '99+' : conversation.unread_count }}
            </view>
          </view>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-if="!loading && conversations.length === 0" class="empty">
        <text class="empty-text">暂无消息</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useConversationStore } from '../../store/conversation'
import { useUserStore } from '../../store/user'
import type { Conversation, Message } from '../../types'

const conversationStore = useConversationStore()
const userStore = useUserStore()

const loading = ref(false)
const conversations = ref<Conversation[]>([])

onMounted(() => {
  if (!userStore.isLoggedIn) {
    uni.reLaunch({ url: '/pages/login/index' })
    return
  }

  // 初始化 socket 事件监听
  conversationStore.initSocketListeners()
})

onShow(() => {
  if (userStore.isLoggedIn) {
    loadConversations()
  }
})

const loadConversations = async () => {
  loading.value = true
  try {
    await conversationStore.fetchConversations()
    conversations.value = conversationStore.conversations
  } finally {
    loading.value = false
  }
}

const onLoadMore = () => {
  // 加载更多（如果需要分页）
}

const goChat = (conversation: Conversation) => {
  conversationStore.setCurrentConversation(conversation)
  uni.navigateTo({
    url: `/pages/chat/index?conversationId=${conversation.id}&userId=${conversation.other_user?.id}&nickname=${conversation.other_user?.nickname}`
  })
}

const showActions = (conversation: Conversation) => {
  uni.showActionSheet({
    itemList: ['删除会话'],
    success: async (res) => {
      if (res.tapIndex === 0) {
        uni.showModal({
          title: '提示',
          content: '确定删除该会话吗？',
          success: async (modalRes) => {
            if (modalRes.confirm) {
              await conversationStore.deleteConversation(conversation.id)
              conversations.value = conversationStore.conversations
            }
          }
        })
      }
    }
  })
}

const getMessagePreview = (message: Message | null) => {
  if (!message) return ''

  if (message.status === 'revoked') {
    return '此消息已撤回'
  }

  switch (message.type) {
    case 'text':
      return message.content
    case 'image':
      return '[图片]'
    case 'voice':
      return '[语音]'
    default:
      return message.content
  }
}

const formatTime = (time?: string) => {
  if (!time) return ''

  const date = new Date(time)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  // 今天
  if (date.toDateString() === now.toDateString()) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  // 昨天
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) {
    return '昨天'
  }

  // 本周
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = ['日', '一', '二', '三', '四', '五', '六']
    return `周${days[date.getDay()]}`
  }

  // 更早
  return `${date.getMonth() + 1}/${date.getDate()}`
}
</script>

<style scoped>
.message-page {
  min-height: 100vh;
  background-color: var(--bg-color);
}

.conversation-list {
  height: 100vh;
}

.conversation-item {
  display: flex;
  align-items: center;
  padding: 24rpx 30rpx;
  background-color: var(--bg-white);
  border-bottom: 1rpx solid var(--border-color);
}

.conversation-item:active {
  background-color: #f5f5f5;
}

.avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 8rpx;
  margin-right: 24rpx;
  flex-shrink: 0;
}

.content {
  flex: 1;
  overflow: hidden;
}

.top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.name {
  font-size: 32rpx;
  color: var(--text-color);
  font-weight: 500;
}

.time {
  font-size: 24rpx;
  color: var(--text-light);
}

.bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.message {
  flex: 1;
  font-size: 28rpx;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message.revoked {
  color: var(--text-light);
}

.empty {
  padding: 200rpx 0;
}
</style>
