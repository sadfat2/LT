<template>
  <view class="profile-page">
    <!-- 用户信息卡片 -->
    <view class="user-card">
      <view class="avatar-area" @click="changeAvatar">
        <image
          class="avatar-large"
          :src="user?.avatar || '/static/images/default-avatar.svg'"
          mode="aspectFill"
        />
        <view class="avatar-edit">
          <text class="edit-text">编辑</text>
        </view>
      </view>

      <view class="user-info">
        <view class="nickname-row" @click="editNickname">
          <text class="nickname">{{ user?.nickname || '未设置昵称' }}</text>
          <text class="arrow">></text>
        </view>
        <text class="account">账号: {{ user?.account }}</text>
      </view>
    </view>

    <!-- 签名 -->
    <view class="section">
      <view class="section-item" @click="editSignature">
        <text class="label">个性签名</text>
        <view class="value-row">
          <text class="value">{{ user?.signature || '未设置' }}</text>
          <text class="arrow">></text>
        </view>
      </view>
    </view>

    <!-- 退出登录 -->
    <view class="logout-section">
      <button class="logout-btn" @click="handleLogout">退出登录</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '../../store/user'
import { userApi } from '../../api'

const userStore = useUserStore()

const user = computed(() => userStore.user)

onShow(() => {
  if (userStore.isLoggedIn) {
    userStore.fetchProfile()
  }
})

const changeAvatar = () => {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const tempFilePath = res.tempFilePaths[0]
      try {
        const result = await userApi.uploadAvatar(tempFilePath)
        userStore.updateAvatar(result.data.url)
        uni.showToast({ title: '头像更新成功', icon: 'success' })
      } catch (error) {
        console.error('上传头像失败', error)
      }
    }
  })
}

const editNickname = () => {
  uni.showModal({
    title: '修改昵称',
    editable: true,
    placeholderText: '请输入昵称',
    content: user.value?.nickname || '',
    success: async (res) => {
      if (res.confirm && res.content) {
        try {
          await userStore.updateProfile({ nickname: res.content })
          uni.showToast({ title: '昵称更新成功', icon: 'success' })
        } catch (error) {
          console.error('更新昵称失败', error)
        }
      }
    }
  })
}

const editSignature = () => {
  uni.showModal({
    title: '修改签名',
    editable: true,
    placeholderText: '请输入个性签名',
    content: user.value?.signature || '',
    success: async (res) => {
      if (res.confirm) {
        try {
          await userStore.updateProfile({ signature: res.content || '' })
          uni.showToast({ title: '签名更新成功', icon: 'success' })
        } catch (error) {
          console.error('更新签名失败', error)
        }
      }
    }
  })
}

const handleLogout = () => {
  uni.showModal({
    title: '提示',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        userStore.logout()
      }
    }
  })
}
</script>

<style scoped>
.profile-page {
  min-height: 100vh;
  background-color: var(--bg-color);
}

.user-card {
  display: flex;
  align-items: center;
  padding: 40rpx 30rpx;
  background-color: var(--bg-white);
  margin-bottom: 20rpx;
}

.avatar-area {
  position: relative;
  margin-right: 30rpx;
}

.avatar-large {
  width: 130rpx;
  height: 130rpx;
  border-radius: 12rpx;
}

.avatar-edit {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: rgba(0, 0, 0, 0.5);
  padding: 6rpx 0;
  border-radius: 0 0 12rpx 12rpx;
}

.edit-text {
  display: block;
  text-align: center;
  color: #fff;
  font-size: 20rpx;
}

.user-info {
  flex: 1;
}

.nickname-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.nickname {
  font-size: 38rpx;
  font-weight: bold;
  color: var(--text-color);
}

.account {
  font-size: 26rpx;
  color: var(--text-secondary);
}

.arrow {
  color: var(--text-light);
  font-size: 28rpx;
}

.section {
  background-color: var(--bg-white);
  margin-bottom: 20rpx;
}

.section-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx;
  border-bottom: 1rpx solid var(--border-color);
}

.section-item:last-child {
  border-bottom: none;
}

.label {
  font-size: 30rpx;
  color: var(--text-color);
}

.value-row {
  display: flex;
  align-items: center;
}

.value {
  font-size: 28rpx;
  color: var(--text-secondary);
  margin-right: 10rpx;
  max-width: 400rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.logout-section {
  padding: 60rpx 30rpx;
}

.logout-btn {
  background-color: var(--bg-white);
  color: var(--danger-color);
  border: none;
  border-radius: 8rpx;
  padding: 24rpx 0;
  font-size: 32rpx;
}
</style>
