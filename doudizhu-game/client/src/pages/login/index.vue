<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/store/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const isLogin = ref(true)
const loading = ref(false)
const errorMsg = ref('')

const form = ref({
  account: '',
  password: '',
  nickname: '',
})

const toggleMode = () => {
  isLogin.value = !isLogin.value
  errorMsg.value = ''
}

const handleSubmit = async () => {
  if (!form.value.account || !form.value.password) {
    errorMsg.value = '请填写账号和密码'
    return
  }

  if (!isLogin.value && !form.value.nickname) {
    errorMsg.value = '请填写昵称'
    return
  }

  loading.value = true
  errorMsg.value = ''

  try {
    if (isLogin.value) {
      await userStore.login(form.value.account, form.value.password)
    } else {
      await userStore.register(form.value.account, form.value.password, form.value.nickname)
    }

    const redirect = route.query.redirect as string || '/'
    router.push(redirect)
  } catch (error) {
    errorMsg.value = error instanceof Error ? error.message : '操作失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-header">
        <h1>斗地主</h1>
        <p>{{ isLogin ? '欢迎回来' : '创建新账号' }}</p>
      </div>

      <form class="login-form" @submit.prevent="handleSubmit">
        <div class="form-item">
          <input
            v-model="form.account"
            type="text"
            placeholder="请输入账号"
            :disabled="loading"
          />
        </div>

        <div class="form-item">
          <input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            :disabled="loading"
          />
        </div>

        <div v-if="!isLogin" class="form-item">
          <input
            v-model="form.nickname"
            type="text"
            placeholder="请输入昵称"
            :disabled="loading"
          />
        </div>

        <div v-if="errorMsg" class="error-msg">
          {{ errorMsg }}
        </div>

        <button type="submit" class="submit-btn" :disabled="loading">
          {{ loading ? '处理中...' : (isLogin ? '登录' : '注册') }}
        </button>
      </form>

      <div class="login-footer">
        <span>{{ isLogin ? '没有账号？' : '已有账号？' }}</span>
        <a href="#" @click.prevent="toggleMode">
          {{ isLogin ? '立即注册' : '立即登录' }}
        </a>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.login-page {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, $bg-primary 0%, $bg-dark 100%);
}

.login-container {
  width: 360px;
  padding: $spacing-xl;
  background: $bg-card;
  border-radius: $border-radius-lg;
  box-shadow: $box-shadow-lg;
}

.login-header {
  text-align: center;
  margin-bottom: $spacing-xl;

  h1 {
    font-size: 32px;
    color: $primary-color;
    margin-bottom: $spacing-sm;
  }

  p {
    color: $text-secondary;
  }
}

.login-form {
  .form-item {
    margin-bottom: $spacing-md;

    input {
      width: 100%;
      height: 48px;
      padding: 0 $spacing-md;
      border: 1px solid $border-color;
      border-radius: $border-radius;
      font-size: $font-size-base;
      transition: border-color $transition-fast;

      &:focus {
        border-color: $primary-color;
      }

      &:disabled {
        background: $bg-light;
      }
    }
  }

  .error-msg {
    color: $danger-color;
    font-size: $font-size-sm;
    margin-bottom: $spacing-md;
  }

  .submit-btn {
    width: 100%;
    height: 48px;
    background: $primary-color;
    color: $text-light;
    border-radius: $border-radius;
    font-size: $font-size-lg;
    font-weight: 500;
    transition: background $transition-fast;

    &:hover:not(:disabled) {
      background: darken($primary-color, 10%);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
}

.login-footer {
  text-align: center;
  margin-top: $spacing-lg;
  color: $text-secondary;

  a {
    color: $primary-color;
    margin-left: $spacing-xs;
  }
}
</style>
