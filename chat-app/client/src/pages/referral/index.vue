<template>
  <view class="referral-page">
    <!-- 背景装饰 -->
    <view class="bg-decoration">
      <view class="orb orb-1"></view>
      <view class="orb orb-2"></view>
    </view>

    <view class="content">
      <!-- 加载中 -->
      <view v-if="loading" class="loading-section">
        <view class="spinner"></view>
        <text class="loading-text">正在为您创建账号...</text>
      </view>

      <!-- 错误 -->
      <view v-else-if="error" class="error-section">
        <text class="error-icon">❌</text>
        <text class="error-title">链接无效</text>
        <text class="error-desc">{{ error }}</text>
        <button class="goto-btn" @click="goLogin">前往登录</button>
      </view>

      <!-- 成功 -->
      <view v-else-if="success" class="success-section">
        <text class="success-icon">🎉</text>
        <text class="success-title">欢迎加入！</text>
        <view class="account-info">
          <view class="info-row">
            <text class="info-label">您的账号</text>
            <text class="info-value">{{ accountInfo.account }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">初始密码</text>
            <text class="info-value">{{ accountInfo.password }}</text>
          </view>
        </view>
        <text class="tip">请妥善保管您的账号信息，建议登录后修改密码</text>
        <button class="start-btn" @click="goChat">开始聊天</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserStore } from '../../store/user'
import { useSocketStore } from '../../store/socket'

const userStore = useUserStore()
const socketStore = useSocketStore()

const loading = ref(true)
const error = ref('')
const success = ref(false)
const accountInfo = ref({ account: '', password: '' })

onMounted(async () => {
  // 获取推荐码
  let code = ''

  // #ifdef H5
  const urlParams = new URLSearchParams(window.location.search)
  code = urlParams.get('code') || ''
  // 也支持 hash 路由参数
  if (!code && window.location.hash.includes('?')) {
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1])
    code = hashParams.get('code') || ''
  }
  // #endif

  // #ifndef H5
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  code = currentPage?.$page?.options?.code || currentPage?.options?.code || ''
  // #endif

  if (!code) {
    loading.value = false
    error.value = '缺少推荐码参数'
    return
  }

  try {
    // 调用自动注册接口
    const res = await uni.request({
      url: `${import.meta.env.VITE_API_BASE_URL || ''}/api/referral/auto-register/${code}`,
      method: 'POST'
    }) as any

    const data = res.data
    if (data.code === 200) {
      accountInfo.value = {
        account: data.data.account,
        password: data.data.password
      }

      // 自动登录
      userStore.token = data.data.token
      userStore.user = data.data.user
      uni.setStorageSync('token', data.data.token)
      uni.setStorageSync('user', data.data.user)

      success.value = true
    } else {
      error.value = data.message || '注册失败'
    }
  } catch (err: any) {
    console.error('自动注册失败:', err)
    error.value = err.message || '网络错误，请重试'
  } finally {
    loading.value = false
  }
})

const goLogin = () => {
  uni.reLaunch({ url: '/pages/login/index' })
}

const goChat = () => {
  // 连接 socket
  socketStore.connect()
  uni.switchTab({ url: '/pages/index/index' })
}
</script>

<style scoped>
.referral-page {
  min-height: 100vh;
  background: var(--bg-deep);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

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
}

.orb-2 {
  width: 400rpx;
  height: 400rpx;
  background: radial-gradient(circle, rgba(34, 211, 238, 0.3) 0%, transparent 70%);
  bottom: 200rpx;
  right: -100rpx;
}

.content {
  position: relative;
  z-index: 1;
  padding: 48rpx;
  width: 100%;
  max-width: 600rpx;
}

/* 加载中 */
.loading-section {
  text-align: center;
}

.spinner {
  width: 80rpx;
  height: 80rpx;
  margin: 0 auto 32rpx;
  border: 6rpx solid rgba(168, 85, 247, 0.2);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: var(--text-lg);
  color: var(--text-secondary);
}

/* 错误 */
.error-section {
  text-align: center;
}

.error-icon {
  font-size: 100rpx;
  display: block;
  margin-bottom: 24rpx;
}

.error-title {
  display: block;
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin-bottom: 16rpx;
}

.error-desc {
  display: block;
  font-size: var(--text-base);
  color: var(--text-tertiary);
  margin-bottom: 48rpx;
}

.goto-btn {
  background: var(--bg-glass);
  border: 1rpx solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 24rpx 64rpx;
  font-size: var(--text-md);
  color: var(--text-primary);
}

/* 成功 */
.success-section {
  text-align: center;
}

.success-icon {
  font-size: 100rpx;
  display: block;
  margin-bottom: 24rpx;
}

.success-title {
  display: block;
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 32rpx;
}

.account-info {
  background: var(--gradient-card);
  backdrop-filter: var(--blur-lg);
  border: 1rpx solid var(--border-subtle);
  border-radius: var(--radius-xl);
  padding: 32rpx;
  margin-bottom: 24rpx;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
}

.info-row:not(:last-child) {
  border-bottom: 1rpx solid var(--border-subtle);
}

.info-label {
  font-size: var(--text-base);
  color: var(--text-tertiary);
}

.info-value {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--accent-primary);
  font-family: monospace;
}

.tip {
  display: block;
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin-bottom: 32rpx;
}

.start-btn {
  width: 100%;
  background: var(--gradient-primary);
  border: none;
  border-radius: var(--radius-lg);
  padding: 28rpx;
  font-size: var(--text-md);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  box-shadow: var(--shadow-glow);
}

.start-btn:active {
  transform: scale(0.98);
}
</style>
