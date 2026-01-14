<template>
  <view v-if="visible" class="modal-overlay" @click="handleOverlayClick">
    <view class="modal-container" @click.stop>
      <!-- 背景光效 -->
      <view class="modal-glow"></view>

      <!-- 弹窗内容 -->
      <view class="modal-content">
        <!-- 标题 -->
        <view class="modal-header">
          <text class="modal-title">修改密码</text>
        </view>

        <!-- 输入区域 -->
        <view class="input-section">
          <!-- 旧密码 -->
          <view class="input-group">
            <text class="input-label">旧密码</text>
            <view class="input-wrapper" :class="{ focus: focusField === 'old' }">
              <input
                v-model="oldPassword"
                class="modal-input"
                type="password"
                placeholder="请输入旧密码"
                @focus="focusField = 'old'"
                @blur="focusField = ''"
              />
            </view>
          </view>

          <!-- 新密码 -->
          <view class="input-group">
            <text class="input-label">新密码</text>
            <view class="input-wrapper" :class="{ focus: focusField === 'new' }">
              <input
                v-model="newPassword"
                class="modal-input"
                type="password"
                placeholder="6-20位字符"
                maxlength="20"
                @focus="focusField = 'new'"
                @blur="focusField = ''"
              />
            </view>
            <!-- 密码强度 -->
            <view v-if="newPassword" class="password-strength">
              <view class="strength-bar">
                <view
                  class="strength-fill"
                  :style="{ width: strengthPercent + '%' }"
                  :class="strengthClass"
                ></view>
              </view>
              <text class="strength-text" :class="strengthClass">{{ strengthText }}</text>
            </view>
          </view>

          <!-- 确认新密码 -->
          <view class="input-group">
            <text class="input-label">确认密码</text>
            <view class="input-wrapper" :class="{ focus: focusField === 'confirm', error: confirmError }">
              <input
                v-model="confirmPassword"
                class="modal-input"
                type="password"
                placeholder="再次输入新密码"
                maxlength="20"
                @focus="focusField = 'confirm'"
                @blur="focusField = ''"
              />
            </view>
            <text v-if="confirmError" class="error-hint">两次输入的密码不一致</text>
          </view>
        </view>

        <!-- 按钮区域 -->
        <view class="modal-actions">
          <view class="action-btn cancel" @click="handleCancel">
            <text>取消</text>
          </view>
          <view
            class="action-btn confirm"
            :class="{ disabled: !canConfirm || loading }"
            @click="handleConfirm"
          >
            <text>{{ loading ? '提交中...' : '确定' }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm', data: { oldPassword: string; newPassword: string }): void
  (e: 'cancel'): void
}>()

const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const focusField = ref('')
const loading = ref(false)

// 密码强度计算
const passwordStrength = computed(() => {
  const pwd = newPassword.value
  if (!pwd) return 0

  let score = 0
  // 长度检查
  if (pwd.length >= 6) score++
  if (pwd.length >= 10) score++
  // 包含数字
  if (/\d/.test(pwd)) score++
  // 包含小写字母
  if (/[a-z]/.test(pwd)) score++
  // 包含大写字母
  if (/[A-Z]/.test(pwd)) score++
  // 包含特殊字符
  if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) score++

  return score
})

const strengthPercent = computed(() => {
  const strength = passwordStrength.value
  if (strength <= 2) return 33
  if (strength <= 4) return 66
  return 100
})

const strengthClass = computed(() => {
  const strength = passwordStrength.value
  if (strength <= 2) return 'weak'
  if (strength <= 4) return 'medium'
  return 'strong'
})

const strengthText = computed(() => {
  const strength = passwordStrength.value
  if (strength <= 2) return '弱'
  if (strength <= 4) return '中'
  return '强'
})

// 确认密码错误检查
const confirmError = computed(() => {
  return confirmPassword.value && confirmPassword.value !== newPassword.value
})

// 是否可以提交
const canConfirm = computed(() => {
  return (
    oldPassword.value.length >= 6 &&
    newPassword.value.length >= 6 &&
    newPassword.value.length <= 20 &&
    confirmPassword.value === newPassword.value
  )
})

// 监听 visible 变化，重置表单
watch(() => props.visible, (val) => {
  if (val) {
    oldPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    loading.value = false
  }
})

const handleOverlayClick = () => {
  if (!loading.value) {
    handleCancel()
  }
}

const handleCancel = () => {
  emit('update:visible', false)
  emit('cancel')
}

const handleConfirm = () => {
  if (!canConfirm.value || loading.value) return

  loading.value = true
  emit('confirm', {
    oldPassword: oldPassword.value,
    newPassword: newPassword.value
  })
}

// 暴露方法给父组件调用
defineExpose({
  setLoading: (val: boolean) => {
    loading.value = val
  }
})
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
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-container {
  position: relative;
  width: 620rpx;
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

.modal-header {
  text-align: center;
  margin-bottom: 40rpx;
}

.modal-title {
  font-size: 36rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  letter-spacing: 2rpx;
}

.input-section {
  margin-bottom: 40rpx;
}

.input-group {
  margin-bottom: 28rpx;
}

.input-group:last-child {
  margin-bottom: 0;
}

.input-label {
  display: block;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 12rpx;
  padding-left: 8rpx;
}

.input-wrapper {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  border-radius: 20rpx;
  padding: 0 24rpx;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.input-wrapper.focus {
  border-color: rgba(168, 85, 247, 0.6);
  background: rgba(168, 85, 247, 0.08);
  box-shadow: 0 0 0 4rpx rgba(168, 85, 247, 0.15);
}

.input-wrapper.error {
  border-color: rgba(239, 68, 68, 0.6);
  background: rgba(239, 68, 68, 0.08);
}

.modal-input {
  flex: 1;
  height: 88rpx;
  font-size: 30rpx;
  color: rgba(255, 255, 255, 0.95);
  background: transparent;
}

.modal-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.password-strength {
  display: flex;
  align-items: center;
  margin-top: 12rpx;
  padding: 0 8rpx;
}

.strength-bar {
  flex: 1;
  height: 6rpx;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3rpx;
  overflow: hidden;
  margin-right: 16rpx;
}

.strength-fill {
  height: 100%;
  border-radius: 3rpx;
  transition: all 0.3s;
}

.strength-fill.weak {
  background: #ef4444;
}

.strength-fill.medium {
  background: #eab308;
}

.strength-fill.strong {
  background: #22c55e;
}

.strength-text {
  font-size: 22rpx;
  min-width: 40rpx;
}

.strength-text.weak {
  color: #ef4444;
}

.strength-text.medium {
  color: #eab308;
}

.strength-text.strong {
  color: #22c55e;
}

.error-hint {
  display: block;
  font-size: 22rpx;
  color: #ef4444;
  margin-top: 8rpx;
  padding-left: 8rpx;
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

.action-btn.confirm:active {
  box-shadow: 0 4rpx 16rpx rgba(168, 85, 247, 0.4);
}

.action-btn.confirm.disabled {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.3);
  box-shadow: none;
}
</style>
