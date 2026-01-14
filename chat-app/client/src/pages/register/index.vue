<template>
  <view class="register-page">
    <!-- 背景装饰 -->
    <view class="bg-decoration">
      <view class="orb orb-1"></view>
      <view class="orb orb-2"></view>
      <view class="grid-lines"></view>
    </view>

    <!-- 自定义导航栏 -->
    <view class="nav-bar">
      <view class="nav-back" @click="goLogin">
        <text class="back-icon">←</text>
      </view>
      <text class="nav-title">创建账号</text>
      <view class="nav-placeholder"></view>
    </view>

    <!-- 主内容 -->
    <view class="content">
      <!-- 标题区域 -->
      <view class="header">
        <text class="title">加入 Nebula</text>
        <text class="subtitle">开启全新的聊天体验</text>
      </view>

      <!-- 推荐人信息 -->
      <view v-if="referrer" class="referrer-card">
        <view class="referrer-label">受邀加入</view>
        <view class="referrer-info">
          <image
            class="referrer-avatar"
            :src="referrer.avatar || '/static/default-avatar.png'"
            mode="aspectFill"
          />
          <text class="referrer-name">{{ referrer.nickname }}</text>
          <text class="referrer-desc">邀请你加入</text>
        </view>
      </view>

      <!-- 表单区域 -->
      <view class="form-card">
        <!-- 账号 -->
        <view class="input-group">
          <text class="input-label">账号</text>
          <view class="input-wrapper" :class="{ error: accountError, focus: accountFocus }">
            <view class="input-icon"><text>👤</text></view>
            <input
              v-model="account"
              class="form-input"
              type="text"
              placeholder="4-20位字母或数字"
              maxlength="20"
              @focus="accountFocus = true"
              @blur="accountFocus = false"
            />
            <view v-if="account && !accountError" class="input-status success">
              <text>✓</text>
            </view>
          </view>
          <text v-if="accountError" class="error-text">{{ accountError }}</text>
        </view>

        <!-- 密码 -->
        <view class="input-group">
          <text class="input-label">密码</text>
          <view class="input-wrapper" :class="{ focus: passwordFocus }">
            <view class="input-icon"><text>🔒</text></view>
            <input
              v-model="password"
              class="form-input"
              :type="showPassword ? 'text' : 'password'"
              placeholder="6-20位字符"
              maxlength="20"
              @focus="passwordFocus = true"
              @blur="passwordFocus = false"
            />
            <view class="input-toggle" @click="showPassword = !showPassword">
              <text>{{ showPassword ? '🙈' : '👁' }}</text>
            </view>
          </view>
          <!-- 密码强度指示器 -->
          <view v-if="password" class="password-strength">
            <view class="strength-bar">
              <view class="strength-fill" :class="passwordStrength.class" :style="{ width: passwordStrength.width }"></view>
            </view>
            <text class="strength-text" :class="passwordStrength.class">{{ passwordStrength.text }}</text>
          </view>
        </view>

        <!-- 确认密码 -->
        <view class="input-group">
          <text class="input-label">确认密码</text>
          <view class="input-wrapper" :class="{ error: confirmError, focus: confirmFocus }">
            <view class="input-icon"><text>🔐</text></view>
            <input
              v-model="confirmPassword"
              class="form-input"
              type="password"
              placeholder="请再次输入密码"
              maxlength="20"
              @focus="confirmFocus = true"
              @blur="confirmFocus = false"
            />
            <view v-if="confirmPassword && !confirmError" class="input-status success">
              <text>✓</text>
            </view>
          </view>
          <text v-if="confirmError" class="error-text">{{ confirmError }}</text>
        </view>

        <!-- 注册按钮 -->
        <button
          class="register-btn"
          :class="{ active: canSubmit }"
          :disabled="!canSubmit || loading"
          @click="handleRegister"
        >
          <view v-if="loading" class="btn-loading">
            <view class="spinner"></view>
          </view>
          <text v-else class="btn-text">创建账号</text>
        </button>
      </view>

      <!-- 登录链接 -->
      <view class="login-section" @click="goLogin">
        <text class="login-text">已有账号？</text>
        <text class="login-link">立即登录</text>
      </view>

      <!-- 服务条款 -->
      <view class="terms">
        <text class="terms-text">注册即表示同意</text>
        <text class="terms-link">服务条款</text>
        <text class="terms-text">和</text>
        <text class="terms-link">隐私政策</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '../../store/user'
