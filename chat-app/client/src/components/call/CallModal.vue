<template>
  <!-- 来电/去电弹窗 -->
  <view v-if="visible" class="call-modal">
    <view class="call-modal-mask" />
    <view class="call-modal-content">
      <!-- 对方头像 -->
      <view class="avatar-wrapper">
        <image
          class="avatar"
          :src="peerInfo?.avatar || '/static/default-avatar.png'"
          mode="aspectFill"
        />
        <view class="pulse-ring" />
        <view class="pulse-ring pulse-ring-delay" />
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
              <text class="iconfont icon-phone-hangup" />
            </view>
            <text class="btn-label">拒绝</text>
          </view>
          <view class="action-btn accept" @tap="handleAccept">
            <view class="btn-icon">
              <text class="iconfont icon-phone" />
            </view>
            <text class="btn-label">接听</text>
          </view>
        </template>

        <!-- 去电：取消 -->
        <template v-else-if="isCalling">
          <view class="action-btn cancel" @tap="handleCancel">
            <view class="btn-icon">
              <text class="iconfont icon-phone-hangup" />
            </view>
            <text class="btn-label">取消</text>
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
  await callStore.acceptCall()
}

// 拒绝
const handleReject = () => {
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

.call-modal-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
}

.call-modal-content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 40rpx;
  width: 100%;
}

.avatar-wrapper {
  position: relative;
  width: 200rpx;
  height: 200rpx;
  margin-bottom: 40rpx;
}

.avatar {
  width: 200rpx;
  height: 200rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(255, 255, 255, 0.3);
}

.pulse-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 200rpx;
  height: 200rpx;
  border-radius: 50%;
  border: 2rpx solid rgba(255, 255, 255, 0.5);
  animation: pulse 2s ease-out infinite;
}

.pulse-ring-delay {
  animation-delay: 1s;
}

@keyframes pulse {
  0% {
    width: 200rpx;
    height: 200rpx;
    opacity: 0.8;
  }
  100% {
    width: 350rpx;
    height: 350rpx;
    opacity: 0;
  }
}

.nickname {
  font-size: 44rpx;
  font-weight: 500;
  color: #fff;
  margin-bottom: 20rpx;
}

.status-text {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 100rpx;
}

.actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 120rpx;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}

.btn-icon {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;
}

.btn-icon:active {
  transform: scale(0.95);
}

.btn-icon .iconfont {
  font-size: 48rpx;
  color: #fff;
}

.btn-label {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.8);
}

.reject .btn-icon,
.cancel .btn-icon {
  background: #ff4d4f;
}

.accept .btn-icon {
  background: #52c41a;
}

/* 电话图标（使用 Unicode 作为 fallback） */
.icon-phone::before {
  content: '\260E';
}

.icon-phone-hangup::before {
  content: '\2715';
}
</style>
