<template>
  <view v-if="visible" class="modal-overlay" @click="handleOverlayClick">
    <view class="modal-container" :class="{ danger: type === 'danger' }" @click.stop>
      <!-- 背景光效 -->
      <view class="modal-glow"></view>

      <!-- 弹窗内容 -->
      <view class="modal-content">
        <!-- 图标 -->
        <view v-if="icon" class="modal-icon" :class="type">
          <text>{{ icon }}</text>
        </view>

        <!-- 标题 -->
        <view class="modal-header">
          <text class="modal-title">{{ title }}</text>
        </view>

        <!-- 内容 -->
        <view v-if="content" class="modal-body">
          <text class="modal-message">{{ content }}</text>
        </view>

        <!-- 按钮区域 -->
        <view class="modal-actions">
          <view v-if="showCancel" class="action-btn cancel" @click="handleCancel">
            <text>{{ cancelText }}</text>
          </view>
          <view class="action-btn confirm" :class="type" @click="handleConfirm">
            <text>{{ confirmText }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  visible: boolean
  title: string
  content?: string
  icon?: string
  type?: 'default' | 'danger' | 'warning'
  confirmText?: string
  cancelText?: string
  showCancel?: boolean
}>(), {
  content: '',
  icon: '',
  type: 'default',
  confirmText: '确定',
  cancelText: '取消',
  showCancel: true
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const handleOverlayClick = () => {
  handleCancel()
}

const handleCancel = () => {
  emit('update:visible', false)
  emit('cancel')
}

const handleConfirm = () => {
  emit('confirm')
  emit('update:visible', false)
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-container {
  position: relative;
  width: 560rpx;
  animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(40rpx) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-glow {
  position: absolute;
  inset: -40rpx;
  background: radial-gradient(
    ellipse at center,
    rgba(168, 85, 247, 0.15) 0%,
    transparent 70%
  );
  filter: blur(40rpx);
  pointer-events: none;
}

.modal-container.danger .modal-glow {
  background: radial-gradient(
    ellipse at center,
    rgba(239, 68, 68, 0.15) 0%,
    transparent 70%
  );
}

.modal-content {
  position: relative;
  background: linear-gradient(
    180deg,
    rgba(30, 30, 40, 0.95) 0%,
    rgba(20, 20, 28, 0.98) 100%
  );
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  border-radius: 32rpx;
  padding: 48rpx 40rpx;
  box-shadow:
    0 20rpx 60rpx rgba(0, 0, 0, 0.4),
    0 0 0 1rpx rgba(255, 255, 255, 0.05) inset;
}

.modal-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100rpx;
  height: 100rpx;
  margin: 0 auto 32rpx;
  border-radius: 50%;
  font-size: 48rpx;
}

.modal-icon.default {
  background: rgba(168, 85, 247, 0.15);
}

.modal-icon.danger {
  background: rgba(239, 68, 68, 0.15);
}

.modal-icon.warning {
  background: rgba(245, 158, 11, 0.15);
}

.modal-header {
  text-align: center;
  margin-bottom: 16rpx;
}

.modal-title {
  font-size: 36rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  letter-spacing: 2rpx;
}

.modal-body {
  text-align: center;
  margin-bottom: 40rpx;
}

.modal-message {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.6;
}

.modal-actions {
  display: flex;
  gap: 24rpx;
}

.action-btn {
  flex: 1;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 20rpx;
  font-size: 30rpx;
  font-weight: 500;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.action-btn:active {
  transform: scale(0.97);
}

.action-btn.cancel {
  background: rgba(255, 255, 255, 0.08);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
}

.action-btn.cancel:active {
  background: rgba(255, 255, 255, 0.12);
}

.action-btn.confirm {
  background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
  color: #fff;
  box-shadow: 0 8rpx 24rpx rgba(168, 85, 247, 0.3);
}

.action-btn.confirm.danger {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  box-shadow: 0 8rpx 24rpx rgba(239, 68, 68, 0.3);
}

.action-btn.confirm.warning {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  box-shadow: 0 8rpx 24rpx rgba(245, 158, 11, 0.3);
}

.action-btn.confirm:active {
  box-shadow: 0 4rpx 16rpx rgba(168, 85, 247, 0.4);
}

.action-btn.confirm.danger:active {
  box-shadow: 0 4rpx 16rpx rgba(239, 68, 68, 0.4);
}
</style>