import { authApi } from '../../api'

const userStore = useUserStore()

const account = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const showPassword = ref(false)

const accountFocus = ref(false)
const passwordFocus = ref(false)
const confirmFocus = ref(false)

// 推荐码相关
const referralCode = ref('')
const referrer = ref<{ id: number; nickname: string; avatar: string | null } | null>(null)
const referralLoading = ref(false)

// 获取 URL 参数中的推荐码
onMounted(async () => {
  // #ifdef H5
  const urlParams = new URLSearchParams(window.location.search)
  const code = urlParams.get('ref')
  // #endif
  // #ifndef H5
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const code = currentPage?.$page?.options?.ref || currentPage?.options?.ref
  // #endif

  if (code) {
    referralCode.value = code
    referralLoading.value = true
    try {
      const res = await authApi.verifyReferral(code)
      if (res.data.valid) {
        referrer.value = res.data.referrer
      }
    } catch (error) {
      console.error('推荐码验证失败:', error)
      referralCode.value = ''
    } finally {
      referralLoading.value = false
    }
  }
})

const accountError = computed(() => {
  if (!account.value) return ''
  if (!/^[a-zA-Z0-9]{4,20}$/.test(account.value)) {
    return '账号需要4-20位字母或数字'
  }
  return ''
})

const confirmError = computed(() => {
  if (!confirmPassword.value) return ''
  if (password.value !== confirmPassword.value) {
    return '两次输入的密码不一致'
  }
  return ''
})

const passwordStrength = computed(() => {
  const pwd = password.value
  if (!pwd) return { width: '0%', text: '', class: '' }

  let strength = 0
  if (pwd.length >= 6) strength++
  if (pwd.length >= 10) strength++
  if (/[A-Z]/.test(pwd)) strength++
  if (/[0-9]/.test(pwd)) strength++
  if (/[^A-Za-z0-9]/.test(pwd)) strength++

  if (strength <= 2) return { width: '33%', text: '弱', class: 'weak' }
  if (strength <= 3) return { width: '66%', text: '中', class: 'medium' }
  return { width: '100%', text: '强', class: 'strong' }
})

const canSubmit = computed(() => {
  return (
    account.value.length >= 4 &&
    password.value.length >= 6 &&
    confirmPassword.value === password.value &&
    !accountError.value
  )
})

const handleRegister = async () => {
  if (!canSubmit.value || loading.value) return

  loading.value = true
  try {
    await userStore.register(account.value, password.value, referralCode.value || undefined)
    uni.showToast({ title: '注册成功', icon: 'success' })
    setTimeout(() => {
      uni.switchTab({ url: '/pages/index/index' })
    }, 1500)
  } catch (error: any) {
    uni.showToast({
      title: error.message || '注册失败',
      icon: 'none'
    })
  } finally {
    loading.value = false
  }
}

const goLogin = () => {
  uni.navigateBack()
}
</script>

<style scoped>
.register-page {
  min-height: 100vh;
  background: var(--bg-deep);
  position: relative;
  overflow: hidden;
}

/* 背景装饰 */
.bg-decoration {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80rpx);
  opacity: 0.4;
}

.orb-1 {
  width: 500rpx;
  height: 500rpx;
  background: radial-gradient(circle, rgba(168, 85, 247, 0.4) 0%, transparent 70%);
  top: -100rpx;
  left: -100rpx;
  animation: float 10s ease-in-out infinite;
}

.orb-2 {
  width: 400rpx;
  height: 400rpx;
  background: radial-gradient(circle, rgba(34, 211, 238, 0.3) 0%, transparent 70%);
  bottom: 200rpx;
  right: -100rpx;
  animation: float 8s ease-in-out infinite reverse;
}

.grid-lines {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
  background-size: 60rpx 60rpx;
  mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
}

@keyframes float {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(20rpx, -20rpx); }
}

/* 导航栏 */
.nav-bar {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  padding: 0 24rpx;
  padding-top: env(safe-area-inset-top);
}

.nav-back {
  width: 80rpx;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
  background: var(--bg-glass);
  border: 1rpx solid var(--border-subtle);
}

.back-icon {
  font-size: 36rpx;
  color: var(--text-primary);
}

.nav-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.nav-placeholder {
  width: 80rpx;
}

/* 主内容 */
.content {
  position: relative;
  z-index: 1;
  padding: 0 48rpx;
}

