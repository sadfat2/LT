<template>
  <!-- 通话中界面 -->
  <view v-if="visible" class="call-screen">
    <view class="call-screen-bg" />

    <view class="call-screen-content">
      <!-- 顶部状态 -->
      <view class="top-bar">
        <text class="status-text">{{ statusText }}</text>
        <text v-if="isConnected" class="duration">{{ callStore.formattedDuration }}</text>
      </view>

      <!-- 对方信息 -->
      <view class="peer-info">
        <image
          class="avatar"
          :src="peerInfo?.avatar || '/static/default-avatar.png'"
          mode="aspectFill"
        />
        <text class="nickname">{{ peerInfo?.nickname || '未知用户' }}</text>
      </view>

      <!-- 底部操作栏 -->
      <view class="bottom-bar">
        <!-- 静音按钮 -->
        <view class="action-btn" :class="{ active: callStore.isMuted }" @tap="handleToggleMute">
          <view class="btn-icon">
            <text class="iconfont">{{ callStore.isMuted ? '🔇' : '🎤' }}</text>
          </view>
          <text class="btn-label">{{ callStore.isMuted ? '已静音' : '静音' }}</text>
        </view>

        <!-- 挂断按钮 -->
        <view class="action-btn hangup" @tap="handleHangup">
          <view class="btn-icon hangup-icon">
            <text class="iconfont">📞</text>
          </view>
          <text class="btn-label">挂断</text>
        </view>

        <!-- 扬声器按钮 -->
        <view class="action-btn" :class="{ active: callStore.isSpeaker }" @tap="handleToggleSpeaker">
          <view class="btn-icon">
            <text class="iconfont">{{ callStore.isSpeaker ? '🔊' : '🔈' }}</text>
          </view>
          <text class="btn-label">{{ callStore.isSpeaker ? '扬声器' : '听筒' }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCallStore } from '@/store/call'

const callStore = useCallStore()

// 是否显示通话界面
const visible = computed(() => {
  return callStore.status === 'connecting' || callStore.status === 'connected'
})

// 是否已连接
const isConnected = computed(() => callStore.status === 'connected')

// 对方信息
const peerInfo = computed(() => callStore.peerInfo)

// 状态文本
const statusText = computed(() => {
  if (callStore.status === 'connecting') {
    return '正在连接...'
  } else if (callStore.status === 'connected') {
    return '通话中'
  }
  return ''
})

// 切换静音
const handleToggleMute = () => {
  callStore.toggleMute()
}

// 切换扬声器
const handleToggleSpeaker = () => {
  callStore.toggleSpeaker()
}

// 挂断
const handleHangup = () => {
  callStore.endCall()
}
</script>

<style scoped>
.call-screen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
}

.call-screen-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
}

.call-screen-content {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 100rpx 40rpx;
  padding-bottom: env(safe-area-inset-bottom);
}

.top-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
}

.status-text {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.7);
}

.duration {
  font-size: 64rpx;
  font-weight: 300;
  color: #fff;
  font-family: 'SF Mono', 'Monaco', monospace;
  letter-spacing: 4rpx;
}

.peer-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 30rpx;
}

.avatar {
  width: 240rpx;
  height: 240rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(255, 255, 255, 0.2);
}

.nickname {
  font-size: 40rpx;
  font-weight: 500;
  color: #fff;
}

.bottom-bar {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 60rpx 20rpx;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}

.action-btn.active .btn-icon {
  background: rgba(255, 255, 255, 0.3);
}

.btn-icon {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-icon:active {
  transform: scale(0.95);
}

.btn-icon .iconfont {
  font-size: 44rpx;
}

.hangup-icon {
  background: #ff4d4f !important;
  width: 120rpx;
  height: 120rpx;
}

.hangup-icon .iconfont {
  font-size: 52rpx;
  transform: rotate(135deg);
}

.btn-label {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.7);
}

.hangup .btn-label {
  margin-top: 10rpx;
}
</style>
