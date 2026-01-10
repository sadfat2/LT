<template>
  <view class="container">
    <!-- 头部 -->
    <view class="header">
      <view class="back-btn" @click="goBack">
        <text class="iconfont">&#xe600;</text>
      </view>
      <text class="title">发起群聊</text>
      <view class="confirm-btn" :class="{ disabled: !canCreate }" @click="createGroup">
        <text>确定{{ selectedCount > 0 ? `(${selectedCount})` : '' }}</text>
      </view>
    </view>

    <!-- 群名称输入 -->
    <view class="group-name-section">
      <input
        v-model="groupName"
        class="group-name-input"
        placeholder="请输入群名称"
        maxlength="20"
      />
    </view>

    <!-- 好友列表 -->
    <scroll-view class="friend-list" scroll-y>
      <view
        v-for="friend in friends"
        :key="friend.id"
        class="friend-item"
        @click="toggleSelect(friend)"
      >
        <view class="checkbox" :class="{ checked: isSelected(friend.id) }">
          <text v-if="isSelected(friend.id)" class="check-icon">&#10003;</text>
        </view>
        <image class="avatar" :src="friend.avatar || '/static/default-avatar.png'" mode="aspectFill" />
        <text class="nickname">{{ friend.remark || friend.nickname || friend.account }}</text>
      </view>
      <view v-if="friends.length === 0" class="empty">
        <text>暂无好友</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useFriendStore } from '../../store/friend'
import { useGroupStore } from '../../store/group'
import type { Friend } from '../../types'

const friendStore = useFriendStore()
const groupStore = useGroupStore()

const groupName = ref('')
const selectedIds = ref<number[]>([])

const friends = computed(() => friendStore.friends)
const selectedCount = computed(() => selectedIds.value.length)
const canCreate = computed(() => groupName.value.trim() && selectedIds.value.length > 0)

onMounted(() => {
  friendStore.fetchFriends()
})

const isSelected = (id: number) => selectedIds.value.includes(id)

const toggleSelect = (friend: Friend) => {
  const index = selectedIds.value.indexOf(friend.id)
  if (index === -1) {
    selectedIds.value.push(friend.id)
  } else {
    selectedIds.value.splice(index, 1)
  }
}

const createGroup = async () => {
  if (!canCreate.value) return

  try {
    uni.showLoading({ title: '创建中...' })
    const result = await groupStore.createGroup(groupName.value.trim(), selectedIds.value)
    uni.hideLoading()
    uni.showToast({ title: '创建成功', icon: 'success' })

    // 跳转到群聊页面
    setTimeout(() => {
      uni.redirectTo({
        url: `/pages/chat/index?conversationId=${result.conversationId}&type=group&groupId=${result.groupId}`
      })
    }, 500)
  } catch (error) {
    uni.hideLoading()
    uni.showToast({ title: '创建失败', icon: 'none' })
  }
}

const goBack = () => {
  uni.navigateBack()
}
</script>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #ededed;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 15px;
  background-color: #ededed;
  padding-top: calc(10px + var(--status-bar-height));
}

.back-btn {
  padding: 5px 10px;
}

.title {
  font-size: 17px;
  font-weight: 500;
}

.confirm-btn {
  padding: 5px 15px;
  background-color: #07c160;
  color: #fff;
  border-radius: 4px;
  font-size: 14px;
}

.confirm-btn.disabled {
  background-color: #91d5a7;
}

.group-name-section {
  padding: 15px;
  background-color: #fff;
  margin-bottom: 10px;
}

.group-name-input {
  height: 40px;
  padding: 0 10px;
  background-color: #f5f5f5;
  border-radius: 4px;
  font-size: 15px;
}

.friend-list {
  flex: 1;
  background-color: #fff;
}

.friend-item {
  display: flex;
  align-items: center;
  padding: 12px 15px;
  border-bottom: 1px solid #f5f5f5;
}

.checkbox {
  width: 22px;
  height: 22px;
  border: 2px solid #ddd;
  border-radius: 50%;
  margin-right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkbox.checked {
  background-color: #07c160;
  border-color: #07c160;
}

.check-icon {
  color: #fff;
  font-size: 14px;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  margin-right: 12px;
}

.nickname {
  font-size: 16px;
  color: #333;
}

.empty {
  padding: 50px;
  text-align: center;
  color: #999;
}
</style>
