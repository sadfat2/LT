<template>
  <view class="container">
    <!-- 头部 -->
    <view class="header">
      <view class="back-btn" @click="goBack">
        <text class="back-icon">‹</text>
      </view>
      <text class="title">邀请成员</text>
      <view class="confirm-btn" :class="{ disabled: selectedIds.length === 0 }" @click="inviteMembers">
        <text>确定{{ selectedIds.length > 0 ? `(${selectedIds.length})` : '' }}</text>
      </view>
    </view>

    <!-- 好友列表（排除已在群内的成员） -->
    <scroll-view class="friend-list" scroll-y>
      <view
        v-for="friend in availableFriends"
        :key="friend.id"
        class="friend-item"
        @click="toggleSelect(friend)"
      >
        <view class="checkbox" :class="{ checked: isSelected(friend.id) }">
          <text v-if="isSelected(friend.id)" class="check-icon">&#10003;</text>
        </view>
        <image class="avatar" :src="friend.avatar || '/static/images/default-avatar.svg'" mode="aspectFill" />
        <text class="nickname">{{ friend.remark || friend.nickname || friend.account }}</text>
      </view>
      <view v-if="availableFriends.length === 0" class="empty">
        <text>没有可邀请的好友</text>
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

const groupId = ref(0)
const selectedIds = ref<number[]>([])

// 已在群内的成员 ID 列表
const existingMemberIds = computed(() => {
  return groupStore.currentGroup?.members?.map(m => m.user_id) || []
})

// 可邀请的好友（排除已在群内的）
const availableFriends = computed(() => {
  return friendStore.friends.filter(f => !existingMemberIds.value.includes(f.id))
})

onMounted(async () => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  groupId.value = parseInt((currentPage as any).$page?.options?.groupId || '0')

  // 确保好友列表和群详情已加载
  await Promise.all([
    friendStore.fetchFriends(),
    groupId.value ? groupStore.fetchGroupDetail(groupId.value) : Promise.resolve()
  ])
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

const inviteMembers = async () => {
  if (selectedIds.value.length === 0) return

  try {
    uni.showLoading({ title: '邀请中...' })
    await groupStore.inviteMembers(groupId.value, selectedIds.value)
    uni.hideLoading()
    uni.showToast({ title: '邀请成功', icon: 'success' })

    setTimeout(() => {
      uni.navigateBack()
    }, 500)
  } catch (error: any) {
    uni.hideLoading()
    uni.showToast({ title: error.message || '邀请失败', icon: 'none' })
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
  padding-top: calc(10px + env(safe-area-inset-top));
}

.back-btn {
  padding: 5px 10px;
}

.back-icon {
  font-size: 28px;
  color: #333;
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
