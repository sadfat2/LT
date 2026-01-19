<template>
  <view class="login-page">
    <!-- 背景装饰 -->
    <view class="bg-decoration">
      <view class="orb orb-1"></view>
      <view class="orb orb-2"></view>
      <view class="orb orb-3"></view>
      <view class="grid-lines"></view>
    </view>

    <!-- 主内容区 -->
    <view class="content">
      <!-- Logo 区域 -->
      <view class="logo-section">
        <view class="logo-container">
          <view class="logo">
            <view class="logo-inner">
              <text class="logo-icon">💬</text>
            </view>
            <view class="logo-glow"></view>
          </view>
        </view>
        <text class="app-name">Nebula Chat</text>
        <text class="app-tagline">连接每一个精彩瞬间</text>
      </view>

      <!-- 表单区域 -->
      <view class="form-section">
        <view class="form-card">
          <!-- 账号输入 -->
          <view class="input-group">
            <view class="input-wrapper">
              <view class="input-icon">
                <text>👤</text>
              </view>
              <input
                v-model="account"
                class="form-input"
                type="text"
                placeholder="请输入账号"
                maxlength="20"
                :focus="false"
              />
              <view v-if="account" class="input-clear" @click="account = ''">
                <text>×</text>
              </view>
            </view>
          </view>

          <!-- 密码输入 -->
          <view class="input-group">
            <view class="input-wrapper">
              <view class="input-icon">
                <text>🔒</text>
              </view>
              <input
                v-model="password"
                class="form-input"
                :type="showPassword ? 'text' : 'password'"
                placeholder="请输入密码"
                maxlength="20"
              />
              <view class="input-toggle" @click="showPassword = !showPassword">
                <text>{{ showPassword ? '🙈' : '👁' }}</text>
              </view>
            </view>
          </view>

          <!-- 登录按钮 -->
          <button
            class="login-btn"
            :class="{ active: canSubmit, loading: loading }"
            :disabled="!canSubmit || loading"
            @click="handleLogin"
          >
            <view v-if="loading" class="btn-loading">
              <view class="spinner"></view>
            </view>
            <text v-else class="btn-text">登录</text>
            <view class="btn-shine"></view>
          </button>
        </view>

      </view>

      <!-- 底部装饰 -->
      <view class="footer">
        <text class="footer-text">安全加密 · 畅快聊天</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUserStore } from '../../store/user'

const userStore = useUserStore()

const account = ref('')
const password = ref('')
const loading = ref(false)
const showPassword = ref(false)

const canSubmit = computed(() => {
  return account.value.length >= 4 && password.value.length >= 6
})

const handleLogin = async () => {
  if (!canSubmit.value || loading.value) return

  loading.value = true
  try {
    await userStore.login(account.value, password.value)
    uni.switchTab({ url: '/pages/index/index' })
  } catch (error: any) {
    uni.showToast({
      title: error.message || '登录失败',
      icon: 'none'
    })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
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
  opacity: 0.5;
}

.orb-1 {
  width: 600rpx;
  height: 600rpx;
  background: radial-gradient(circle, rgba(168, 85, 247, 0.4) 0%, transparent 70%);
  top: -200rpx;
  right: -200rpx;
  animation: float 8s ease-in-out infinite;
}

.orb-2 {
  width: 500rpx;
  height: 500rpx;
  background: radial-gradient(circle, rgba(236, 72, 153, 0.3) 0%, transparent 70%);
  bottom: 100rpx;
  left: -150rpx;
  animation: float 10s ease-in-out infinite reverse;
}

.orb-3 {
  width: 400rpx;
  height: 400rpx;
  background: radial-gradient(circle, rgba(34, 211, 238, 0.25) 0%, transparent 70%);
  top: 40%;
  right: -100rpx;
  animation: float 12s ease-in-out infinite;
}

.grid-lines {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
  background-size: 60rpx 60rpx;
  mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
}

@keyframes float {
  0%, 100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(30rpx, -30rpx) scale(1.05);
  }
  66% {
    transform: translate(-20rpx, 20rpx) scale(0.95);
  }
}

/* 主内容 */
.content {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 0 60rpx;
  padding-top: env(safe-area-inset-top);
}

/* Logo 区域 */
.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 120rpx;
  margin-bottom: 80rpx;
}

.logo-container {
  position: relative;
  margin-bottom: 32rpx;
}

.logo {
  position: relative;
  width: 160rpx;
  height: 160rpx;
}

.logo-inner {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  background: var(--gradient-primary);
  border-radius: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-glow-accent);
}

.logo-icon {
  font-size: 72rpx;
  filter: drop-shadow(0 4rpx 8rpx rgba(0, 0, 0, 0.3));
}

.logo-glow {
  position: absolute;
  inset: -20rpx;
  background: var(--gradient-primary);
  border-radius: 60rpx;
  filter: blur(30rpx);
  opacity: 0.4;
  animation: glow 3s ease-in-out infinite;
}

.app-name {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  background: var(--gradient-aurora);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: 2rpx;
  margin-bottom: 16rpx;
}

.app-tagline {
  font-size: var(--text-base);
  color: var(--text-tertiary);
  letter-spacing: 4rpx;
}

/* 表单区域 */
.form-section {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.form-card {
  background: var(--gradient-card);
  backdrop-filter: var(--blur-lg);
  -webkit-backdrop-filter: var(--blur-lg);
  border: 1rpx solid var(--border-subtle);
  border-radius: var(--radius-2xl);
  padding: 48rpx 40rpx;
  box-shadow: var(--shadow-lg);
}

.input-group {
  margin-bottom: 32rpx;
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

.input-icon {
  font-size: 36rpx;
  margin-right: 16rpx;
  opacity: 0.6;
}

.form-input {
  flex: 1;
  height: 96rpx;
  font-size: var(--text-md);
  color: var(--text-primary);
  background: transparent;
  border: none;
}

.input-clear,
.input-toggle {
  padding: 16rpx;
  font-size: 32rpx;
  opacity: 0.6;
  transition: opacity var(--duration-fast);
}

.input-clear:active,
.input-toggle:active {
  opacity: 1;
}

/* 登录按钮 */
.login-btn {
  position: relative;
  width: 100%;
  height: 100rpx;
  margin-top: 24rpx;
  background: var(--bg-glass);
  border: 1rpx solid var(--border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: all var(--duration-normal) var(--ease-out);
}

.login-btn.active {
  background: var(--gradient-primary);
  border-color: transparent;
  box-shadow: var(--shadow-glow);
}

.login-btn.active:active {
  transform: scale(0.98);
  box-shadow: var(--shadow-glow-accent);
}

.login-btn[disabled] {
  opacity: 0.5;
}

.btn-text {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  letter-spacing: 4rpx;
}

.btn-loading {
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner {
  width: 40rpx;
  height: 40rpx;
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

.btn-shine {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.1),
    transparent
  );
  transition: left 0.5s ease;
}

.login-btn.active:active .btn-shine {
  left: 100%;
}

/* 底部 */
.footer {
  padding: 60rpx 0;
  padding-bottom: calc(60rpx + env(safe-area-inset-bottom));
  display: flex;
  justify-content: center;
}

.footer-text {
  font-size: var(--text-xs);
  color: var(--text-muted);
  letter-spacing: 2rpx;
}

/* 发光动画 */
@keyframes glow {
  0%, 100% {
    opacity: 0.4;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.1);
  }
}
</style>
