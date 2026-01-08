<template>
  <view class="user-info-page">
    <view class="user-card">
      <image
        class="avatar-large"
        :src="user?.avatar || '/static/images/default-avatar.png'"
        mode="aspectFill"
      />
      <view class="info">
        <text class="nickname">{{ user?.nickname }}</text>
        <text class="account">账号: {{ user?.account }}</text>
        <text v-if="user?.signature" class="signature">{{ user.signature }}</text>
      </view>
    </view>

    <view class="actions">
      <button
        v-if="isFriend"
        class="btn-primary chat-btn"
        @click="goChat"
      >
        发消息
      </button>
      <button
        v-else
        class="btn-primary add-btn"
        :disabled="adding"
        @click="handleAdd"
      >
        {{ adding ? '发送中...' : '添加好友' }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { userApi } from '../../api'
import { useFriendStore } from '../../store/friend'
import { useConversationStore } from '../../store/conversation'
import type { User } from '../../types'

const friendStore = useFriendStore()
const conversationStore = useConversationStore()

const userId = ref<number>(0)
const isFriend = ref(false)
const user = ref<User | null>(null)
const adding = ref(false)

onLoad((options) => {
  if (options?.userId) {
    userId.value = parseInt(options.userId)
  }
  if (options?.isFriend === 'true') {
    isFriend.value = true
  }
})

onMounted(async () => {
  // 从好友列表中获取用户信息
  const friend = friendStore.friends.find(f => f.id === userId.value)
  if (friend) {
    user.value = friend
  } else {
    // 搜索用户
    try {
      const res = await userApi.search(String(userId.value))
      if (res.data.length > 0) {
        user.value = res.data[0]
      }
    } catch (error) {
      console.error('获取用户信息失败', error)
    }
  }
})

const goChat = async () => {
  if (!user.value) return

  const conversationId = await conversationStore.createPrivate(userId.value)
  uni.navigateTo({
    url: `/pages/chat/index?conversationId=${conversationId}&userId=${userId.value}&nickname=${user.value.nickname}`
  })
}

const handleAdd = async () => {
  adding.value = true
  try {
    await friendStore.sendRequest(userId.value)
  } finally {
    adding.value = false
  }
}
</script>

<style scoped>
.user-info-page {
  min-height: 100vh;
  background-color: var(--bg-color);
}

.user-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 30rpx;
  background-color: var(--bg-white);
  margin-bottom: 20rpx;
}

.avatar-large {
  width: 160rpx;
  height: 160rpx;
  border-radius: 16rpx;
  margin-bottom: 30rpx;
}

.info {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.nickname {
  font-size: 40rpx;
  font-weight: bold;
  color: var(--text-color);
  margin-bottom: 16rpx;
}

.account {
  font-size: 28rpx;
  color: var(--text-secondary);
  margin-bottom: 12rpx;
}

.signature {
  font-size: 26rpx;
  color: var(--text-secondary);
  text-align: center;
  max-width: 500rpx;
}

.actions {
  padding: 40rpx 60rpx;
}

.chat-btn,
.add-btn {
  width: 100%;
}
</style>
