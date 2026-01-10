<template>
  <view class="container">
    <!-- 头部 -->
    <view class="header">
      <view class="back-btn" @click="goBack">
        <text class="iconfont">&#xe600;</text>
      </view>
      <text class="title">群聊信息</text>
      <view class="placeholder"></view>
    </view>

    <scroll-view class="content" scroll-y v-if="group">
      <!-- 群成员 -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">群成员({{ group.member_count }})</text>
          <view class="add-btn" @click="inviteMembers">
            <text>+</text>
          </view>
        </view>
        <view class="member-grid">
          <view
            v-for="member in group.members?.slice(0, 15)"
            :key="member.id"
            class="member-item"
            @click="viewMember(member)"
          >
            <image class="member-avatar" :src="member.user.avatar || '/static/default-avatar.png'" mode="aspectFill" />
            <text class="member-name">{{ member.user.nickname || member.user.account }}</text>
            <text v-if="member.role === 'owner'" class="owner-badge">群主</text>
          </view>
          <view v-if="group.members && group.members.length > 15" class="member-item more" @click="viewAllMembers">
            <view class="more-icon">
              <text>...</text>
            </view>
            <text class="member-name">更多</text>
          </view>
        </view>
      </view>

      <!-- 群名称 -->
      <view class="section">
        <view class="info-item" @click="editGroupName">
          <text class="label">群名称</text>
          <view class="value-wrap">
            <text class="value">{{ group.name }}</text>
            <text class="arrow">></text>
          </view>
        </view>
      </view>

      <!-- 操作按钮 -->
      <view class="section actions">
        <view class="action-btn danger" @click="leaveGroup">
          <text>{{ isOwner ? '解散群聊' : '退出群聊' }}</text>
        </view>
      </view>
    </scroll-view>

    <view v-else class="loading">
      <text>加载中...</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useGroupStore } from '../../store/group'
import { useUserStore } from '../../store/user'

const groupStore = useGroupStore()
const userStore = useUserStore()

const groupId = ref(0)

onMounted(() => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  groupId.value = parseInt((currentPage as any).$page?.options?.groupId || '0')

  if (groupId.value) {
    groupStore.fetchGroupDetail(groupId.value)
  }
})

const group = computed(() => groupStore.currentGroup)
const isOwner = computed(() => group.value?.owner_id === userStore.user?.id)

const inviteMembers = () => {
  uni.navigateTo({
    url: `/pages/group/invite?groupId=${groupId.value}`
  })
}

const viewMember = (member: any) => {
  if (member.user_id !== userStore.user?.id) {
    uni.navigateTo({
      url: `/pages/user-info/index?userId=${member.user_id}`
    })
  }
}

const viewAllMembers = () => {
  // 查看所有成员
}

const editGroupName = () => {
  if (!isOwner.value) {
    uni.showToast({ title: '只有群主可以修改', icon: 'none' })
    return
  }

  uni.showModal({
    title: '修改群名称',
    editable: true,
    placeholderText: '请输入新的群名称',
    success: async (res) => {
      if (res.confirm && res.content) {
        try {
          await groupStore.updateGroup(groupId.value, { name: res.content })
          uni.showToast({ title: '修改成功', icon: 'success' })
        } catch (error) {
          uni.showToast({ title: '修改失败', icon: 'none' })
        }
      }
    }
  })
}

const leaveGroup = () => {
  const title = isOwner.value ? '确定解散群聊？' : '确定退出群聊？'
  const content = isOwner.value ? '解散后所有成员将被移出群聊' : '退出后将不再接收群消息'

  uni.showModal({
    title,
    content,
    confirmColor: '#e64340',
    success: async (res) => {
      if (res.confirm) {
        try {
          if (isOwner.value) {
            await groupStore.dissolveGroup(groupId.value)
          } else {
            await groupStore.leaveGroup(groupId.value)
          }
          uni.showToast({ title: '操作成功', icon: 'success' })
          setTimeout(() => {
            uni.reLaunch({ url: '/pages/index/index' })
          }, 500)
        } catch (error: any) {
          uni.showToast({ title: error.message || '操作失败', icon: 'none' })
        }
      }
    }
  })
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

.back-btn, .placeholder {
  width: 40px;
  padding: 5px;
}

.title {
  font-size: 17px;
  font-weight: 500;
}

.content {
  flex: 1;
}

.section {
  background-color: #fff;
  margin-bottom: 10px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border-bottom: 1px solid #f5f5f5;
}

.section-title {
  font-size: 14px;
  color: #999;
}

.add-btn {
  width: 30px;
  height: 30px;
  border: 1px dashed #ddd;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 20px;
}

.member-grid {
  display: flex;
  flex-wrap: wrap;
  padding: 15px;
}

.member-item {
  width: 20%;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 15px;
  position: relative;
}

.member-avatar {
  width: 50px;
  height: 50px;
  border-radius: 4px;
}

.member-name {
  font-size: 12px;
  color: #333;
  margin-top: 5px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owner-badge {
  position: absolute;
  top: -5px;
  right: 5px;
  font-size: 10px;
  color: #fff;
  background-color: #07c160;
  padding: 1px 4px;
  border-radius: 2px;
}

.more-icon {
  width: 50px;
  height: 50px;
  border: 1px dashed #ddd;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border-bottom: 1px solid #f5f5f5;
}

.label {
  font-size: 15px;
  color: #333;
}

.value-wrap {
  display: flex;
  align-items: center;
}

.value {
  font-size: 15px;
  color: #999;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arrow {
  color: #999;
  margin-left: 5px;
}

.actions {
  margin-top: 20px;
}

.action-btn {
  padding: 15px;
  text-align: center;
  font-size: 16px;
}

.action-btn.danger {
  color: #e64340;
}

.loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
}
</style>
