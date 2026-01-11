<template>
  <view class="user-info-page">
    <!-- 背景装饰 -->
    <view class="bg-decoration">
      <view class="orb orb-1"></view>
      <view class="orb orb-2"></view>
      <view class="orb orb-3"></view>
    </view>

    <!-- 导航栏 -->
    <view class="nav-header">
      <view class="nav-back" @click="goBack">
        <text class="back-icon">‹</text>
      </view>
      <text class="nav-title">用户资料</text>
      <view class="nav-placeholder"></view>
    </view>

    <!-- 用户信息卡片 -->
    <view class="user-card">
      <view class="card-bg"></view>
      <view class="card-content">
        <view class="avatar-section">
          <view class="avatar-glow"></view>
          <image
            class="avatar"
            :src="user?.avatar || '/static/images/default-avatar.svg'"
            mode="aspectFill"
          />
        </view>
        <view class="info-section">
          <text class="nickname">{{ user?.nickname }}</text>
          <view v-if="friendInfo?.remark" class="remark-badge">
            <text>备注: {{ friendInfo.remark }}</text>
          </view>
          <view class="account-row">
            <text class="account-label">账号</text>
            <text class="account-value">{{ user?.account }}</text>
          </view>
          <text v-if="user?.signature" class="signature">{{ user.signature }}</text>
        </view>
      </view>
    </view>

    <!-- 好友设置区域 -->
    <view v-if="isFriend" class="section">
      <view class="section-title">
        <text>好友设置</text>
      </view>
      <view class="section-card">
        <view class="setting-item" @click="editRemark">
          <view class="setting-left">
            <text class="setting-icon">✏️</text>
            <text class="setting-label">设置备注</text>
          </view>
          <view class="setting-right">
            <text class="setting-value">{{ friendInfo?.remark || '未设置' }}</text>
            <text class="setting-arrow">›</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view class="actions-section">
      <view
        v-if="isFriend"
        class="action-btn primary"
        @click="goChat"
      >
        <text class="action-icon">💬</text>
        <text class="action-text">发消息</text>
      </view>
      <view
        v-else
        class="action-btn primary"
        :class="{ loading: adding }"
        @click="handleAdd"
      >
        <text class="action-icon">{{ adding ? '⏳' : '➕' }}</text>
        <text class="action-text">{{ adding ? '发送中...' : '添加好友' }}</text>
      </view>
    </view>

    <!-- 设置备注弹窗 -->
    <InputModal
      v-model:visible="showRemarkModal"
      title="设置备注"
      :value="friendInfo?.remark || ''"
      placeholder="请输入备注名称"
      :maxlength="20"
      @confirm="handleRemarkConfirm"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { userApi } from '../../api'
import { useFriendStore } from '../../store/friend'
import { useConversationStore } from '../../store/conversation'
import InputModal from '../../components/InputModal.vue'
import type { User } from '../../types'

const friendStore = useFriendStore()
const conversationStore = useConversationStore()

const userId = ref<number>(0)
const isFriend = ref(false)
const user = ref<User | null>(null)
const adding = ref(false)
const showRemarkModal = ref(false)

// 获取好友信息（包含备注）
const friendInfo = computed(() => {
  return friendStore.friends.find(f => f.id === userId.value)
})

onLoad((options) => {
  if (options?.userId) {
    userId.value = parseInt(options.userId)
  }
  if (options?.isFriend === 'true') {
    isFriend.value = true
  }
})

onMounted(async () => {
  // 从好友列表中获取用户信息
  const friend = friendStore.friends.find(f => f.id === userId.value)
  if (friend) {
    user.value = friend
  } else {
    // 搜索用户
    try {
      const res = await userApi.search(String(userId.value))
      if (res.data.length > 0) {
        user.value = res.data[0]
      }
    } catch (error) {
      console.error('获取用户信息失败', error)
    }
  }
})

const goChat = async () => {
  if (!user.value) return

  // 导航时使用备注名（如果有）
  const displayName = friendInfo.value?.remark || user.value.nickname
  const conversationId = await conversationStore.createPrivate(userId.value)
  uni.navigateTo({
    url: `/pages/chat/index?conversationId=${conversationId}&userId=${userId.value}&nickname=${encodeURIComponent(displayName)}&avatar=${encodeURIComponent(user.value.avatar || '')}`
  })
}

const handleAdd = async () => {
  adding.value = true
  try {
    await friendStore.sendRequest(userId.value)
  } finally {
    adding.value = false
  }
}

