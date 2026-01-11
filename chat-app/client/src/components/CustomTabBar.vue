<template>
  <view class="custom-tabbar">
    <view class="tabbar-bg"></view>
    <view class="tabbar-content">
      <view
        v-for="(item, index) in tabList"
        :key="index"
        class="tab-item"
        :class="{ active: props.current === index }"
        @click="switchTab(index)"
      >
        <view class="tab-icon-wrapper">
          <view class="tab-icon">
            <text>{{ item.icon }}</text>
          </view>
          <view v-if="index === 0 && unreadCount > 0" class="tab-badge">
            {{ unreadCount > 99 ? '99+' : unreadCount }}
          </view>
          <view v-if="index === 1 && pendingCount > 0" class="tab-badge small">
            {{ pendingCount > 9 ? '9+' : pendingCount }}
          </view>
        </view>
        <text class="tab-text">{{ item.text }}</text>
        <view v-if="props.current === index" class="tab-indicator"></view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useConversationStore } from '../store/conversation'
import { useFriendStore } from '../store/friend'

const props = withDefaults(defineProps<{
  current: number
}>(), {
  current: 0
})

const conversationStore = useConversationStore()
const friendStore = useFriendStore()

const tabList = [
  { text: '消息', icon: '💬', path: '/pages/index/index' },
  { text: '通讯录', icon: '👥', path: '/pages/contacts/index' },
  { text: '我', icon: '👤', path: '/pages/profile/index' }
]

// 未读消息数
const unreadCount = computed(() => {
  return conversationStore.conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0)
})

// 待处理好友请求数
const pendingCount = computed(() => friendStore.pendingCount)

const switchTab = (index: number) => {
  if (props.current === index) return

  uni.switchTab({
    url: tabList[index].path
  })
}
</script>

<style scoped>
.custom-tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 999;
  padding-bottom: env(safe-area-inset-bottom);
}

.tabbar-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(10, 10, 15, 0.85) 0%,
    rgba(10, 10, 15, 0.95) 100%
  );
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1rpx solid rgba(255, 255, 255, 0.08);
}

.tabbar-content {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-around;
  height: 110rpx;
  padding: 0 20rpx;
}

.tab-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 100%;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.tab-item:active {
  transform: scale(0.95);
}

.tab-icon-wrapper {
  position: relative;
  margin-bottom: 6rpx;
}

.tab-icon {
  font-size: 44rpx;
  line-height: 1;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  filter: grayscale(80%) brightness(0.6);
}

.tab-item.active .tab-icon {
  filter: grayscale(0%) brightness(1);
  transform: scale(1.1);
}

.tab-badge {
  position: absolute;
  top: -10rpx;
  right: -20rpx;
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 8rpx;
  background: linear-gradient(135deg, #ec4899 0%, #a855f7 100%);
  border-radius: 32rpx;
  font-size: 20rpx;
  font-weight: 600;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 12rpx rgba(236, 72, 153, 0.5);
}

.tab-badge.small {
  min-width: 28rpx;
  height: 28rpx;
  font-size: 18rpx;
  right: -16rpx;
}

.tab-text {
  font-size: 22rpx;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.4);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.tab-item.active .tab-text {
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 0 20rpx rgba(168, 85, 247, 0.5);
}

.tab-indicator {
  position: absolute;
  bottom: 8rpx;
  width: 40rpx;
  height: 6rpx;
  background: linear-gradient(90deg, #a855f7 0%, #ec4899 100%);
  border-radius: 6rpx;
  box-shadow: 0 0 16rpx rgba(168, 85, 247, 0.6);
  animation: indicatorPulse 2s ease-in-out infinite;
}

@keyframes indicatorPulse {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 16rpx rgba(168, 85, 247, 0.6);
  }
  50% {
    opacity: 0.8;
    box-shadow: 0 0 24rpx rgba(168, 85, 247, 0.8);
  }
}
</style>
