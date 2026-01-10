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
        <!-- 群聊头像（九宫格组合） -->
        <view v-if="conversation.type === 'group'" class="group-avatar">
          <image
            v-for="(member, index) in getGroupAvatars(conversation)"
            :key="index"
            class="group-avatar-item"
            :class="'count-' + getGroupAvatars(conversation).length"
            :src="member.avatar || '/static/images/default-avatar.svg'"
            mode="aspectFill"
          />
        </view>
        <!-- 私聊头像 -->
        <image
          v-else
          class="avatar"
          :src="conversation.other_user?.avatar || '/static/images/default-avatar.svg'"
          mode="aspectFill"
        />
        <view class="content">
          <view class="top">
            <text class="name">{{ getConversationName(conversation) }}</text>
            <text class="time">{{ formatTime(conversation.last_message?.created_at) }}</text>
          </view>
          <view class="bottom">
            <text class="message" :class="{ revoked: conversation.last_message?.status === 'revoked' }">
              {{ getMessagePreview(conversation) }}
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

    <!-- 通话组件 -->
    <CallModal />
    <CallScreen />
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useConversationStore } from '../../store/conversation'
import { useUserStore } from '../../store/user'
import { useFriendStore } from '../../store/friend'
import { useCallStore } from '../../store/call'
import type { Conversation, Message } from '../../types'

const conversationStore = useConversationStore()
const userStore = useUserStore()
const friendStore = useFriendStore()
const callStore = useCallStore()

// 获取好友显示名称（备注优先）
const getDisplayName = (userId?: number): string => {
  if (!userId) return '未知用户'
  const friend = friendStore.friends.find(f => f.id === userId)
  return friend?.remark || friend?.nickname || '未知用户'
}

// 获取会话名称（支持群聊和私聊）
const getConversationName = (conversation: Conversation): string => {
  if (conversation.type === 'group') {
    return conversation.group_info?.name || '群聊'
  }
  return getDisplayName(conversation.other_user?.id)
}

// 获取群聊头像列表（最多4个）
const getGroupAvatars = (conversation: Conversation) => {
  return conversation.group_info?.member_avatars || []
}

const loading = ref(false)
const conversations = ref<Conversation[]>([])

onMounted(() => {
  if (!userStore.isLoggedIn) {
    uni.reLaunch({ url: '/pages/login/index' })
    return
  }

  // 初始化 socket 事件监听
  conversationStore.initSocketListeners()

  // 初始化通话事件监听
  callStore.initCallListeners()
})

onUnmounted(() => {
  // 移除通话事件监听
  callStore.removeCallListeners()
})

onShow(() => {
  if (userStore.isLoggedIn) {
    loadConversations()
    // 确保好友列表已加载（用于获取备注）
    if (friendStore.friends.length === 0) {
      friendStore.fetchFriends()
    }
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

  if (conversation.type === 'group') {
    // 群聊
    uni.navigateTo({
      url: `/pages/chat/index?conversationId=${conversation.id}&type=group&groupId=${conversation.group_id}`
    })
  } else {
    // 私聊
    const displayName = getDisplayName(conversation.other_user?.id)
    uni.navigateTo({
      url: `/pages/chat/index?conversationId=${conversation.id}&userId=${conversation.other_user?.id}&nickname=${encodeURIComponent(displayName)}&avatar=${encodeURIComponent(conversation.other_user?.avatar || '')}`
    })
  }
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

const getMessagePreview = (conversation: Conversation) => {
  const message = conversation.last_message
  if (!message) return ''

  if (message.status === 'revoked') {
    return '此消息已撤回'
  }

  let prefix = ''
  // 群聊显示发送者
  if (conversation.type === 'group' && message.sender_id) {
    const member = conversation.group_info?.member_avatars?.find(m => m.id === message.sender_id)
    const senderName = member?.nickname || '成员'
    prefix = `${senderName}: `
  }

  let content = ''
  switch (message.type) {
    case 'text':
      content = message.content
      break
    case 'image':
      content = '[图片]'
      break
    case 'voice':
      content = '[语音]'
      break
    case 'video':
      content = '[视频]'
      break
    case 'file':
      content = '[文件]'
      break
    case 'system':
      content = message.content
      break
    default:
      content = message.content
  }

  return prefix + content
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

/* 群聊头像组合 */
.group-avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 8rpx;
  margin-right: 24rpx;
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  background-color: #e0e0e0;
  overflow: hidden;
}

.group-avatar-item {
  object-fit: cover;
}

/* 1个成员 */
.group-avatar-item.count-1 {
  width: 96rpx;
  height: 96rpx;
}

/* 2个成员 */
.group-avatar-item.count-2 {
  width: 48rpx;
  height: 96rpx;
}

/* 3个成员 */
.group-avatar-item.count-3 {
  width: 48rpx;
  height: 48rpx;
}

.group-avatar-item.count-3:first-child {
  width: 96rpx;
  height: 48rpx;
}

/* 4个成员 */
.group-avatar-item.count-4 {
  width: 48rpx;
  height: 48rpx;
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
