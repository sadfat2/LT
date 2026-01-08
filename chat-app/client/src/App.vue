<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useUserStore } from './store/user'
import { useSocketStore } from './store/socket'

onLaunch(() => {
  console.log('App Launch')
  // 检查登录状态
  const userStore = useUserStore()
  userStore.checkAuth()
})

onShow(() => {
  console.log('App Show')
})

onHide(() => {
  console.log('App Hide')
})
</script>

<style>
/* 全局变量 */
page {
  --primary-color: #07C160;
  --primary-light: #95EC69;
  --bg-color: #EDEDED;
  --bg-white: #FFFFFF;
  --text-color: #333333;
  --text-secondary: #888888;
  --text-light: #BBBBBB;
  --border-color: #E5E5E5;
  --danger-color: #FA5151;

  background-color: var(--bg-color);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 28rpx;
  color: var(--text-color);
  height: 100%;
}

/* 通用样式 */
.container {
  padding: 30rpx;
}

.flex {
  display: flex;
}

.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

.flex-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.flex-1 {
  flex: 1;
}

/* 按钮样式 */
.btn-primary {
  background-color: var(--primary-color);
  color: #fff;
  border: none;
  border-radius: 8rpx;
  padding: 24rpx 0;
  font-size: 32rpx;
  text-align: center;
}

.btn-primary:active {
  background-color: #06AD56;
}

.btn-primary[disabled] {
  background-color: #91D5A7;
}

/* 输入框样式 */
.input {
  background-color: var(--bg-white);
  border: 1rpx solid var(--border-color);
  border-radius: 8rpx;
  padding: 24rpx 30rpx;
  font-size: 32rpx;
}

.input:focus {
  border-color: var(--primary-color);
}

/* 列表项样式 */
.list-item {
  display: flex;
  align-items: center;
  background-color: var(--bg-white);
  padding: 24rpx 30rpx;
  border-bottom: 1rpx solid var(--border-color);
}

.list-item:active {
  background-color: #F5F5F5;
}

/* 头像样式 */
.avatar {
  width: 88rpx;
  height: 88rpx;
  border-radius: 8rpx;
  background-color: var(--bg-color);
}

.avatar-small {
  width: 64rpx;
  height: 64rpx;
  border-radius: 6rpx;
}

.avatar-large {
  width: 120rpx;
  height: 120rpx;
  border-radius: 10rpx;
}

/* 红点样式 */
.badge {
  background-color: var(--danger-color);
  color: #fff;
  font-size: 22rpx;
  padding: 4rpx 12rpx;
  border-radius: 20rpx;
  min-width: 36rpx;
  text-align: center;
}

.dot {
  width: 16rpx;
  height: 16rpx;
  background-color: var(--danger-color);
  border-radius: 50%;
}

/* 空状态 */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100rpx 0;
  color: var(--text-light);
}

.empty-text {
  margin-top: 20rpx;
  font-size: 28rpx;
}
</style>
