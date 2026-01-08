<template>
  <view class="requests-page">
    <view class="request-list">
      <view
        v-for="request in requests"
        :key="request.id"
        class="request-item"
      >
        <image
          class="avatar"
          :src="request.avatar || '/static/images/default-avatar.png'"
          mode="aspectFill"
        />
        <view class="info">
          <text class="nickname">{{ request.nickname }}</text>
          <text class="message">{{ request.message || '请求添加你为好友' }}</text>
        </view>
        <view class="actions">
          <template v-if="request.status === 'pending'">
            <button
              class="accept-btn"
              @click="handleAccept(request.id)"
            >
              同意
            </button>
            <button
              class="reject-btn"
              @click="handleReject(request.id)"
            >
              拒绝
            </button>
          </template>
          <text v-else-if="request.status === 'accepted'" class="status accepted">
            已添加
          </text>
          <text v-else-if="request.status === 'rejected'" class="status rejected">
            已拒绝
          </text>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-if="requests.length === 0" class="empty">
        <text class="empty-text">暂无好友申请</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useFriendStore } from '../../store/friend'
import type { FriendRequest } from '../../types'

const friendStore = useFriendStore()

const requests = ref<FriendRequest[]>([])

onMounted(() => {
  loadRequests()
})

onShow(() => {
  loadRequests()
})

const loadRequests = async () => {
  await friendStore.fetchRequests()
  requests.value = friendStore.receivedRequests
}

const handleAccept = async (id: number) => {
  await friendStore.acceptRequest(id)
}

const handleReject = async (id: number) => {
  await friendStore.rejectRequest(id)
}
</script>

<style scoped>
.requests-page {
  min-height: 100vh;
  background-color: var(--bg-color);
}

.request-list {
  background-color: var(--bg-white);
}

.request-item {
  display: flex;
  align-items: center;
  padding: 24rpx 30rpx;
  border-bottom: 1rpx solid var(--border-color);
}

.request-item .avatar {
  width: 88rpx;
  height: 88rpx;
  border-radius: 8rpx;
  margin-right: 24rpx;
}

.info {
  flex: 1;
}

.nickname {
  display: block;
  font-size: 32rpx;
  color: var(--text-color);
  margin-bottom: 8rpx;
}

.message {
  font-size: 26rpx;
  color: var(--text-secondary);
}

.actions {
  display: flex;
  gap: 16rpx;
}

.accept-btn {
  background-color: var(--primary-color);
  color: #fff;
  font-size: 26rpx;
  padding: 12rpx 24rpx;
  border-radius: 6rpx;
}

.reject-btn {
  background-color: #f5f5f5;
  color: var(--text-secondary);
  font-size: 26rpx;
  padding: 12rpx 24rpx;
  border-radius: 6rpx;
}

.status {
  font-size: 26rpx;
  padding: 12rpx 24rpx;
}

.status.accepted {
  color: var(--primary-color);
}

.status.rejected {
  color: var(--text-light);
}

.empty {
  padding: 100rpx 0;
}
</style>
