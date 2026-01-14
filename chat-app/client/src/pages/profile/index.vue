<template>
  <view class="profile-page">
    <!-- 背景装饰 -->
    <view class="bg-decoration">
      <view class="orb orb-1"></view>
      <view class="orb orb-2"></view>
      <view class="orb orb-3"></view>
    </view>

    <!-- 页面头部 -->
    <view class="page-header">
      <text class="page-title">我</text>
    </view>

    <!-- 用户信息卡片 -->
    <view class="user-card">
      <view class="user-card-bg"></view>
      <view class="user-card-content">
        <view class="avatar-section" @click="changeAvatar">
          <view class="avatar-container">
            <image
              class="user-avatar"
              :src="user?.avatar || '/static/images/default-avatar.svg'"
              mode="aspectFill"
            />
            <view class="avatar-edit">
              <text class="edit-icon">✏️</text>
            </view>
          </view>
        </view>
        <view class="user-info">
          <view class="nickname-row" @click="editNickname">
            <text class="nickname">{{ user?.nickname || '未设置昵称' }}</text>
            <text class="edit-arrow">›</text>
          </view>
          <view class="account-row">
            <text class="account-label">账号</text>
            <text class="account-value">{{ user?.account }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 个性签名 -->
    <view class="section">
      <view class="section-title">
        <text>个性签名</text>
      </view>
      <view class="section-card">
        <view class="section-item" @click="editSignature">
          <view class="item-content">
            <text class="item-icon">💭</text>
            <text class="item-text">{{ user?.signature || '点击设置个性签名' }}</text>
          </view>
          <text class="item-arrow">›</text>
        </view>
      </view>
    </view>

    <!-- 设置区域 -->
    <view class="section">
      <view class="section-title">
        <text>设置</text>
      </view>
      <view class="section-card">
        <view class="section-item" @click="openPasswordModal">
          <view class="item-content">
            <text class="item-icon">🔐</text>
            <text class="item-label">修改密码</text>
          </view>
          <text class="item-arrow">›</text>
        </view>
        <view class="section-item">
          <view class="item-content">
            <text class="item-icon">🔔</text>
            <text class="item-label">消息通知</text>
          </view>
          <switch
            class="item-switch"
            :checked="notificationEnabled"
            @change="toggleNotification"
            color="#a855f7"
          />
        </view>
        <view class="section-item">
          <view class="item-content">
            <text class="item-icon">🌙</text>
            <text class="item-label">深色模式</text>
          </view>
          <view class="item-badge">已启用</view>
        </view>
        <view class="section-item">
          <view class="item-content">
            <text class="item-icon">ℹ️</text>
            <text class="item-label">关于</text>
          </view>
          <text class="item-version">v1.0.0</text>
        </view>
      </view>
    </view>

    <!-- 退出登录 -->
    <view class="logout-section">
      <button class="logout-btn" @click="handleLogout">
        <text class="logout-icon">🚪</text>
        <text class="logout-text">退出登录</text>
      </button>
    </view>

    <!-- 底部版权 -->
    <view class="footer">
      <text class="footer-text">Nebula Chat © 2024</text>
    </view>

    <!-- 自定义底部导航 -->
    <CustomTabBar :current="2" />

    <!-- 修改昵称弹窗 -->
    <InputModal
      v-model:visible="showNicknameModal"
      title="修改昵称"
      :value="user?.nickname || ''"
      placeholder="请输入昵称"
      :maxlength="20"
      :required="true"
      @confirm="handleNicknameConfirm"
    />

    <!-- 修改签名弹窗 -->
    <InputModal
      v-model:visible="showSignatureModal"
      title="修改签名"
      :value="user?.signature || ''"
      placeholder="请输入个性签名"
      :maxlength="50"
      @confirm="handleSignatureConfirm"
    />

    <!-- 退出登录确认弹窗 -->
    <ConfirmModal
      v-model:visible="showLogoutModal"
      title="退出登录"
      content="确定要退出登录吗？"
      icon="🚪"
      type="danger"
      confirmText="退出"
      @confirm="confirmLogout"
    />

    <!-- 修改密码弹窗 -->
    <PasswordModal
      ref="passwordModalRef"
      v-model:visible="showPasswordModal"
      @confirm="handlePasswordConfirm"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '../../store/user'
import { userApi } from '../../api'
import CustomTabBar from '../../components/CustomTabBar.vue'
import InputModal from '../../components/InputModal.vue'
import ConfirmModal from '../../components/ConfirmModal.vue'
import PasswordModal from '../../components/PasswordModal.vue'

const userStore = useUserStore()

const user = computed(() => userStore.user)
const notificationEnabled = ref(true)
const showNicknameModal = ref(false)
const showSignatureModal = ref(false)
const showLogoutModal = ref(false)
const showPasswordModal = ref(false)
const passwordModalRef = ref<InstanceType<typeof PasswordModal> | null>(null)

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
  showNicknameModal.value = true
}