// 编辑备注
const editRemark = () => {
  showRemarkModal.value = true
}

const handleRemarkConfirm = async (value: string) => {
  try {
    await friendStore.updateRemark(userId.value, value)
    uni.showToast({ title: '备注已更新', icon: 'success' })
  } catch (error) {
    console.error('更新备注失败', error)
    uni.showToast({ title: '更新失败', icon: 'none' })
  }
}

const goBack = () => {
  uni.navigateBack()
}
</script>

<style scoped>
.user-info-page {
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
}

.orb-1 {
  width: 500rpx;
  height: 500rpx;
  background: radial-gradient(circle, rgba(168, 85, 247, 0.3) 0%, transparent 70%);
  top: -150rpx;
  left: 50%;
  transform: translateX(-50%);
  opacity: 0.5;
}

.orb-2 {
  width: 300rpx;
  height: 300rpx;
  background: radial-gradient(circle, rgba(236, 72, 153, 0.25) 0%, transparent 70%);
  top: 400rpx;
  right: -100rpx;
  opacity: 0.4;
}

.orb-3 {
  width: 250rpx;
  height: 250rpx;
  background: radial-gradient(circle, rgba(34, 211, 238, 0.2) 0%, transparent 70%);
  bottom: 200rpx;
  left: -80rpx;
  opacity: 0.4;
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

/* 用户卡片 */
.user-card {
  position: relative;
  z-index: 5;
  margin: 24rpx;
  border-radius: var(--radius-2xl);
  overflow: hidden;
}

.card-bg {
  position: absolute;
  inset: 0;
  background: var(--gradient-primary);
  opacity: 0.15;
}

.card-content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48rpx 32rpx;
  background: var(--gradient-card);
  backdrop-filter: var(--blur-lg);
  border: 1rpx solid var(--border-subtle);
  border-radius: var(--radius-2xl);
}

.avatar-section {
  position: relative;
  margin-bottom: 24rpx;
}

.avatar-glow {
  position: absolute;
  inset: -20rpx;
  background: var(--gradient-primary);
  border-radius: 50%;
  filter: blur(30rpx);
  opacity: 0.4;
}

.avatar {
  position: relative;
  width: 180rpx;
  height: 180rpx;
  border-radius: var(--radius-2xl);
  border: 4rpx solid var(--border-accent);
  box-shadow: 0 0 40rpx rgba(168, 85, 247, 0.3);
}

.info-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.nickname {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin-bottom: 12rpx;
}

.remark-badge {
  padding: 8rpx 20rpx;
  background: rgba(168, 85, 247, 0.2);
  border-radius: var(--radius-full);
  margin-bottom: 16rpx;
}

.remark-badge text {
  font-size: var(--text-xs);
  color: var(--accent-primary);
}

.account-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.account-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
  padding: 4rpx 12rpx;
  background: var(--bg-glass);
  border-radius: var(--radius-sm);
}

.account-value {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-family: var(--font-mono);
}

.signature {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  max-width: 500rpx;
  text-align: center;
  line-height: 1.5;
}

/* 区块 */
.section {
  position: relative;
  z-index: 5;
  margin: 0 24rpx 24rpx;
}

.section-title {
  padding: 0 12rpx 16rpx;
}

.section-title text {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 2rpx;
}

.section-card {
  background: var(--gradient-card);
  backdrop-filter: var(--blur-md);
  border: 1rpx solid var(--border-subtle);
  border-radius: var(--radius-xl);
  overflow: hidden;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 24rpx;
  transition: all var(--duration-fast);
}

.setting-item:active {
  background: var(--bg-glass-active);
}

.setting-left {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.setting-icon {
  font-size: 32rpx;
}

.setting-label {
  font-size: var(--text-md);
  color: var(--text-primary);
}

.setting-right {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.setting-value {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.setting-arrow {
  font-size: var(--text-lg);
  color: var(--text-muted);
}

/* 操作按钮 */
.actions-section {
  position: relative;
  z-index: 5;
  padding: 32rpx 48rpx;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  height: 100rpx;
  border-radius: var(--radius-xl);
  transition: all var(--duration-fast);
}

.action-btn:active {
  transform: scale(0.98);
}

.action-btn.primary {
  background: var(--gradient-primary);
  box-shadow: var(--shadow-glow);
}

.action-btn.primary.loading {
  background: var(--bg-glass);
  box-shadow: none;
}

.action-icon {
  font-size: 36rpx;
}

.action-text {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: #fff;
}

.action-btn.loading .action-text {
  color: var(--text-muted);
}
</style>