/* 标题区域 */
.header {
  text-align: center;
  margin-top: 40rpx;
  margin-bottom: 48rpx;
}

.title {
  display: block;
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 12rpx;
}

.subtitle {
  font-size: var(--text-base);
  color: var(--text-tertiary);
}

/* 表单卡片 */
.form-card {
  background: var(--gradient-card);
  backdrop-filter: var(--blur-lg);
  -webkit-backdrop-filter: var(--blur-lg);
  border: 1rpx solid var(--border-subtle);
  border-radius: var(--radius-2xl);
  padding: 40rpx 32rpx;
}

.input-group {
  margin-bottom: 28rpx;
}

.input-label {
  display: block;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  margin-bottom: 12rpx;
  margin-left: 8rpx;
}

.input-wrapper {
  display: flex;
  align-items: center;
  background: var(--bg-glass);
  border: 1rpx solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 0 20rpx;
  transition: all var(--duration-normal) var(--ease-out);
}

.input-wrapper.focus {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 4rpx rgba(168, 85, 247, 0.15);
  background: var(--bg-glass-hover);
}

.input-wrapper.error {
  border-color: var(--accent-danger);
  box-shadow: 0 0 0 4rpx rgba(239, 68, 68, 0.15);
}

.input-icon {
  font-size: 32rpx;
  margin-right: 12rpx;
  opacity: 0.5;
}

.form-input {
  flex: 1;
  height: 88rpx;
  font-size: var(--text-md);
  color: var(--text-primary);
  background: transparent;
  border: none;
}

.input-toggle {
  padding: 12rpx;
  font-size: 28rpx;
  opacity: 0.5;
}

.input-status {
  font-size: 28rpx;
}

.input-status.success {
  color: var(--accent-success);
}

.error-text {
  display: block;
  font-size: var(--text-xs);
  color: var(--accent-danger);
  margin-top: 8rpx;
  margin-left: 8rpx;
}

/* 密码强度 */
.password-strength {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 12rpx;
  margin-left: 8rpx;
}

.strength-bar {
  flex: 1;
  height: 6rpx;
  background: var(--bg-elevated);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.strength-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width var(--duration-normal) var(--ease-out);
}

.strength-fill.weak {
  background: var(--accent-danger);
}

.strength-fill.medium {
  background: var(--accent-warning);
}

.strength-fill.strong {
  background: var(--accent-success);
}

.strength-text {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.strength-text.weak {
  color: var(--accent-danger);
}

.strength-text.medium {
  color: var(--accent-warning);
}

.strength-text.strong {
  color: var(--accent-success);
}

/* 注册按钮 */
.register-btn {
  width: 100%;
  height: 96rpx;
  margin-top: 32rpx;
  background: var(--bg-glass);
  border: 1rpx solid var(--border-subtle);
  border-radius: var(--radius-lg);
  transition: all var(--duration-normal) var(--ease-out);
}

.register-btn.active {
  background: var(--gradient-primary);
  border-color: transparent;
  box-shadow: var(--shadow-glow);
}

.register-btn.active:active {
  transform: scale(0.98);
}

.register-btn[disabled] {
  opacity: 0.5;
}

.btn-text {
  font-size: var(--text-md);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  letter-spacing: 2rpx;
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
  to { transform: rotate(360deg); }
}

/* 登录链接 */
.login-section {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 40rpx;
  padding: 20rpx;
  gap: 8rpx;
}

.login-text {
  font-size: var(--text-base);
  color: var(--text-tertiary);
}

.login-link {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* 服务条款 */
.terms {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 60rpx;
  padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
  gap: 8rpx;
}

.terms-text {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.terms-link {
  font-size: var(--text-xs);
  color: var(--accent-tertiary);
}

/* 推荐人卡片 */
.referrer-card {
  background: var(--gradient-card);
  backdrop-filter: var(--blur-lg);
  -webkit-backdrop-filter: var(--blur-lg);
  border: 1rpx solid var(--accent-primary);
  border-radius: var(--radius-xl);
  padding: 24rpx 32rpx;
  margin-bottom: 32rpx;
}

.referrer-label {
  font-size: var(--text-xs);
  color: var(--accent-primary);
  font-weight: var(--font-medium);
  margin-bottom: 16rpx;
}

.referrer-info {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.referrer-avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: var(--radius-full);
  border: 2rpx solid var(--accent-primary);
}

.referrer-name {
  font-size: var(--text-md);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.referrer-desc {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}
</style>
