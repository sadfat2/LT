<template>
  <view class="requests-page">
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
      <text class="nav-title">新的朋友</text>
      <view class="nav-placeholder"></view>
    </view>

    <!-- 请求列表 -->
    <scroll-view class="request-list" scroll-y>
      <view
        v-for="request in requests"
        :key="request.id"
        class="request-item"
      >
        <image
          class="avatar"
          :src="request.avatar || '/static/images/default-avatar.svg'"
          mode="aspectFill"
        />
        <view class="request-info">
          <text class="nickname">{{ request.nickname }}</text>
          <text class="message">{{ request.message || '请求添加你为好友' }}</text>
        </view>
        <view class="request-actions">
          <template v-if="request.status === 'pending'">
            <view class="action-btn accept" @click="handleAccept(request.id)">
              <text>同意</text>
            </view>
            <view class="action-btn reject" @click="handleReject(request.id)">
              <text>拒绝</text>
            </view>
          </template>
          <view v-else-if="request.status === 'accepted'" class="status-badge accepted">
            <text>✓ 已添加</text>
          </view>
          <view v-else-if="request.status === 'rejected'" class="status-badge rejected">
            <text>已拒绝</text>
          </view>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-if="requests.length === 0" class="empty-state">
        <text class="empty-icon">👋</text>
        <text class="empty-text">暂无好友申请</text>
        <text class="empty-hint">新的朋友请求会显示在这里</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useFriendStore } from '../../store/friend'
import type { FriendRequest } from '../../types'

const friendStore = useFriendStore()

const requests = ref<FriendRequest[]>([])

onMounted(() => {
  loadRequests()
})

onShow(() => {
  loadRequests()
})

const loadRequests = async () => {
  await friendStore.fetchRequests()
  requests.value = friendStore.receivedRequests
}

const handleAccept = async (id: number) => {
  await friendStore.acceptRequest(id)
}

const handleReject = async (id: number) => {
  await friendStore.rejectRequest(id)
}

const goBack = () => {
  uni.navigateBack()
}
</script>

<style scoped>
.requests-page {
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
  background: radial-gradient(circle, rgba(245, 158, 11, 0.4) 0%, transparent 70%);
  top: -100rpx;
  left: -100rpx;
}

.orb-2 {
  width: 350rpx;
  height: 350rpx;
  background: radial-gradient(circle, rgba(236, 72, 153, 0.3) 0%, transparent 70%);
  bottom: 200rpx;
  right: -100rpx;
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

/* 请求列表 */
.request-list {
  position: relative;
  z-index: 5;
  height: calc(100vh - 120rpx - env(safe-area-inset-top));
  padding: 24rpx;
}

.request-item {
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

.request-info {
  flex: 1;
  min-width: 0;
}

.nickname {
  display: block;
  font-size: var(--text-lg);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin-bottom: 8rpx;
}

.message {
  display: block;
  font-size: var(--text-sm);
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.request-actions {
  display: flex;
  gap: 12rpx;
  flex-shrink: 0;
}

.action-btn {
  padding: 14rpx 28rpx;
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-fast);
}

.action-btn:active {
  transform: scale(0.95);
}

.action-btn.accept {
  background: var(--gradient-primary);
  color: #fff;
  box-shadow: var(--shadow-glow);
}

.action-btn.reject {
  background: var(--bg-glass);
  border: 1rpx solid var(--border-subtle);
  color: var(--text-secondary);
}

.status-badge {
  padding: 12rpx 24rpx;
  border-radius: var(--radius-lg);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.status-badge.accepted {
  background: rgba(16, 185, 129, 0.15);
  color: var(--accent-success);
}

.status-badge.rejected {
  background: var(--bg-glass);
  color: var(--text-muted);
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
  font-size: 100rpx;
  margin-bottom: 24rpx;
  opacity: 0.4;
}

.empty-text {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  margin-bottom: 8rpx;
}

.empty-hint {
  font-size: var(--text-sm);
  color: var(--text-muted);
}
</style>
