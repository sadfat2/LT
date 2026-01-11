<template>
  <view class="create-page">
    <!-- 背景装饰 -->
    <view class="bg-decoration">
      <view class="orb orb-1"></view>
      <view class="orb orb-2"></view>
    </view>

    <!-- 头部导航 -->
    <view class="nav-header">
      <view class="nav-back" @click="goBack">
        <text class="back-icon">‹</text>
      </view>
      <text class="nav-title">发起群聊</text>
      <view class="nav-action" :class="{ disabled: !canCreate }" @click="createGroup">
        <text>确定{{ selectedCount > 0 ? `(${selectedCount})` : '' }}</text>
      </view>
    </view>

    <!-- 群名称输入 -->
    <view class="input-section">
      <view class="input-card">
        <view class="input-icon">👥</view>
        <input
          v-model="groupName"
          class="group-input"
          placeholder="请输入群名称"
          placeholder-class="placeholder"
          maxlength="20"
        />
      </view>
    </view>

    <!-- 选择好友 -->
    <view class="section-header">
      <text class="section-title">选择好友</text>
      <text class="section-count">{{ selectedCount }} / {{ friends.length }}</text>
    </view>

    <!-- 好友列表 -->
    <scroll-view class="friend-list" scroll-y>
      <view
        v-for="friend in friends"
        :key="friend.id"
        class="friend-item"
        @click="toggleSelect(friend)"
      >
        <view class="checkbox" :class="{ checked: isSelected(friend.id) }">
          <text v-if="isSelected(friend.id)" class="check-icon">✓</text>
        </view>
        <image class="avatar" :src="friend.avatar || '/static/images/default-avatar.svg'" mode="aspectFill" />
        <view class="friend-info">
          <text class="nickname">{{ friend.remark || friend.nickname || friend.account }}</text>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-if="friends.length === 0" class="empty-state">
        <text class="empty-icon">👤</text>
        <text class="empty-text">暂无好友</text>
        <text class="empty-hint">先添加好友再创建群聊</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useFriendStore } from '../../store/friend'
import { useGroupStore } from '../../store/group'
import type { Friend } from '../../types'

const friendStore = useFriendStore()
const groupStore = useGroupStore()

const groupName = ref('')
const selectedIds = ref<number[]>([])

const friends = computed(() => friendStore.friends)
const selectedCount = computed(() => selectedIds.value.length)
const canCreate = computed(() => groupName.value.trim() && selectedIds.value.length > 0)

onMounted(() => {
  friendStore.fetchFriends()
})

const isSelected = (id: number) => selectedIds.value.includes(id)

const toggleSelect = (friend: Friend) => {
  const index = selectedIds.value.indexOf(friend.id)
  if (index === -1) {
    selectedIds.value.push(friend.id)
  } else {
    selectedIds.value.splice(index, 1)
  }
}

const createGroup = async () => {
  if (!canCreate.value) return

  try {
    uni.showLoading({ title: '创建中...' })
    const result = await groupStore.createGroup(groupName.value.trim(), selectedIds.value)
    uni.hideLoading()
    uni.showToast({ title: '创建成功', icon: 'success' })

    // 跳转到群聊页面
    setTimeout(() => {
      uni.redirectTo({
        url: `/pages/chat/index?conversationId=${result.conversationId}&type=group&groupId=${result.groupId}`
      })
    }, 500)
  } catch (error) {
    uni.hideLoading()
    uni.showToast({ title: '创建失败', icon: 'none' })
  }
}

const goBack = () => {
  uni.navigateBack()
}
</script>

<style scoped>
.create-page {
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
  background: radial-gradient(circle, rgba(34, 211, 238, 0.3) 0%, transparent 70%);
  bottom: 200rpx;
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

.nav-action {
  padding: 16rpx 32rpx;
  background: var(--gradient-primary);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: #fff;
  box-shadow: var(--shadow-glow);
  transition: all var(--duration-fast);
}

.nav-action.disabled {
  background: var(--bg-glass);
  color: var(--text-muted);
  box-shadow: none;
}

.nav-action:active:not(.disabled) {
  transform: scale(0.95);
}

/* 输入区域 */
.input-section {
  position: relative;
  z-index: 5;
  padding: 24rpx;
}

.input-card {
  display: flex;
  align-items: center;
  background: var(--gradient-card);
  backdrop-filter: var(--blur-md);
  border: 1rpx solid var(--border-subtle);
  border-radius: var(--radius-xl);
  padding: 24rpx;
}

.input-icon {
  font-size: 40rpx;
  margin-right: 20rpx;
}

.group-input {
  flex: 1;
  font-size: var(--text-md);
  color: var(--text-primary);
  background: transparent;
}

.placeholder {
  color: var(--text-muted);
}

/* 区块头部 */
.section-header {
  position: relative;
  z-index: 5;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 32rpx 16rpx;
}

.section-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 2rpx;
}

.section-count {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* 好友列表 */
.friend-list {
  position: relative;
  z-index: 5;
  height: calc(100vh - 400rpx - env(safe-area-inset-top));
  padding: 0 24rpx;
}

.friend-item {
  display: flex;
  align-items: center;
  padding: 20rpx 24rpx;
  margin-bottom: 12rpx;
  background: var(--bg-glass);
  border: 1rpx solid var(--border-subtle);
  border-radius: var(--radius-xl);
  transition: all var(--duration-fast);
}

.friend-item:active {
  background: var(--bg-glass-active);
  transform: scale(0.98);
}

.checkbox {
  width: 44rpx;
  height: 44rpx;
  border: 2rpx solid var(--border-subtle);
  border-radius: var(--radius-full);
  margin-right: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-fast);
}

.checkbox.checked {
  background: var(--gradient-primary);
  border-color: transparent;
  box-shadow: 0 0 16rpx rgba(168, 85, 247, 0.4);
}

.check-icon {
  color: #fff;
  font-size: 24rpx;
  font-weight: bold;
}

.avatar {
  width: 88rpx;
  height: 88rpx;
  border-radius: var(--radius-lg);
  margin-right: 20rpx;
  border: 2rpx solid var(--border-subtle);
}

.friend-info {
  flex: 1;
}

.nickname {
  font-size: var(--text-md);
  font-weight: var(--font-medium);
  color: var(--text-primary);
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
