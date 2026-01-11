<template>
  <!-- 通话中界面 -->
  <view v-if="visible" class="call-screen">
    <!-- 动态背景 -->
    <view class="call-screen-bg">
      <view class="orb orb-1"></view>
      <view class="orb orb-2"></view>
      <view class="orb orb-3"></view>
      <view class="orb orb-4"></view>
    </view>

    <view class="call-screen-content">
      <!-- 顶部状态 -->
      <view class="top-bar">
        <view class="status-badge">
          <view class="status-dot" :class="{ connected: isConnected }"></view>
          <text class="status-text">{{ statusText }}</text>
        </view>
        <text v-if="isConnected" class="duration">{{ callStore.formattedDuration }}</text>
      </view>

      <!-- 对方信息 -->
      <view class="peer-info">
        <view class="avatar-wrapper">
          <view class="avatar-ring" :class="{ active: isConnected }"></view>
          <image
            class="avatar"
            :src="peerInfo?.avatar || '/static/images/default-avatar.svg'"
            mode="aspectFill"
          />
        </view>
        <text class="nickname">{{ peerInfo?.nickname || '未知用户' }}</text>
        <view v-if="isConnected" class="audio-wave">
          <view class="wave-bar"></view>
          <view class="wave-bar"></view>
          <view class="wave-bar"></view>
          <view class="wave-bar"></view>
          <view class="wave-bar"></view>
        </view>
      </view>

      <!-- 底部操作栏 -->
      <view class="bottom-bar">
        <!-- 静音按钮 -->
        <view class="action-btn" :class="{ active: callStore.isMuted }" @tap="handleToggleMute">
          <view class="btn-icon">
            <text>{{ callStore.isMuted ? '🔇' : '🎤' }}</text>
          </view>
          <text class="btn-label">{{ callStore.isMuted ? '已静音' : '静音' }}</text>
        </view>

        <!-- 挂断按钮 -->
        <view class="action-btn hangup" @tap="handleHangup">
          <view class="btn-icon hangup-icon">
            <text>📞</text>
          </view>
          <text class="btn-label">挂断</text>
        </view>

        <!-- 扬声器按钮 -->
        <view class="action-btn" :class="{ active: callStore.isSpeaker }" @tap="handleToggleSpeaker">
          <view class="btn-icon">
            <text>{{ callStore.isSpeaker ? '🔊' : '🔈' }}</text>
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

/* 动态背景 */
.call-screen-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--bg-deep);
  overflow: hidden;
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80rpx);
}

.orb-1 {
  width: 600rpx;
  height: 600rpx;
  background: radial-gradient(circle, rgba(168, 85, 247, 0.35) 0%, transparent 70%);
  top: -200rpx;
  right: -150rpx;
  animation: orbFloat1 10s ease-in-out infinite;
}

.orb-2 {
  width: 500rpx;
  height: 500rpx;
  background: radial-gradient(circle, rgba(236, 72, 153, 0.3) 0%, transparent 70%);
  bottom: 100rpx;
  left: -200rpx;
  animation: orbFloat2 12s ease-in-out infinite;
}

.orb-3 {
  width: 400rpx;
  height: 400rpx;
  background: radial-gradient(circle, rgba(34, 211, 238, 0.25) 0%, transparent 70%);
  top: 35%;
  left: 60%;
  animation: orbFloat3 8s ease-in-out infinite;
}

.orb-4 {
  width: 350rpx;
  height: 350rpx;
  background: radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, transparent 70%);
  bottom: 30%;
  right: -100rpx;
  animation: orbFloat4 15s ease-in-out infinite;
}

@keyframes orbFloat1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(-30rpx, 30rpx) scale(1.1); }
}

@keyframes orbFloat2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(40rpx, -20rpx) scale(0.9); }
}

@keyframes orbFloat3 {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(-20rpx, 40rpx); }
}

