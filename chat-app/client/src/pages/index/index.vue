<template>
  <view class="message-page">
    <!-- 背景装饰 -->
    <view class="bg-decoration">
      <view class="orb orb-1"></view>
      <view class="orb orb-2"></view>
    </view>

    <!-- 页面头部 -->
    <view class="page-header">
      <text class="page-title">消息</text>
      <view class="header-actions">
        <view class="action-btn" @click="refreshData">
          <text class="action-icon">🔄</text>
        </view>
      </view>
    </view>

    <!-- 搜索栏 -->
    <view class="search-section">
      <view class="search-bar" @click="showSearchTip">
        <text class="search-icon">🔍</text>
        <text class="search-placeholder">搜索</text>
      </view>
    </view>

    <!-- 会话列表 -->
    <scroll-view
      scroll-y
      class="conversation-list"
      :refresher-enabled="true"
      :refresher-triggered="refreshing"
      refresher-background="#0a0a0f"
      refresher-default-style="none"
      @refresherrefresh="onRefresh"
      @scrolltolower="onLoadMore"
    >
      <!-- 自定义下拉刷新指示器 -->
      <template #refresher>
        <view class="custom-refresher">
          <view class="refresher-spinner" :class="{ active: refreshing }"></view>
          <text class="refresher-text">{{ refreshing ? '刷新中...' : '下拉刷新' }}</text>
        </view>
      </template>
      <view
        v-for="(conversation, index) in conversations"
        :key="conversation.id"
        class="conversation-item"
        :style="{ animationDelay: `${index * 50}ms` }"
        @click="goChat(conversation)"
        @longpress="showActions(conversation)"
      >
        <!-- 头像区域 -->
        <view class="avatar-wrapper">
          <!-- 群聊头像（九宫格组合） -->
          <view v-if="conversation.type === 'group'" class="group-avatar">
            <image
              v-for="(member, idx) in getGroupAvatars(conversation)"
              :key="idx"
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
          <!-- 在线状态指示 -->
          <view v-if="conversation.type === 'private' && isOnline(conversation.other_user?.id)" class="online-indicator"></view>
        </view>

        <!-- 内容区域 -->
        <view class="conversation-content">
          <view class="content-top">
            <text class="conversation-name">{{ getConversationName(conversation) }}</text>
            <text class="conversation-time">{{ formatTime(conversation.last_message?.created_at) }}</text>
          </view>
          <view class="content-bottom">
            <text class="last-message" :class="{ revoked: conversation.last_message?.status === 'revoked' }">
              {{ getMessagePreview(conversation) }}
            </text>
            <view v-if="conversation.unread_count > 0" class="unread-badge">
              {{ conversation.unread_count > 99 ? '99+' : conversation.unread_count }}
            </view>
          </view>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-if="!loading && conversations.length === 0" class="empty-state">
        <view class="empty-icon">💬</view>
        <text class="empty-title">暂无消息</text>
        <text class="empty-desc">去通讯录添加好友开始聊天吧</text>
      </view>

      <!-- 加载更多 -->
      <view v-if="loading" class="loading-more">
        <view class="loading-spinner"></view>
        <text class="loading-text">加载中...</text>
      </view>
    </scroll-view>

    <!-- 通话组件 -->
    <CallModal />
    <CallScreen />

    <!-- 自定义底部导航 -->
    <CustomTabBar :current="0" />

    <!-- 删除会话确认弹窗 -->
    <ConfirmModal
      v-model:visible="showDeleteModal"
      title="删除会话"
      content="确定删除该会话吗？"
      icon="🗑️"
      type="danger"
      confirmText="删除"
      @confirm="confirmDeleteConversation"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useConversationStore } from '../../store/conversation'
import { useUserStore } from '../../store/user'
import { useFriendStore } from '../../store/friend'
import { useCallStore } from '../../store/call'
import { useSocketStore } from '../../store/socket'
import CustomTabBar from '../../components/CustomTabBar.vue'
import ConfirmModal from '../../components/ConfirmModal.vue'
import type { Conversation, Message } from '../../types'

const conversationStore = useConversationStore()
const userStore = useUserStore()
const friendStore = useFriendStore()
const callStore = useCallStore()
const socketStore = useSocketStore()

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

// 检查用户是否在线
const isOnline = (userId?: number): boolean => {
  if (!userId) return false
  return socketStore.onlineUsers.has(userId)
}

const loading = ref(false)
const refreshing = ref(false)
const conversations = ref<Conversation[]>([])
const showDeleteModal = ref(false)
const conversationToDelete = ref<Conversation | null>(null)

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

const refreshData = async () => {
  await loadConversations()
  uni.showToast({ title: '已刷新', icon: 'none' })
}

const onRefresh = async () => {
  refreshing.value = true
  await loadConversations()
  refreshing.value = false
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
    success: (res) => {
      if (res.tapIndex === 0) {
        conversationToDelete.value = conversation
        showDeleteModal.value = true
      }
    }
  })
}

const confirmDeleteConversation = async () => {
  if (!conversationToDelete.value) return
  try {
    await conversationStore.deleteConversation(conversationToDelete.value.id)
    conversations.value = conversationStore.conversations
  } finally {
    conversationToDelete.value = null
  }
}

const showSearchTip = () => {
  uni.showToast({ title: '搜索功能开发中', icon: 'none' })
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
  background: var(--bg-deep);
  position: relative;
  overflow-x: hidden;
  width: 100%;
  box-sizing: border-box;
}

/* 背景装饰 */
.bg-decoration {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(100rpx);
  opacity: 0.3;
}

.orb-1 {
  width: 400rpx;
  height: 400rpx;
  background: radial-gradient(circle, rgba(168, 85, 247, 0.4) 0%, transparent 70%);
  top: -100rpx;
  right: -100rpx;
}

