<template>
  <view class="add-friend-page">
    <!-- 搜索框 -->
    <view class="search-bar">
      <input
        v-model="keyword"
        class="search-input"
        type="text"
        placeholder="输入账号搜索"
        confirm-type="search"
        @confirm="handleSearch"
      />
      <button class="search-btn" @click="handleSearch">搜索</button>
    </view>

    <!-- 搜索结果 -->
    <view class="result-list">
      <view
        v-for="user in searchResults"
        :key="user.id"
        class="user-item"
      >
        <image
          class="avatar"
          :src="user.avatar || '/static/images/default-avatar.png'"
          mode="aspectFill"
        />
        <view class="info">
          <text class="nickname">{{ user.nickname }}</text>
          <text class="account">账号: {{ user.account }}</text>
        </view>
        <button
          class="add-btn"
          :disabled="addingId === user.id"
          @click="handleAdd(user)"
        >
          {{ addingId === user.id ? '发送中' : '添加' }}
        </button>
      </view>

      <!-- 空状态 -->
      <view v-if="searched && searchResults.length === 0" class="empty">
        <text class="empty-text">未找到相关用户</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { userApi } from '../../api'
import { useFriendStore } from '../../store/friend'
import type { User } from '../../types'

const friendStore = useFriendStore()

const keyword = ref('')
const searchResults = ref<User[]>([])
const searched = ref(false)
const addingId = ref<number | null>(null)

const handleSearch = async () => {
  if (!keyword.value.trim()) {
    uni.showToast({ title: '请输入搜索内容', icon: 'none' })
    return
  }

  try {
    const res = await userApi.search(keyword.value.trim())
    searchResults.value = res.data
    searched.value = true
  } catch (error) {
    console.error('搜索失败', error)
  }
}

const handleAdd = async (user: User) => {
  addingId.value = user.id

  try {
    await friendStore.sendRequest(user.id)
  } catch (error) {
    console.error('发送申请失败', error)
  } finally {
    addingId.value = null
  }
}
</script>

<style scoped>
.add-friend-page {
  min-height: 100vh;
  background-color: var(--bg-color);
}

.search-bar {
  display: flex;
  padding: 20rpx;
  background-color: var(--bg-white);
}

.search-input {
  flex: 1;
  background-color: #f5f5f5;
  border: none;
  border-radius: 8rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
}

.search-btn {
  background-color: var(--primary-color);
  color: #fff;
  font-size: 28rpx;
  padding: 0 30rpx;
  margin-left: 20rpx;
  border-radius: 8rpx;
}

.result-list {
  margin-top: 20rpx;
}

.user-item {
  display: flex;
  align-items: center;
  padding: 24rpx 30rpx;
  background-color: var(--bg-white);
  border-bottom: 1rpx solid var(--border-color);
}

.user-item .avatar {
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

.account {
  font-size: 26rpx;
  color: var(--text-secondary);
}

.add-btn {
  background-color: var(--primary-color);
  color: #fff;
  font-size: 26rpx;
  padding: 12rpx 30rpx;
  border-radius: 6rpx;
}

.add-btn[disabled] {
  background-color: #91D5A7;
}

.empty {
  padding: 100rpx 0;
}
</style>
