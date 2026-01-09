<template>
  <view class="contacts-page">
    <!-- 功能入口 -->
    <view class="function-list">
      <view class="function-item" @click="goAddFriend">
        <view class="icon add-icon">
          <text class="icon-text">+</text>
        </view>
        <text class="function-name">添加好友</text>
      </view>

      <view class="function-item" @click="goFriendRequests">
        <view class="icon request-icon">
          <text class="icon-text">新</text>
        </view>
        <text class="function-name">新的朋友</text>
        <view v-if="pendingCount > 0" class="badge">
          {{ pendingCount > 99 ? '99+' : pendingCount }}
        </view>
      </view>
    </view>

    <!-- 好友列表 -->
    <scroll-view scroll-y class="friend-list">
      <template v-for="(friends, letter) in groupedFriends" :key="letter">
        <view class="letter-header" :id="`letter-${letter}`">
          {{ letter }}
        </view>
        <view
          v-for="friend in friends"
          :key="friend.id"
          class="friend-item"
          @click="goUserInfo(friend)"
        >
          <image
            class="avatar"
            :src="friend.avatar || '/static/images/default-avatar.svg'"
            mode="aspectFill"
          />
          <text class="name">{{ friend.remark || friend.nickname }}</text>
        </view>
      </template>

      <!-- 空状态 -->
      <view v-if="!loading && Object.keys(groupedFriends).length === 0" class="empty">
        <text class="empty-text">暂无好友</text>
      </view>
    </scroll-view>

    <!-- 字母索引 -->
    <view class="letter-index">
      <text
        v-for="letter in letters"
        :key="letter"
        class="letter"
        @click="scrollToLetter(letter)"
      >
        {{ letter }}
      </text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useFriendStore } from '../../store/friend'
import { useUserStore } from '../../store/user'
import type { Friend } from '../../types'

const friendStore = useFriendStore()
const userStore = useUserStore()

const loading = ref(false)

const groupedFriends = computed(() => friendStore.groupedFriends)
const pendingCount = computed(() => friendStore.pendingCount)

const letters = computed(() => {
  const keys = Object.keys(groupedFriends.value).sort()
  return keys.filter(k => /^[A-Z]$/.test(k)).concat(keys.filter(k => k === '#'))
})

onMounted(() => {
  if (!userStore.isLoggedIn) {
    return
  }
  friendStore.initSocketListeners()
})

onShow(() => {
  if (userStore.isLoggedIn) {
    loadData()
  }
})

const loadData = async () => {
  loading.value = true
  try {
    await Promise.all([
      friendStore.fetchFriends(),
      friendStore.fetchPendingCount()
    ])
  } finally {
    loading.value = false
  }
}

const goAddFriend = () => {
  uni.navigateTo({ url: '/pages/add-friend/index' })
}

const goFriendRequests = () => {
  uni.navigateTo({ url: '/pages/friend-requests/index' })
}

const goUserInfo = (friend: Friend) => {
  uni.navigateTo({
    url: `/pages/user-info/index?userId=${friend.id}&isFriend=true`
  })
}

const scrollToLetter = (letter: string) => {
  uni.pageScrollTo({
    selector: `#letter-${letter}`,
    duration: 100
  })
}
</script>

<style scoped>
.contacts-page {
  min-height: 100vh;
  background-color: var(--bg-color);
  position: relative;
}

.function-list {
  background-color: var(--bg-white);
  margin-bottom: 20rpx;
}

.function-item {
  display: flex;
  align-items: center;
  padding: 24rpx 30rpx;
  border-bottom: 1rpx solid var(--border-color);
}

.function-item:active {
  background-color: #f5f5f5;
}

.icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 24rpx;
}

.add-icon {
  background-color: #fa9d3b;
}

.request-icon {
  background-color: #fa9d3b;
}

.icon-text {
  color: #fff;
  font-size: 36rpx;
  font-weight: bold;
}

.function-name {
  flex: 1;
  font-size: 32rpx;
  color: var(--text-color);
}

.friend-list {
  height: calc(100vh - 240rpx);
}

.letter-header {
  padding: 10rpx 30rpx;
  background-color: var(--bg-color);
  font-size: 26rpx;
  color: var(--text-secondary);
}

.friend-item {
  display: flex;
  align-items: center;
  padding: 20rpx 30rpx;
  background-color: var(--bg-white);
  border-bottom: 1rpx solid var(--border-color);
}

.friend-item:active {
  background-color: #f5f5f5;
}

.friend-item .avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 8rpx;
  margin-right: 24rpx;
}

.friend-item .name {
  font-size: 32rpx;
  color: var(--text-color);
}

.letter-index {
  position: fixed;
  right: 10rpx;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10rpx;
}

.letter {
  font-size: 22rpx;
  color: var(--text-secondary);
  padding: 6rpx 0;
}

.letter:active {
  color: var(--primary-color);
}

.empty {
  padding: 100rpx 0;
}
</style>
