<template>
  <view v-if="visible" class="modal-overlay" @click.self="handleOverlayClick">
    <view class="modal-container">
      <!-- 标题 -->
      <view class="modal-header">
        <text class="modal-title">设置账号信息</text>
        <text class="modal-subtitle">您可以自定义账号密码，或跳过使用系统生成</text>
      </view>

      <!-- 表单 -->
      <view class="modal-body">
        <!-- 账号输入 -->
        <view class="input-group">
          <text class="input-label">账号</text>
          <view class="input-wrapper" :class="{ error: errors.account }">
            <view class="input-icon">
              <text>👤</text>
            </view>
            <input
              v-model="form.account"
              class="form-input"
              type="text"
              placeholder="4-20位字母或数字"
              maxlength="20"
              @blur="validateAccount"
            />
            <view v-if="form.account" class="input-clear" @click="form.account = ''">
              <text>×</text>
            </view>
          </view>
          <text v-if="errors.account" class="error-text">{{ errors.account }}</text>
        </view>

        <!-- 密码输入 -->
        <view class="input-group">
          <text class="input-label">密码</text>
          <view class="input-wrapper" :class="{ error: errors.password }">
            <view class="input-icon">
              <text>🔒</text>
            </view>
            <input
              v-model="form.password"
              class="form-input"
              :type="showPassword ? 'text' : 'password'"
              placeholder="6-20位字符"
              maxlength="20"
              @blur="validatePassword"
              @input="updatePasswordStrength"
            />
            <view class="input-toggle" @click="showPassword = !showPassword">
              <text>{{ showPassword ? '🙈' : '👁' }}</text>
            </view>
          </view>
          <!-- 密码强度指示器 -->
          <view v-if="form.password" class="password-strength">
            <view class="strength-bar">
              <view
                class="strength-fill"
                :class="passwordStrength.level"
                :style="{ width: passwordStrength.percent + '%' }"
              ></view>
            </view>
            <text class="strength-text" :class="passwordStrength.level">{{ passwordStrength.text }}</text>
          </view>
          <text v-if="errors.password" class="error-text">{{ errors.password }}</text>
        </view>

        <!-- 确认密码 -->
        <view class="input-group">
          <text class="input-label">确认密码</text>
          <view class="input-wrapper" :class="{ error: errors.confirmPassword }">
            <view class="input-icon">
              <text>🔐</text>
            </view>
            <input
              v-model="form.confirmPassword"
              class="form-input"
              :type="showConfirmPassword ? 'text' : 'password'"
              placeholder="再次输入密码"
              maxlength="20"
              @blur="validateConfirmPassword"
            />
            <view class="input-toggle" @click="showConfirmPassword = !showConfirmPassword">
              <text>{{ showConfirmPassword ? '🙈' : '👁' }}</text>
            </view>
          </view>
          <text v-if="errors.confirmPassword" class="error-text">{{ errors.confirmPassword }}</text>
        </view>
      </view>

      <!-- 按钮 -->
      <view class="modal-footer">
        <button class="skip-btn" :disabled="loading" @click="handleSkip">
          <text>跳过（自动生成）</text>
        </button>
        <button
          class="confirm-btn"
          :class="{ active: canSubmit, loading: loading }"
          :disabled="!canSubmit || loading"
          @click="handleConfirm"
        >
          <view v-if="loading" class="btn-loading">
            <view class="spinner"></view>
          </view>
          <text v-else>确认注册</text>
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'confirm', data: { account: string; password: string }): void
  (e: 'skip'): void
}>()

const form = reactive({
  account: '',
  password: '',
  confirmPassword: ''
})

const errors = reactive({
  account: '',
  password: '',
  confirmPassword: ''
})

const showPassword = ref(false)
const showConfirmPassword = ref(false)

const passwordStrength = reactive({
  level: 'weak',
  text: '弱',
  percent: 0
})