const handleNicknameConfirm = async (value: string) => {
  try {
    await userStore.updateProfile({ nickname: value })
    uni.showToast({ title: '昵称已更新', icon: 'success' })
  } catch (error) {
    console.error('更新昵称失败', error)
    uni.showToast({ title: '更新失败', icon: 'none' })
  }
}

const editSignature = () => {
  showSignatureModal.value = true
}

const handleSignatureConfirm = async (value: string) => {
  try {
    await userStore.updateProfile({ signature: value })
    uni.showToast({ title: '签名已更新', icon: 'success' })
  } catch (error) {
    console.error('更新签名失败', error)
    uni.showToast({ title: '更新失败', icon: 'none' })
  }
}

const toggleNotification = (e: any) => {
  notificationEnabled.value = e.detail.value
  uni.showToast({
    title: notificationEnabled.value ? '已开启通知' : '已关闭通知',
    icon: 'none'
  })
}

const handleLogout = () => {
  showLogoutModal.value = true
}

const confirmLogout = () => {
  userStore.logout()
}

const openPasswordModal = () => {
  showPasswordModal.value = true
}

const handlePasswordConfirm = async (data: { oldPassword: string; newPassword: string }) => {
  try {
    await userApi.changePassword(data.oldPassword, data.newPassword)
    showPasswordModal.value = false
    uni.showToast({ title: '密码修改成功', icon: 'success' })
  } catch (error: any) {
    passwordModalRef.value?.setLoading(false)
    const message = error?.response?.data?.message || '修改失败，请重试'
    uni.showToast({ title: message, icon: 'none' })
  }
}
</script>

<style scoped>
.profile-page {
  min-height: 100vh;
  background: var(--bg-deep);
  position: relative;
  padding-bottom: calc(110rpx + env(safe-area-inset-bottom));
}

/* 背景装饰 */
.bg-decoration {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(100rpx);
}

.orb-1 {
  width: 500rpx;
  height: 500rpx;
  background: radial-gradient(circle, rgba(168, 85, 247, 0.3) 0%, transparent 70%);
  top: -150rpx;
  left: 50%;
  transform: translateX(-50%);
  opacity: 0.5;
}

.orb-2 {
  width: 300rpx;
  height: 300rpx;
  background: radial-gradient(circle, rgba(236, 72, 153, 0.25) 0%, transparent 70%);
  top: 400rpx;
  right: -100rpx;
  opacity: 0.4;
}

.orb-3 {
  width: 250rpx;
  height: 250rpx;
  background: radial-gradient(circle, rgba(34, 211, 238, 0.2) 0%, transparent 70%);
  bottom: 200rpx;
  left: -80rpx;
  opacity: 0.4;
}

/* 页面头部 */
.page-header {
  position: relative;
  z-index: 10;
  padding: 0 32rpx;
  padding-top: calc(env(safe-area-inset-top) + 20rpx);
  height: calc(100rpx + env(safe-area-inset-top));
  display: flex;
  align-items: center;
}

.page-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
}

/* 用户信息卡片 */
.user-card {
  position: relative;
  z-index: 5;
  margin: 0 24rpx 32rpx;
  border-radius: var(--radius-2xl);
  overflow: hidden;
}

