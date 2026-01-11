<template>
  <view class="contacts-page">
    <!-- 背景装饰 -->
    <view class="bg-decoration">
      <view class="orb orb-1"></view>
      <view class="orb orb-2"></view>
    </view>

    <!-- 页面头部 -->
    <view class="page-header">
      <text class="page-title">通讯录</text>
    </view>

    <!-- 功能入口 -->
    <view class="function-section">
      <view class="function-item" @click="goAddFriend">
        <view class="function-icon add">
          <text>➕</text>
        </view>
        <view class="function-content">
          <text class="function-name">添加好友</text>
          <text class="function-desc">搜索并添加新朋友</text>
        </view>
        <text class="function-arrow">›</text>
      </view>

      <view class="function-item" @click="goFriendRequests">
        <view class="function-icon request">
          <text>👋</text>
        </view>
        <view class="function-content">
          <text class="function-name">新的朋友</text>
          <text class="function-desc">查看好友申请</text>
        </view>
        <view v-if="pendingCount > 0" class="function-badge">
          {{ pendingCount > 99 ? '99+' : pendingCount }}
        </view>
        <text v-else class="function-arrow">›</text>
      </view>

      <view class="function-item" @click="goCreateGroup">
        <view class="function-icon group">
          <text>👥</text>
        </view>
        <view class="function-content">
          <text class="function-name">发起群聊</text>
          <text class="function-desc">创建一个新群组</text>
        </view>
        <text class="function-arrow">›</text>
      </view>
    </view>

    <!-- 好友列表标题 -->
    <view class="section-header">
      <text class="section-title">我的好友</text>
      <text class="section-count">{{ Object.values(groupedFriends).flat().length }} 人</text>
    </view>

    <!-- 好友列表 -->
    <scroll-view scroll-y class="friend-list">
      <template v-for="(friends, letter) in groupedFriends" :key="letter">
        <view class="letter-header" :id="`letter-${letter}`">
          <text class="letter-text">{{ letter }}</text>
        </view>
        <view
          v-for="friend in friends"
          :key="friend.id"
          class="friend-item"
          @click="goUserInfo(friend)"
        >
          <view class="friend-avatar-wrapper">
            <image
              class="friend-avatar"
              :src="friend.avatar || '/static/images/default-avatar.svg'"
              mode="aspectFill"
            />
          </view>
          <view class="friend-info">
            <text class="friend-name">{{ friend.remark || friend.nickname }}</text>
            <text v-if="friend.signature" class="friend-signature">{{ friend.signature }}</text>
          </view>
        </view>
      </template>

      <!-- 空状态 -->
      <view v-if="!loading && Object.keys(groupedFriends).length === 0" class="empty-state">
        <view class="empty-icon">👤</view>
        <text class="empty-title">暂无好友</text>
        <text class="empty-desc">点击上方添加好友开始聊天</text>
      </view>
    </scroll-view>

    <!-- 字母索引 -->
    <view class="letter-index" v-if="letters.length > 0">
      <text
        v-for="letter in letters"
        :key="letter"
        class="index-letter"
        @click="scrollToLetter(letter)"
      >
        {{ letter }}
      </text>
    </view>

    <!-- 自定义底部导航 -->
    <CustomTabBar :current="1" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useFriendStore } from '../../store/friend'
import { useUserStore } from '../../store/user'
import CustomTabBar from '../../components/CustomTabBar.vue'
import type { Friend } from '../../types'

const friendStore = useFriendStore()
const userStore = useUserStore()

const loading = ref(false)

const groupedFriends = computed(() => friendStore.groupedFriends)
const pendingCount = computed(() => friendStore.pendingCount)

const letters = computed(() => {
  const keys = Object.keys(groupedFriends.value).sort()
  return keys.filter(k => /^[A-Z]$/.test(k)).concat(keys.filter(k => k === '#'))
})

onMounted(() => {
  if (!userStore.isLoggedIn) {
    return
  }
  friendStore.initSocketListeners()
})

onShow(() => {
  if (userStore.isLoggedIn) {
    loadData()
  }
})

const loadData = async () => {
  loading.value = true
  try {
    await Promise.all([
      friendStore.fetchFriends(),
      friendStore.fetchPendingCount()
    ])
  } finally {
    loading.value = false
  }
}

const goAddFriend = () => {
  uni.navigateTo({ url: '/pages/add-friend/index' })
}

const goFriendRequests = () => {
  uni.navigateTo({ url: '/pages/friend-requests/index' })
}

const goCreateGroup = () => {
  uni.navigateTo({ url: '/pages/group/create' })
}

const goUserInfo = (friend: Friend) => {
  uni.navigateTo({
    url: `/pages/user-info/index?userId=${friend.id}&isFriend=true`
  })
}

