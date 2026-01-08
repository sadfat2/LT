<template>
  <view class="login-page">
    <view class="logo-area">
      <view class="logo">
        <text class="logo-text">聊天室</text>
      </view>
    </view>

    <view class="form-area">
      <view class="form-item">
        <input
          v-model="account"
          class="input"
          type="text"
          placeholder="请输入账号"
          maxlength="20"
        />
      </view>

      <view class="form-item">
        <input
          v-model="password"
          class="input"
          type="password"
          placeholder="请输入密码"
          maxlength="20"
        />
      </view>

      <button
        class="btn-primary login-btn"
        :disabled="!canSubmit || loading"
        @click="handleLogin"
      >
        {{ loading ? '登录中...' : '登录' }}
      </button>

      <view class="register-link" @click="goRegister">
        还没有账号？<text class="link">立即注册</text>
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

const goRegister = () => {
  uni.navigateTo({ url: '/pages/register/index' })
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background-color: var(--bg-color);
  padding: 0 60rpx;
}

.logo-area {
  padding-top: 200rpx;
  display: flex;
  justify-content: center;
  margin-bottom: 100rpx;
}

.logo {
  width: 160rpx;
  height: 160rpx;
  background-color: var(--primary-color);
  border-radius: 30rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-text {
  color: #fff;
  font-size: 36rpx;
  font-weight: bold;
}

.form-area {
  background-color: var(--bg-white);
  border-radius: 16rpx;
  padding: 40rpx;
}

.form-item {
  margin-bottom: 30rpx;
}

.form-item .input {
  background-color: #f5f5f5;
  border: none;
  border-radius: 8rpx;
  padding: 28rpx 30rpx;
  font-size: 30rpx;
}

.login-btn {
  margin-top: 20rpx;
  width: 100%;
}

.register-link {
  margin-top: 40rpx;
  text-align: center;
  font-size: 28rpx;
  color: var(--text-secondary);
}

.link {
  color: var(--primary-color);
}
</style>