.user-card-bg {
  position: absolute;
  inset: 0;
  background: var(--gradient-primary);
  opacity: 0.15;
}

.user-card-content {
  position: relative;
  display: flex;
  align-items: center;
  padding: 40rpx 32rpx;
  background: var(--gradient-card);
  backdrop-filter: var(--blur-lg);
  border: 1rpx solid var(--border-subtle);
  border-radius: var(--radius-2xl);
}

.avatar-section {
  margin-right: 28rpx;
}

.avatar-container {
  position: relative;
}

.user-avatar {
  width: 140rpx;
  height: 140rpx;
  border-radius: var(--radius-2xl);
  border: 3rpx solid var(--border-accent);
  box-shadow: 0 0 30rpx rgba(168, 85, 247, 0.3);
}

.avatar-edit {
  position: absolute;
  bottom: -8rpx;
  right: -8rpx;
  width: 48rpx;
  height: 48rpx;
  background: var(--gradient-primary);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3rpx solid var(--bg-deep);
}

.edit-icon {
  font-size: 20rpx;
}

.user-info {
  flex: 1;
}

.nickname-row {
  display: flex;
  align-items: center;
  margin-bottom: 12rpx;
}

.nickname {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin-right: 8rpx;
}

.edit-arrow {
  font-size: var(--text-lg);
  color: var(--text-muted);
}

.account-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.account-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
  padding: 4rpx 12rpx;
  background: var(--bg-glass);
  border-radius: var(--radius-sm);
}

.account-value {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-family: var(--font-mono);
}

/* 区块样式 */
.section {
  position: relative;
  z-index: 5;
  margin: 0 24rpx 24rpx;
}

.section-title {
  padding: 0 12rpx 16rpx;
}

.section-title text {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 2rpx;
}

.section-card {
  background: var(--gradient-card);
  backdrop-filter: var(--blur-md);
  border: 1rpx solid var(--border-subtle);
  border-radius: var(--radius-xl);
  overflow: hidden;
}

.section-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 24rpx;
  border-bottom: 1rpx solid var(--border-subtle);
  transition: all var(--duration-fast);
}

.section-item:last-child {
  border-bottom: none;
}

.section-item:active {
  background: var(--bg-glass-active);
}

.item-content {
  display: flex;
  align-items: center;
  flex: 1;
  overflow: hidden;
}

.item-icon {
  font-size: 36rpx;
  margin-right: 20rpx;
}

.item-label {
  font-size: var(--text-md);
  color: var(--text-primary);
}

.item-text {
  font-size: var(--text-md);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-arrow {
  font-size: var(--text-xl);
  color: var(--text-muted);
}

.item-switch {
  transform: scale(0.85);
}

.item-badge {
  font-size: var(--text-xs);
  color: var(--accent-success);
  padding: 6rpx 16rpx;
  background: rgba(16, 185, 129, 0.15);
  border-radius: var(--radius-full);
}

.item-version {
  font-size: var(--text-sm);
  color: var(--text-muted);
  font-family: var(--font-mono);
}

/* 退出登录 */
.logout-section {
  position: relative;
  z-index: 5;
  padding: 32rpx 24rpx;
}

.logout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  width: 100%;
  height: 96rpx;
  background: rgba(239, 68, 68, 0.1);
  border: 1rpx solid rgba(239, 68, 68, 0.2);
  border-radius: var(--radius-xl);
  transition: all var(--duration-fast);
}

.logout-btn:active {
  background: rgba(239, 68, 68, 0.2);
  transform: scale(0.98);
}

.logout-icon {
  font-size: 32rpx;
}

.logout-text {
  font-size: var(--text-md);
  font-weight: var(--font-medium);
  color: var(--accent-danger);
}

/* 底部版权 */
.footer {
  position: relative;
  z-index: 5;
  padding: 40rpx;
  text-align: center;
}

.footer-text {
  font-size: var(--text-xs);
  color: var(--text-muted);
  letter-spacing: 1rpx;
}
</style>
