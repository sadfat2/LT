<template>
  <view class="register-page">
    <view class="form-area">
      <view class="form-item">
        <text class="label">账号</text>
        <input
          v-model="account"
          class="input"
          type="text"
          placeholder="4-20位字母或数字"
          maxlength="20"
        />
        <text v-if="accountError" class="error">{{ accountError }}</text>
      </view>

      <view class="form-item">
        <text class="label">密码</text>
        <input
          v-model="password"
          class="input"
          type="password"
          placeholder="6-20位字符"
          maxlength="20"
        />
      </view>

      <view class="form-item">
        <text class="label">确认密码</text>
        <input
          v-model="confirmPassword"
          class="input"
          type="password"
          placeholder="请再次输入密码"
          maxlength="20"
        />
        <text v-if="confirmError" class="error">{{ confirmError }}</text>
      </view>

      <button
        class="btn-primary register-btn"
        :disabled="!canSubmit || loading"
        @click="handleRegister"
      >
        {{ loading ? '注册中...' : '注册' }}
      </button>

      <view class="login-link" @click="goLogin">
        已有账号？<text class="link">立即登录</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useUserStore } from '../../store/user'

const userStore = useUserStore()

const account = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)

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
    await userStore.register(account.value, password.value)
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
  background-color: var(--bg-color);
  padding: 40rpx;
}

.form-area {
  background-color: var(--bg-white);
  border-radius: 16rpx;
  padding: 40rpx;
}

.form-item {
  margin-bottom: 30rpx;
}

.label {
  display: block;
  font-size: 28rpx;
  color: var(--text-secondary);
  margin-bottom: 16rpx;
}

.form-item .input {
  background-color: #f5f5f5;
  border: none;
  border-radius: 8rpx;
  padding: 28rpx 30rpx;
  font-size: 30rpx;
}

.error {
  display: block;
  color: var(--danger-color);
  font-size: 24rpx;
  margin-top: 10rpx;
}

.register-btn {
  margin-top: 40rpx;
  width: 100%;
}

.login-link {
  margin-top: 40rpx;
  text-align: center;
  font-size: 28rpx;
  color: var(--text-secondary);
}

.link {
  color: var(--primary-color);
}
</style>