const scrollToLetter = (letter: string) => {
  uni.pageScrollTo({
    selector: `#letter-${letter}`,
    duration: 100
  })
}
</script>

<style scoped>
.contacts-page {
  min-height: 100vh;
  background: var(--bg-deep);
  position: relative;
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
  opacity: 0.25;
}

.orb-1 {
  width: 350rpx;
  height: 350rpx;
  background: radial-gradient(circle, rgba(34, 211, 238, 0.4) 0%, transparent 70%);
  top: 100rpx;
  left: -100rpx;
}

.orb-2 {
  width: 300rpx;
  height: 300rpx;
  background: radial-gradient(circle, rgba(168, 85, 247, 0.3) 0%, transparent 70%);
  bottom: 300rpx;
  right: -80rpx;
}

/* 页面头部 */
.page-header {
  position: relative;
  z-index: 10;
  padding: 0 32rpx;
  padding-top: calc(env(safe-area-inset-top) + 20rpx);
  height: calc(100rpx + env(safe-area-inset-top));
  display: flex;
  align-items: center;
}

.page-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
}

/* 功能入口 */
.function-section {
  position: relative;
  z-index: 5;
  margin: 0 24rpx 32rpx;
  background: var(--gradient-card);
  backdrop-filter: var(--blur-md);
  border: 1rpx solid var(--border-subtle);
  border-radius: var(--radius-2xl);
  overflow: hidden;
}

.function-item {
  display: flex;
  align-items: center;
  padding: 28rpx 24rpx;
  border-bottom: 1rpx solid var(--border-subtle);
  transition: all var(--duration-fast);
}

.function-item:last-child {
  border-bottom: none;
}

.function-item:active {
  background: var(--bg-glass-active);
}

.function-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  margin-right: 20rpx;
}

.function-icon.add {
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(236, 72, 153, 0.2) 100%);
}

.function-icon.request {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(236, 72, 153, 0.2) 100%);
}

.function-icon.group {
  background: linear-gradient(135deg, rgba(34, 211, 238, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%);
}

.function-content {
  flex: 1;
}

.function-name {
  display: block;
  font-size: var(--text-md);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin-bottom: 4rpx;
}

.function-desc {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.function-arrow {
  font-size: var(--text-xl);
  color: var(--text-muted);
}

.function-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 40rpx;
  height: 40rpx;
  padding: 0 12rpx;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  background: var(--gradient-primary);
  border-radius: var(--radius-full);
  box-shadow: 0 0 12rpx rgba(168, 85, 247, 0.4);
}

/* 好友列表标题 */
.section-header {
  position: relative;
  z-index: 5;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 32rpx;
  margin-bottom: 16rpx;
}

.section-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.section-count {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

/* 好友列表 */
.friend-list {
  position: relative;
  z-index: 5;
  height: calc(100vh - 500rpx - env(safe-area-inset-top) - 110rpx - env(safe-area-inset-bottom));
  padding: 0 24rpx;
  padding-bottom: 20rpx;
}

.letter-header {
  padding: 16rpx 12rpx;
}

.letter-text {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--accent-primary);
}

.friend-item {
  display: flex;
  align-items: center;
  padding: 16rpx 20rpx;
  margin-bottom: 8rpx;
  background: var(--bg-glass);
  border: 1rpx solid var(--border-subtle);
  border-radius: var(--radius-xl);
  transition: all var(--duration-fast);
}

.friend-item:active {
  background: var(--bg-glass-active);
  transform: scale(0.98);
}

.friend-avatar-wrapper {
  margin-right: 16rpx;
}

.friend-avatar {
  width: 88rpx;
  height: 88rpx;
  border-radius: var(--radius-lg);
  border: 2rpx solid var(--border-subtle);
}

.friend-info {
  flex: 1;
  overflow: hidden;
}

.friend-name {
  display: block;
  font-size: var(--text-md);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin-bottom: 4rpx;
}

.friend-signature {
  display: block;
  font-size: var(--text-xs);
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 字母索引 */
.letter-index {
  position: fixed;
  right: 8rpx;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12rpx 8rpx;
  background: var(--bg-glass);
  backdrop-filter: var(--blur-sm);
  border-radius: var(--radius-full);
  z-index: 100;
}

.index-letter {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-tertiary);
  padding: 6rpx 0;
  transition: color var(--duration-fast);
}

.index-letter:active {
  color: var(--accent-primary);
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100rpx 40rpx;
}

.empty-icon {
  font-size: 100rpx;
  margin-bottom: 24rpx;
  opacity: 0.3;
}

.empty-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  margin-bottom: 8rpx;
}

.empty-desc {
  font-size: var(--text-sm);
  color: var(--text-muted);
}
</style>