.orb-2 {
  width: 300rpx;
  height: 300rpx;
  background: radial-gradient(circle, rgba(34, 211, 238, 0.3) 0%, transparent 70%);
  bottom: 200rpx;
  left: -80rpx;
}

/* 页面头部 */
.page-header {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32rpx;
  padding-top: calc(env(safe-area-inset-top) + 20rpx);
  height: calc(120rpx + env(safe-area-inset-top));
}

.page-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  gap: 16rpx;
}

.action-btn {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-glass);
  border: 1rpx solid var(--border-subtle);
  border-radius: var(--radius-lg);
  transition: all var(--duration-fast);
}

.action-btn:active {
  background: var(--bg-glass-active);
  transform: scale(0.95);
}

.action-icon {
  font-size: 32rpx;
}

/* 搜索栏 */
.search-section {
  position: relative;
  z-index: 10;
  padding: 0 32rpx 20rpx;
}

.search-bar {
  display: flex;
  align-items: center;
  background: var(--bg-glass);
  border: 1rpx solid var(--border-subtle);
  border-radius: var(--radius-xl);
  padding: 0 24rpx;
  height: 80rpx;
}

.search-icon {
  font-size: 28rpx;
  margin-right: 16rpx;
  opacity: 0.5;
}

.search-placeholder {
  flex: 1;
  font-size: var(--text-base);
  color: var(--text-muted);
}

/* 会话列表 */
.conversation-list {
  position: relative;
  z-index: 5;
  height: calc(100vh - 280rpx - env(safe-area-inset-top) - 110rpx - env(safe-area-inset-bottom));
  padding: 0 32rpx;
  padding-bottom: 20rpx;
  box-sizing: border-box;
  width: 100%;
}

/* 自定义下拉刷新指示器 */
.custom-refresher {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32rpx 0;
  background: transparent;
}

.refresher-spinner {
  width: 48rpx;
  height: 48rpx;
  border: 4rpx solid var(--border-subtle);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  margin-bottom: 16rpx;
  transition: transform 0.3s ease;
}

.refresher-spinner.active {
  animation: refreshSpin 0.8s linear infinite;
}

@keyframes refreshSpin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.refresher-text {
  font-size: var(--text-xs);
  color: var(--text-muted);
  letter-spacing: 1rpx;
}

.conversation-item {
  display: flex;
  align-items: center;
  padding: 20rpx 24rpx;
  margin-bottom: 12rpx;
  background: var(--bg-glass);
  border: 1rpx solid var(--border-subtle);
  border-radius: var(--radius-xl);
  transition: all var(--duration-fast) var(--ease-out);
  animation: fadeInUp 0.4s var(--ease-out) backwards;
  box-sizing: border-box;
  width: 100%;
  overflow: hidden;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.conversation-item:active {
  background: var(--bg-glass-active);
  transform: scale(0.98);
}

/* 头像区域 */
.avatar-wrapper {
  position: relative;
  margin-right: 20rpx;
  flex-shrink: 0;
}

.avatar {
  width: 100rpx;
  height: 100rpx;
  border-radius: var(--radius-xl);
  border: 2rpx solid var(--border-subtle);
}

/* 群聊头像组合 */
.group-avatar {
  width: 100rpx;
  height: 100rpx;
  border-radius: var(--radius-xl);
  display: flex;
  flex-wrap: wrap;
  background: var(--bg-elevated);
  overflow: hidden;
  border: 2rpx solid var(--border-subtle);
}

.group-avatar-item {
  object-fit: cover;
}

/* 1个成员 */
.group-avatar-item.count-1 {
  width: 100rpx;
  height: 100rpx;
}

/* 2个成员 */
.group-avatar-item.count-2 {
  width: 50rpx;
  height: 100rpx;
}

/* 3个成员 */
.group-avatar-item.count-3 {
  width: 50rpx;
  height: 50rpx;
}

.group-avatar-item.count-3:first-child {
  width: 100rpx;
  height: 50rpx;
}

/* 4个成员 */
.group-avatar-item.count-4 {
  width: 50rpx;
  height: 50rpx;
}

/* 在线状态 */
.online-indicator {
  position: absolute;
  bottom: 4rpx;
  right: 4rpx;
  width: 20rpx;
  height: 20rpx;
  background: var(--accent-success);
  border: 3rpx solid var(--bg-deep);
  border-radius: 50%;
  box-shadow: 0 0 8rpx rgba(16, 185, 129, 0.5);
}

/* 内容区域 */
.conversation-content {
  flex: 1;
  overflow: hidden;
}

.content-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10rpx;
}

.conversation-name {
  font-size: var(--text-md);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 400rpx;
}

.conversation-time {
  font-size: var(--text-xs);
  color: var(--text-muted);
  flex-shrink: 0;
}

.content-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.last-message {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.last-message.revoked {
  color: var(--text-muted);
  font-style: italic;
}

/* 未读徽章 */
.unread-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 36rpx;
  height: 36rpx;
  padding: 0 10rpx;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  background: var(--gradient-primary);
  border-radius: var(--radius-full);
  box-shadow: 0 0 12rpx rgba(168, 85, 247, 0.4);
  flex-shrink: 0;
  margin-left: 12rpx;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 40rpx;
}

.empty-icon {
  font-size: 120rpx;
  margin-bottom: 32rpx;
  opacity: 0.3;
}

.empty-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  margin-bottom: 12rpx;
}

.empty-desc {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

/* 加载更多 */
.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  gap: 12rpx;
}

.loading-spinner {
  width: 32rpx;
  height: 32rpx;
  border: 3rpx solid var(--border-subtle);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: var(--text-sm);
  color: var(--text-muted);
}
</style>