@keyframes orbFloat4 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(20rpx, -30rpx) scale(1.15); }
}

/* 内容区 */
.call-screen-content {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 120rpx 40rpx;
  padding-top: calc(120rpx + env(safe-area-inset-top));
  padding-bottom: calc(60rpx + env(safe-area-inset-bottom));
}

/* 顶部状态 */
.top-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 10rpx 24rpx;
  background: var(--bg-glass);
  border: 1rpx solid var(--border-subtle);
  border-radius: var(--radius-full);
}

.status-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: var(--accent-warning);
  animation: dotPulse 1.5s ease-in-out infinite;
}

.status-dot.connected {
  background: var(--accent-success);
}

@keyframes dotPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.status-text {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.duration {
  font-size: 72rpx;
  font-weight: var(--font-light);
  color: var(--text-primary);
  font-family: var(--font-mono);
  letter-spacing: 6rpx;
  text-shadow: 0 0 40rpx rgba(168, 85, 247, 0.3);
}

/* 对方信息 */
.peer-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24rpx;
}

.avatar-wrapper {
  position: relative;
  width: 280rpx;
  height: 280rpx;
}

.avatar-ring {
  position: absolute;
  inset: -20rpx;
  border-radius: 50%;
  border: 3rpx solid var(--border-accent);
  opacity: 0.5;
}

.avatar-ring.active {
  animation: ringPulse 2s ease-in-out infinite;
}

@keyframes ringPulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

.avatar {
  width: 280rpx;
  height: 280rpx;
  border-radius: 50%;
  border: 4rpx solid var(--border-accent);
  box-shadow: 0 0 60rpx rgba(168, 85, 247, 0.3);
}

.nickname {
  font-size: var(--text-2xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  text-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.3);
}

/* 音频波形 */
.audio-wave {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  height: 40rpx;
  margin-top: 16rpx;
}

.wave-bar {
  width: 6rpx;
  background: var(--gradient-primary);
  border-radius: var(--radius-full);
  animation: waveAnim 0.8s ease-in-out infinite;
}

.wave-bar:nth-child(1) {
  height: 16rpx;
  animation-delay: 0s;
}

.wave-bar:nth-child(2) {
  height: 24rpx;
  animation-delay: 0.1s;
}

.wave-bar:nth-child(3) {
  height: 36rpx;
  animation-delay: 0.2s;
}

.wave-bar:nth-child(4) {
  height: 24rpx;
  animation-delay: 0.3s;
}

.wave-bar:nth-child(5) {
  height: 16rpx;
  animation-delay: 0.4s;
}

@keyframes waveAnim {
  0%, 100% {
    transform: scaleY(0.5);
    opacity: 0.5;
  }
  50% {
    transform: scaleY(1);
    opacity: 1;
  }
}

/* 底部操作栏 */
.bottom-bar {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  padding: 40rpx 20rpx;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}

.btn-icon {
  width: 110rpx;
  height: 110rpx;
  border-radius: 50%;
  background: var(--bg-glass);
  border: 1rpx solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-fast);
}

.btn-icon:active {
  transform: scale(0.92);
}

.btn-icon text {
  font-size: 44rpx;
}

.action-btn.active .btn-icon {
  background: var(--gradient-primary);
  border-color: transparent;
  box-shadow: var(--shadow-glow);
}

/* 挂断按钮 */
.hangup-icon {
  width: 140rpx !important;
  height: 140rpx !important;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important;
  border: none !important;
  box-shadow: 0 8rpx 40rpx rgba(239, 68, 68, 0.5);
}

.hangup-icon text {
  font-size: 56rpx !important;
  transform: rotate(135deg);
}

.hangup-icon:active {
  box-shadow: 0 4rpx 20rpx rgba(239, 68, 68, 0.7);
}

.btn-label {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-weight: var(--font-medium);
}

.hangup .btn-label {
  margin-top: 8rpx;
}
</style>
