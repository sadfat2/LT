<template>
  <!-- 来电/去电弹窗 -->
  <view v-if="visible" class="call-modal">
    <!-- 背景 -->
    <view class="call-modal-bg">
      <view class="orb orb-1"></view>
      <view class="orb orb-2"></view>
      <view class="orb orb-3"></view>
    </view>

    <view class="call-modal-content">
      <!-- 对方头像 -->
      <view class="avatar-wrapper">
        <view class="avatar-glow"></view>
        <image
          class="avatar"
          :src="peerInfo?.avatar || '/static/images/default-avatar.svg'"
          mode="aspectFill"
        />
        <view class="pulse-ring" />
        <view class="pulse-ring pulse-ring-delay" />
        <view class="pulse-ring pulse-ring-delay-2" />
      </view>

      <!-- 对方昵称 -->
      <text class="nickname">{{ peerInfo?.nickname || '未知用户' }}</text>

      <!-- 状态提示 -->
      <text class="status-text">{{ statusText }}</text>

      <!-- 操作按钮 -->
      <view class="actions">
        <!-- 来电：拒绝 + 接听 -->
        <template v-if="isRinging">
          <view class="action-btn reject" @tap="handleReject">
            <view class="btn-icon">
              <text>✕</text>
            </view>
            <text class="btn-label">拒绝</text>
          </view>
          <view class="action-btn accept" @tap="handleAccept">
            <view class="btn-icon">
              <text>📞</text>
            </view>
            <text class="btn-label">接听</text>
          </view>
        </template>

        <!-- 去电：取消 -->
        <template v-else-if="isCalling">
          <view class="action-btn cancel" @tap="handleCancel">
            <view class="btn-icon">
              <text>✕</text>
            </view>
            <text class="btn-label">取消呼叫</text>
          </view>
        </template>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCallStore } from '@/store/call'

const callStore = useCallStore()

// 是否显示弹窗
const visible = computed(() => {
  return callStore.status === 'calling' || callStore.status === 'ringing'
})

// 是否是来电
const isRinging = computed(() => callStore.status === 'ringing')

// 是否是去电
const isCalling = computed(() => callStore.status === 'calling')

// 对方信息
const peerInfo = computed(() => callStore.peerInfo)

// 状态文本
const statusText = computed(() => {
  if (callStore.status === 'calling') {
    return '正在呼叫...'
  } else if (callStore.status === 'ringing') {
    return '邀请您进行语音通话'
  }
  return ''
})

// 接听
const handleAccept = async () => {
  console.log('[CallModal] 点击接听按钮')
  const result = await callStore.acceptCall()
  console.log('[CallModal] 接听结果:', result)
}

// 拒绝
const handleReject = () => {
  console.log('[CallModal] 点击拒绝按钮')
  callStore.rejectCall()
}

// 取消呼叫
const handleCancel = () => {
  callStore.cancelCall()
}
</script>

<style scoped>
.call-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 背景 */
.call-modal-bg {
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
  width: 500rpx;
  height: 500rpx;
  background: radial-gradient(circle, rgba(168, 85, 247, 0.4) 0%, transparent 70%);
  top: -100rpx;
  right: -100rpx;
  animation: float 8s ease-in-out infinite;
}

.orb-2 {
  width: 400rpx;
  height: 400rpx;
  background: radial-gradient(circle, rgba(236, 72, 153, 0.3) 0%, transparent 70%);
  bottom: 200rpx;
  left: -100rpx;
  animation: float 10s ease-in-out infinite reverse;
}

.orb-3 {
  width: 300rpx;
  height: 300rpx;
  background: radial-gradient(circle, rgba(34, 211, 238, 0.25) 0%, transparent 70%);
  top: 40%;
  left: 50%;
  transform: translateX(-50%);
  animation: float 12s ease-in-out infinite;
}

@keyframes float {
  0%, 100% {
    transform: translate(0, 0);
  }
  50% {
    transform: translate(20rpx, -20rpx);
  }
}

/* 内容区 */
.call-modal-content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 40rpx;
  width: 100%;
}

/* 头像区域 */
.avatar-wrapper {
  position: relative;
  width: 220rpx;
  height: 220rpx;
  margin-bottom: 48rpx;
}

.avatar-glow {
  position: absolute;
  inset: -30rpx;
  background: var(--gradient-primary);
  border-radius: 50%;
  filter: blur(40rpx);
  opacity: 0.5;
  animation: glow 3s ease-in-out infinite;
}

@keyframes glow {
  0%, 100% {
    opacity: 0.5;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.1);
  }
}

.avatar {
  position: relative;
  z-index: 2;
  width: 220rpx;
  height: 220rpx;
  border-radius: 50%;
  border: 4rpx solid var(--border-accent);
  box-shadow: 0 0 40rpx rgba(168, 85, 247, 0.3);
}

.pulse-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 220rpx;
  height: 220rpx;
  border-radius: 50%;
  border: 2rpx solid var(--accent-primary);
  animation: pulse 2.5s ease-out infinite;
  z-index: 1;
}

.pulse-ring-delay {
  animation-delay: 0.8s;
}

.pulse-ring-delay-2 {
  animation-delay: 1.6s;
}

@keyframes pulse {
  0% {
    width: 220rpx;
    height: 220rpx;
    opacity: 0.8;
  }
  100% {
    width: 400rpx;
    height: 400rpx;
    opacity: 0;
  }
}

/* 昵称 */
.nickname {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin-bottom: 16rpx;
  text-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.3);
}

/* 状态文本 */
.status-text {
  font-size: var(--text-base);
  color: var(--text-tertiary);
  margin-bottom: 120rpx;
  letter-spacing: 2rpx;
}

/* 操作按钮区域 */
.actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 140rpx;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
}

.btn-icon {
  width: 130rpx;
  height: 130rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-fast);
  box-shadow: var(--shadow-lg);
}

.btn-icon:active {
  transform: scale(0.92);
}

.btn-icon text {
  font-size: 48rpx;
  color: #fff;
}

.btn-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-weight: var(--font-medium);
}

/* 拒绝/取消按钮 */
.reject .btn-icon,
.cancel .btn-icon {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  box-shadow: 0 8rpx 30rpx rgba(239, 68, 68, 0.4);
}

.reject .btn-icon:active,
.cancel .btn-icon:active {
  box-shadow: 0 4rpx 20rpx rgba(239, 68, 68, 0.6);
}

/* 接听按钮 */
.accept .btn-icon {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  box-shadow: 0 8rpx 30rpx rgba(16, 185, 129, 0.4);
  animation: acceptPulse 1.5s ease-in-out infinite;
}

.accept .btn-icon:active {
  box-shadow: 0 4rpx 20rpx rgba(16, 185, 129, 0.6);
}

@keyframes acceptPulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}
</style>
