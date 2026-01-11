<template>
  <view class="detail-page">
    <!-- 背景装饰 -->
    <view class="bg-decoration">
      <view class="orb orb-1"></view>
      <view class="orb orb-2"></view>
    </view>

    <!-- 头部导航 -->
    <view class="nav-header">
      <view class="nav-back" @click="goBack">
        <text class="back-icon">‹</text>
      </view>
      <text class="nav-title">群聊信息</text>
      <view class="nav-placeholder"></view>
    </view>

    <scroll-view class="content" scroll-y v-if="group">
      <!-- 群成员 -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">群成员 ({{ group.member_count }})</text>
          <view class="add-member-btn" @click="inviteMembers">
            <text>+ 邀请</text>
          </view>
        </view>
        <view class="member-grid">
          <view
            v-for="member in group.members?.slice(0, 15)"
            :key="member.id"
            class="member-item"
            @click="viewMember(member)"
            @longpress="showMemberActions(member)"
          >
            <view class="member-avatar-wrap">
              <image class="member-avatar" :src="member.user.avatar || '/static/images/default-avatar.svg'" mode="aspectFill" />
              <view v-if="member.role === 'owner'" class="owner-badge">👑</view>
            </view>
            <text class="member-name">{{ member.user.nickname || member.user.account }}</text>
          </view>
          <!-- 移除成员按钮（仅群主可见） -->
          <view v-if="isOwner" class="member-item" @click="enterRemoveMode">
            <view class="action-avatar remove">
              <text>−</text>
            </view>
            <text class="member-name action-text">移除</text>
          </view>
          <view v-if="group.members && group.members.length > 15" class="member-item" @click="viewAllMembers">
            <view class="action-avatar more">
              <text>···</text>
            </view>
            <text class="member-name">更多</text>
          </view>
        </view>
      </view>

      <!-- 群设置 -->
      <view class="section">
        <view class="setting-item" @click="editGroupName">
          <view class="setting-left">
            <text class="setting-icon">✏️</text>
            <text class="setting-label">群名称</text>
          </view>
          <view class="setting-right">
            <text class="setting-value">{{ group.name }}</text>
            <text class="setting-arrow">›</text>
          </view>
        </view>
      </view>

      <!-- 危险操作 -->
      <view class="section danger-section">
        <view class="danger-btn" @click="leaveGroup">
          <text class="danger-icon">🚪</text>
          <text class="danger-text">{{ isOwner ? '解散群聊' : '退出群聊' }}</text>
        </view>
      </view>
    </scroll-view>

    <!-- 加载中 -->
    <view v-else class="loading-state">
      <view class="loading-spinner"></view>
      <text class="loading-text">加载中...</text>
    </view>

    <!-- 移除成员确认弹窗 -->
    <ConfirmModal
      v-model:visible="showRemoveMemberModal"
      title="移除成员"
      :content="`确定将 ${memberToRemove?.user?.nickname || memberToRemove?.user?.account || ''} 移出群聊？`"
      icon="👤"
      type="danger"
      confirmText="移除"
      @confirm="confirmRemoveMember"
    />

    <!-- 修改群名称弹窗 -->
    <InputModal
      v-model:visible="showGroupNameModal"
      title="修改群名称"
      :value="group?.name || ''"
      placeholder="请输入新的群名称"
      :maxlength="30"
      :required="true"
      @confirm="handleGroupNameConfirm"
    />

    <!-- 退出/解散群聊确认弹窗 -->
    <ConfirmModal
      v-model:visible="showLeaveModal"
      :title="isOwner ? '解散群聊' : '退出群聊'"
      :content="isOwner ? '解散后所有成员将被移出群聊' : '退出后将不再接收群消息'"
      icon="🚪"
      type="danger"
      :confirmText="isOwner ? '解散' : '退出'"
      @confirm="confirmLeaveGroup"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useGroupStore } from '../../store/group'
import { useUserStore } from '../../store/user'
import ConfirmModal from '../../components/ConfirmModal.vue'
import InputModal from '../../components/InputModal.vue'

const groupStore = useGroupStore()
const userStore = useUserStore()

const groupId = ref(0)
const showRemoveMemberModal = ref(false)
const memberToRemove = ref<any>(null)
const showGroupNameModal = ref(false)
const showLeaveModal = ref(false)

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

// 长按成员显示操作菜单
const showMemberActions = (member: any) => {
  // 只有群主可以移除成员，且不能移除自己
  if (!isOwner.value || member.user_id === userStore.user?.id) {
    return
  }

  uni.showActionSheet({
    itemList: ['移除该成员'],
    success: (res) => {
      if (res.tapIndex === 0) {
        removeMember(member)
      }
    }
  })
}

// 移除成员 - 显示确认弹窗
const removeMember = (member: any) => {
  memberToRemove.value = member
  showRemoveMemberModal.value = true
}

// 确认移除成员
const confirmRemoveMember = async () => {
  if (!memberToRemove.value) return
  try {
    await groupStore.removeMember(groupId.value, memberToRemove.value.user_id)
    uni.showToast({ title: '已移除', icon: 'success' })
  } catch (error: any) {
    uni.showToast({ title: error.message || '移除失败', icon: 'none' })
  } finally {
    memberToRemove.value = null
  }
}

