<template>
  <view class="user-info-page">
    <view class="user-card">
      <image
        class="avatar-large"
        :src="user?.avatar || '/static/images/default-avatar.svg'"
        mode="aspectFill"
      />
      <view class="info">
        <text class="nickname">{{ user?.nickname }}</text>
        <text v-if="friendInfo?.remark" class="remark">备注: {{ friendInfo.remark }}</text>
        <text class="account">账号: {{ user?.account }}</text>
        <text v-if="user?.signature" class="signature">{{ user.signature }}</text>
      </view>
    </view>

    <!-- 好友设置区域 -->
    <view v-if="isFriend" class="settings-section">
      <view class="settings-item" @click="editRemark">
        <text class="label">设置备注</text>
        <view class="value-row">
          <text class="value">{{ friendInfo?.remark || '未设置' }}</text>
          <text class="arrow">></text>
        </view>
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
import { ref, computed, onMounted } from 'vue'
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

// 获取好友信息（包含备注）
const friendInfo = computed(() => {
  return friendStore.friends.find(f => f.id === userId.value)
})

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

  // 导航时使用备注名（如果有）
  const displayName = friendInfo.value?.remark || user.value.nickname
  const conversationId = await conversationStore.createPrivate(userId.value)
  uni.navigateTo({
    url: `/pages/chat/index?conversationId=${conversationId}&userId=${userId.value}&nickname=${encodeURIComponent(displayName)}&avatar=${encodeURIComponent(user.value.avatar || '')}`
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

// 编辑备注
const editRemark = () => {
  uni.showModal({
    title: '设置备注',
    editable: true,
    placeholderText: '请输入备注名称',
    content: friendInfo.value?.remark || '',
    success: async (res) => {
      if (res.confirm) {
        try {
          await friendStore.updateRemark(userId.value, res.content || '')
        } catch (error) {
          console.error('更新备注失败', error)
        }
      }
    }
  })
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

.remark {
  font-size: 26rpx;
  color: var(--primary-color);
  margin-bottom: 8rpx;
}

.signature {
  font-size: 26rpx;
  color: var(--text-secondary);
  text-align: center;
  max-width: 500rpx;
}

.settings-section {
  background-color: var(--bg-white);
  margin-bottom: 20rpx;
}

.settings-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx;
}

.settings-item:active {
  background-color: #f5f5f5;
}

.settings-item .label {
  font-size: 30rpx;
  color: var(--text-color);
}

.settings-item .value-row {
  display: flex;
  align-items: center;
}

.settings-item .value {
  font-size: 28rpx;
  color: var(--text-secondary);
  margin-right: 10rpx;
}

.settings-item .arrow {
  color: var(--text-light);
  font-size: 28rpx;
}

.actions {
  padding: 40rpx 60rpx;
}

.chat-btn,
.add-btn {
  width: 100%;
}
</style>
