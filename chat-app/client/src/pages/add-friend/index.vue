<template>
  <view class="add-friend-page">
    <!-- 背景装饰 -->
    <view class="bg-decoration">
      <view class="orb orb-1"></view>
      <view class="orb orb-2"></view>
    </view>

    <!-- 导航栏 -->
    <view class="nav-header">
      <view class="nav-back" @click="goBack">
        <text class="back-icon">‹</text>
      </view>
      <text class="nav-title">添加好友</text>
      <view class="nav-placeholder"></view>
    </view>

    <!-- 搜索框 -->
    <view class="search-section">
      <view class="search-card">
        <view class="search-icon">🔍</view>
        <input
          v-model="keyword"
          class="search-input"
          type="text"
          placeholder="输入账号搜索"
          placeholder-class="placeholder"
          confirm-type="search"
          @confirm="handleSearch"
        />
        <view v-if="keyword" class="clear-btn" @click="keyword = ''">
          <text>×</text>
        </view>
      </view>
      <view class="search-btn" @click="handleSearch">
        <text>搜索</text>
      </view>
    </view>

    <!-- 搜索结果 -->
    <scroll-view class="result-list" scroll-y>
      <view
        v-for="user in searchResults"
        :key="user.id"
        class="user-item"
      >
        <image
          class="avatar"
          :src="user.avatar || '/static/images/default-avatar.svg'"
          mode="aspectFill"
        />
        <view class="user-info">
          <text class="nickname">{{ user.nickname }}</text>
          <text class="account">账号: {{ user.account }}</text>
        </view>
        <view
          class="add-btn"
          :class="{ loading: addingId === user.id }"
          @click="handleAdd(user)"
        >
          <text v-if="addingId === user.id">发送中</text>
          <text v-else>+ 添加</text>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-if="searched && searchResults.length === 0" class="empty-state">
        <text class="empty-icon">🔍</text>
        <text class="empty-text">未找到相关用户</text>
        <text class="empty-hint">请尝试其他账号</text>
      </view>

      <!-- 初始提示 -->
      <view v-if="!searched" class="hint-state">
        <text class="hint-icon">👋</text>
        <text class="hint-text">搜索用户账号</text>
        <text class="hint-desc">输入好友的账号进行搜索</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { userApi } from '../../api'
import { useFriendStore } from '../../store/friend'
import type { User } from '../../types'

const friendStore = useFriendStore()

const keyword = ref('')
const searchResults = ref<User[]>([])
const searched = ref(false)
const addingId = ref<number | null>(null)

const handleSearch = async () => {
  if (!keyword.value.trim()) {
    uni.showToast({ title: '请输入搜索内容', icon: 'none' })
    return
  }

  try {
    const res = await userApi.search(keyword.value.trim())
    searchResults.value = res.data
    searched.value = true
  } catch (error) {
    console.error('搜索失败', error)
  }
}

const handleAdd = async (user: User) => {
  addingId.value = user.id

  try {
    await friendStore.sendRequest(user.id)
  } catch (error) {
    console.error('发送申请失败', error)
  } finally {
    addingId.value = null
  }
}

const goBack = () => {
  uni.navigateBack()
}
</script>

<style scoped>
.add-friend-page {
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
  width: 400rpx;
  height: 400rpx;
  background: radial-gradient(circle, rgba(168, 85, 247, 0.4) 0%, transparent 70%);
  top: -100rpx;
  right: -100rpx;
}

.orb-2 {
  width: 350rpx;
  height: 350rpx;
  background: radial-gradient(circle, rgba(236, 72, 153, 0.3) 0%, transparent 70%);
  bottom: 300rpx;
  left: -100rpx;
}

/* 导航头部 */
.nav-header {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 24rpx;
  padding-top: calc(20rpx + env(safe-area-inset-top));
  background: var(--gradient-card);
  backdrop-filter: var(--blur-lg);
  border-bottom: 1rpx solid var(--border-subtle);
}

.nav-back {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-glass);
  border: 1rpx solid var(--border-subtle);
  border-radius: var(--radius-lg);
}

.back-icon {
  font-size: 48rpx;
  color: var(--text-primary);
}

.nav-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.nav-placeholder {
  width: 72rpx;
}

/* 搜索区域 */
.search-section {
  position: relative;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx;
}

.search-card {
  flex: 1;
  display: flex;
  align-items: center;
  background: var(--bg-glass);
  border: 1rpx solid var(--border-subtle);
  border-radius: var(--radius-xl);
  padding: 0 24rpx;
  transition: all var(--duration-fast);
}

.search-card:focus-within {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 4rpx rgba(168, 85, 247, 0.15);
}

.search-icon {
  font-size: 32rpx;
  margin-right: 16rpx;
  opacity: 0.6;
}

.search-input {
  flex: 1;
  height: 80rpx;
  font-size: var(--text-md);
  color: var(--text-primary);
  background: transparent;
}

.placeholder {
  color: var(--text-muted);
}

.clear-btn {
  width: 44rpx;
  height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  color: var(--text-muted);
}

.search-btn {
  padding: 20rpx 32rpx;
  background: var(--gradient-primary);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: #fff;
  box-shadow: var(--shadow-glow);
  transition: all var(--duration-fast);
}

.search-btn:active {
  transform: scale(0.95);
}

/* 结果列表 */
.result-list {
  position: relative;
  z-index: 5;
  height: calc(100vh - 280rpx - env(safe-area-inset-top));
  padding: 0 24rpx;
}

.user-item {
  display: flex;
  align-items: center;
  padding: 24rpx;
  margin-bottom: 16rpx;
  background: var(--gradient-card);
  backdrop-filter: var(--blur-md);
  border: 1rpx solid var(--border-subtle);
  border-radius: var(--radius-xl);
  animation: fadeInUp 0.3s ease-out;
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

.avatar {
  width: 100rpx;
  height: 100rpx;
  border-radius: var(--radius-xl);
  margin-right: 24rpx;
  border: 2rpx solid var(--border-subtle);
}

.user-info {
  flex: 1;
}

.nickname {
  display: block;
  font-size: var(--text-lg);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin-bottom: 8rpx;
}

.account {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.add-btn {
  padding: 16rpx 32rpx;
  background: var(--gradient-primary);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: #fff;
  box-shadow: var(--shadow-glow);
  transition: all var(--duration-fast);
}

.add-btn:active {
  transform: scale(0.95);
}

.add-btn.loading {
  background: var(--bg-glass);
  color: var(--text-muted);
  box-shadow: none;
}

/* 空状态 */
.empty-state,
.hint-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 40rpx;
}

.empty-icon,
.hint-icon {
  font-size: 100rpx;
  margin-bottom: 24rpx;
  opacity: 0.4;
}

.empty-text,
.hint-text {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  margin-bottom: 8rpx;
}

.empty-hint,
.hint-desc {
  font-size: var(--text-sm);
  color: var(--text-muted);
}
</style>