// 验证账号
const validateAccount = () => {
  const regex = /^[a-zA-Z0-9]{4,20}$/
  if (!form.account) {
    errors.account = ''
    return false
  }
  if (!regex.test(form.account)) {
    errors.account = '请输入4-20位字母或数字'
    return false
  }
  errors.account = ''
  return true
}

// 验证密码
const validatePassword = () => {
  if (!form.password) {
    errors.password = ''
    return false
  }
  if (form.password.length < 6 || form.password.length > 20) {
    errors.password = '密码长度需为6-20位'
    return false
  }
  errors.password = ''
  // 同时验证确认密码
  if (form.confirmPassword) {
    validateConfirmPassword()
  }
  return true
}

// 验证确认密码
const validateConfirmPassword = () => {
  if (!form.confirmPassword) {
    errors.confirmPassword = ''
    return false
  }
  if (form.password !== form.confirmPassword) {
    errors.confirmPassword = '两次输入的密码不一致'
    return false
  }
  errors.confirmPassword = ''
  return true
}

// 更新密码强度
const updatePasswordStrength = () => {
  const pwd = form.password
  if (!pwd) {
    passwordStrength.level = 'weak'
    passwordStrength.text = '弱'
    passwordStrength.percent = 0
    return
  }

  let score = 0

  // 长度评分
  if (pwd.length >= 6) score += 1
  if (pwd.length >= 8) score += 1
  if (pwd.length >= 12) score += 1

  // 字符类型评分
  if (/[a-z]/.test(pwd)) score += 1
  if (/[A-Z]/.test(pwd)) score += 1
  if (/[0-9]/.test(pwd)) score += 1
  if (/[^a-zA-Z0-9]/.test(pwd)) score += 1

  if (score <= 2) {
    passwordStrength.level = 'weak'
    passwordStrength.text = '弱'
    passwordStrength.percent = 33
  } else if (score <= 4) {
    passwordStrength.level = 'medium'
    passwordStrength.text = '中'
    passwordStrength.percent = 66
  } else {
    passwordStrength.level = 'strong'
    passwordStrength.text = '强'
    passwordStrength.percent = 100
  }
}

// 是否可以提交
const canSubmit = computed(() => {
  return (
    form.account.length >= 4 &&
    form.password.length >= 6 &&
    form.confirmPassword === form.password &&
    !errors.account &&
    !errors.password &&
    !errors.confirmPassword
  )
})

// 点击确认
const handleConfirm = () => {
  if (!validateAccount() || !validatePassword() || !validateConfirmPassword()) {
    return
  }
  if (!canSubmit.value || props.loading) return

  emit('confirm', {
    account: form.account,
    password: form.password
  })
}

// 点击跳过
const handleSkip = () => {
  if (props.loading) return
  emit('skip')
}

// 点击遮罩层（不关闭）
const handleOverlayClick = () => {
  // 不做任何操作，防止误触关闭
}

// 重置表单
const resetForm = () => {
  form.account = ''
  form.password = ''
  form.confirmPassword = ''
  errors.account = ''
  errors.password = ''
  errors.confirmPassword = ''
  passwordStrength.level = 'weak'
  passwordStrength.text = '弱'
  passwordStrength.percent = 0
}

// 监听 visible 变化，关闭时重置表单
watch(
  () => props.visible,
  (newVal) => {
    if (!newVal) {
      resetForm()
    }
  }
)
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8rpx);
  -webkit-backdrop-filter: blur(8rpx);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 40rpx;
}