// 进入移除模式（点击移除按钮）
const enterRemoveMode = () => {
  if (!group.value?.members || group.value.members.length <= 1) {
    uni.showToast({ title: '没有可移除的成员', icon: 'none' })
    return
  }

  // 获取可移除的成员列表（排除群主自己）
  const removableMembers = group.value.members.filter(m => m.user_id !== userStore.user?.id)

  if (removableMembers.length === 0) {
    uni.showToast({ title: '没有可移除的成员', icon: 'none' })
    return
  }

  const itemList = removableMembers.map(m => m.user.nickname || m.user.account)

  uni.showActionSheet({
    itemList,
    success: (res) => {
      const member = removableMembers[res.tapIndex]
      removeMember(member)
    }
  })
}

const viewAllMembers = () => {
  // 查看所有成员
}

const editGroupName = () => {
  if (!isOwner.value) {
    uni.showToast({ title: '只有群主可以修改', icon: 'none' })
    return
  }
  showGroupNameModal.value = true
}

// 确认修改群名称
const handleGroupNameConfirm = async (value: string) => {
  try {
    await groupStore.updateGroup(groupId.value, { name: value })
    uni.showToast({ title: '修改成功', icon: 'success' })
  } catch (error) {
    uni.showToast({ title: '修改失败', icon: 'none' })
  }
}

const leaveGroup = () => {
  showLeaveModal.value = true
}

// 确认退出/解散群聊
const confirmLeaveGroup = async () => {
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

const goBack = () => {
  uni.navigateBack()
}
</script>

<style scoped>
.detail-page {
  min-height: 100vh;
  background: var(--bg-deep);
  position: relative;
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
  opacity: 0.25;
}

.orb-1 {
  width: 400rpx;
  height: 400rpx;
  background: radial-gradient(circle, rgba(168, 85, 247, 0.4) 0%, transparent 70%);
  top: -100rpx;
  right: -100rpx;
}

.orb-2 {
  width: 350rpx;
  height: 350rpx;
  background: radial-gradient(circle, rgba(34, 211, 238, 0.3) 0%, transparent 70%);
  bottom: 200rpx;
  left: -100rpx;
}

/* 导航头部 */
.nav-header {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 24rpx;
  padding-top: calc(20rpx + env(safe-area-inset-top));
  background: var(--gradient-card);
  backdrop-filter: var(--blur-lg);
  border-bottom: 1rpx solid var(--border-subtle);
}

.nav-back {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-glass);
  border: 1rpx solid var(--border-subtle);
  border-radius: var(--radius-lg);
}

.back-icon {
  font-size: 48rpx;
  color: var(--text-primary);
}

.nav-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.nav-placeholder {
  width: 72rpx;
}

/* 内容区 */
.content {
  position: relative;
  z-index: 5;
  height: calc(100vh - 120rpx - env(safe-area-inset-top));
  padding: 24rpx;
}

/* 区块 */
.section {
  background: var(--gradient-card);
  backdrop-filter: var(--blur-md);
  border: 1rpx solid var(--border-subtle);
  border-radius: var(--radius-2xl);
  margin-bottom: 24rpx;
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx;
  border-bottom: 1rpx solid var(--border-subtle);
}

.section-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 2rpx;
}

.add-member-btn {
  padding: 10rpx 24rpx;
  background: var(--gradient-primary);
  border-radius: var(--radius-lg);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: #fff;
}

/* 成员网格 */
.member-grid {
  display: flex;
  flex-wrap: wrap;
  padding: 20rpx;
}

.member-item {
  width: 20%;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 20rpx;
}

.member-avatar-wrap {
  position: relative;
}

.member-avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: var(--radius-lg);
  border: 2rpx solid var(--border-subtle);
}

.owner-badge {
  position: absolute;
  top: -10rpx;
  right: -10rpx;
  font-size: 24rpx;
}

.member-name {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin-top: 8rpx;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

.action-avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: var(--radius-lg);
  border: 2rpx dashed var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  color: var(--text-muted);
}

.action-avatar.remove {
  border-color: var(--accent-danger);
  color: var(--accent-danger);
}

.action-avatar.more {
  font-size: 28rpx;
}

.action-text {
  color: var(--accent-danger) !important;
}

/* 设置项 */
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 24rpx;
  transition: all var(--duration-fast);
}

.setting-item:active {
  background: var(--bg-glass-active);
}

.setting-left {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.setting-icon {
  font-size: 32rpx;
}

.setting-label {
  font-size: var(--text-md);
  color: var(--text-primary);
}

.setting-right {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.setting-value {
  font-size: var(--text-sm);
  color: var(--text-muted);
  max-width: 300rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.setting-arrow {
  font-size: var(--text-lg);
  color: var(--text-muted);
}

/* 危险操作 */
.danger-section {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.2);
}

.danger-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 32rpx;
  transition: all var(--duration-fast);
}

.danger-btn:active {
  background: rgba(239, 68, 68, 0.2);
}

.danger-icon {
  font-size: 32rpx;
}

.danger-text {
  font-size: var(--text-md);
  font-weight: var(--font-medium);
  color: var(--accent-danger);
}

/* 加载状态 */
.loading-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20rpx;
}

.loading-spinner {
  width: 60rpx;
  height: 60rpx;
  border: 4rpx solid var(--border-subtle);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: var(--text-sm);
  color: var(--text-muted);
}
</style>