.modal-container {
  width: 100%;
  max-width: 640rpx;
  background: var(--gradient-card);
  backdrop-filter: var(--blur-lg);
  -webkit-backdrop-filter: var(--blur-lg);
  border: 1rpx solid var(--border-subtle);
  border-radius: var(--radius-2xl);
  overflow: hidden;
  animation: modalIn 0.3s ease-out;
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(20rpx);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-header {
  padding: 40rpx 40rpx 24rpx;
  text-align: center;
}

.modal-title {
  display: block;
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin-bottom: 12rpx;
}

.modal-subtitle {
  display: block;
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

.modal-body {
  padding: 0 40rpx 24rpx;
}

.input-group {
  margin-bottom: 24rpx;
}

.input-label {
  display: block;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-bottom: 12rpx;
}

.input-wrapper {
  display: flex;
  align-items: center;
  background: var(--bg-glass);
  border: 1rpx solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 0 24rpx;
  transition: all var(--duration-normal) var(--ease-out);
}

.input-wrapper:focus-within {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 4rpx rgba(168, 85, 247, 0.15);
  background: var(--bg-glass-hover);
}

.input-wrapper.error {
  border-color: var(--status-error);
  box-shadow: 0 0 0 4rpx rgba(239, 68, 68, 0.15);
}

.input-icon {
  font-size: 32rpx;
  margin-right: 16rpx;
  opacity: 0.6;
}

.form-input {
  flex: 1;
  height: 88rpx;
  font-size: var(--text-md);
  color: var(--text-primary);
  background: transparent;
  border: none;
}

.input-clear,
.input-toggle {
  padding: 12rpx;
  font-size: 28rpx;
  opacity: 0.6;
  transition: opacity var(--duration-fast);
}

.input-clear:active,
.input-toggle:active {
  opacity: 1;
}

.error-text {
  display: block;
  font-size: var(--text-xs);
  color: var(--status-error);
  margin-top: 8rpx;
  padding-left: 8rpx;
}

/* 密码强度指示器 */
.password-strength {
  display: flex;
  align-items: center;
  margin-top: 12rpx;
  gap: 16rpx;
}

.strength-bar {
  flex: 1;
  height: 8rpx;
  background: var(--bg-glass);
  border-radius: 4rpx;
  overflow: hidden;
}

.strength-fill {
  height: 100%;
  transition: width 0.3s ease, background 0.3s ease;
  border-radius: 4rpx;
}

.strength-fill.weak {
  background: var(--status-error);
}

.strength-fill.medium {
  background: var(--status-warning);
}

.strength-fill.strong {
  background: var(--status-success);
}

.strength-text {
  font-size: var(--text-xs);
  min-width: 32rpx;
}

.strength-text.weak {
  color: var(--status-error);
}

.strength-text.medium {
  color: var(--status-warning);
}

.strength-text.strong {
  color: var(--status-success);
}

/* 按钮区域 */
.modal-footer {
  display: flex;
  gap: 24rpx;
  padding: 24rpx 40rpx 40rpx;
}

.skip-btn,
.confirm-btn {
  flex: 1;
  height: 88rpx;
  border-radius: var(--radius-lg);
  font-size: var(--text-md);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--ease-out);
  display: flex;
  align-items: center;
  justify-content: center;
}

.skip-btn {
  background: var(--bg-glass);
  border: 1rpx solid var(--border-subtle);
  color: var(--text-secondary);
}

.skip-btn:active:not([disabled]) {
  background: var(--bg-glass-hover);
  transform: scale(0.98);
}

.skip-btn[disabled] {
  opacity: 0.5;
}

.confirm-btn {
  background: var(--bg-glass);
  border: 1rpx solid var(--border-subtle);
  color: var(--text-tertiary);
}

.confirm-btn.active {
  background: var(--gradient-primary);
  border-color: transparent;
  color: var(--text-primary);
  box-shadow: var(--shadow-glow);
}

.confirm-btn.active:active:not([disabled]) {
  transform: scale(0.98);
  box-shadow: var(--shadow-glow-accent);
}

.confirm-btn[disabled] {
  opacity: 0.5;
}

.btn-loading {
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner {
  width: 36rpx;
  height: 36rpx;
  border: 4rpx solid rgba(255, 255, 255, 0.3);
  border-top-color: var(--text-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
