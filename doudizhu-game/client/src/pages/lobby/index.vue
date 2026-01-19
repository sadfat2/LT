<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'
import { useSocketStore } from '@/store/socket'
import { useRoomStore } from '@/store/room'
import { useGameStore } from '@/store/game'
import api from '@/api'
import type { CheckinStatus } from '@/types'

const router = useRouter()
const userStore = useUserStore()
const socketStore = useSocketStore()
const roomStore = useRoomStore()
const gameStore = useGameStore()

const checkinStatus = ref<CheckinStatus | null>(null)
const showCreateRoom = ref(false)
const showReconnectDialog = ref(false)
const reconnectRemainingTime = ref(0)
const isReconnecting = ref(false)

const newRoom = ref({
  name: '',
  baseScore: 100,
})

// 刷新间隔
let refreshInterval: ReturnType<typeof setInterval> | null = null
let reconnectCountdown: ReturnType<typeof setInterval> | null = null

// 检查未完成的游戏
const checkPendingGame = async () => {
  if (!socketStore.isConnected) return

  try {
    const result = await gameStore.checkPendingGame()
    if (result.hasPendingGame && result.remainingTime && result.remainingTime > 0) {
      reconnectRemainingTime.value = result.remainingTime
      showReconnectDialog.value = true

      // 开始倒计时
      startReconnectCountdown()
    }
  } catch (error) {
    console.error('检查未完成游戏失败:', error)
  }
}

// 开始重连倒计时
const startReconnectCountdown = () => {
  if (reconnectCountdown) {
    clearInterval(reconnectCountdown)
  }

  reconnectCountdown = setInterval(() => {
    reconnectRemainingTime.value--
    if (reconnectRemainingTime.value <= 0) {
      // 超时，关闭对话框
      showReconnectDialog.value = false
      gameStore.clearPendingGame()
      if (reconnectCountdown) {
        clearInterval(reconnectCountdown)
        reconnectCountdown = null
      }
    }
  }, 1000)
}

// 处理重连
const handleReconnect = async () => {
  if (isReconnecting.value) return

  isReconnecting.value = true
  try {
    const result = await gameStore.reconnectToGame()
    if (result.success && result.roomId) {
      showReconnectDialog.value = false
      if (reconnectCountdown) {
        clearInterval(reconnectCountdown)
        reconnectCountdown = null
      }
      router.push(`/game/${result.roomId}`)
    } else {
      alert(result.error || '重连失败')
    }
  } catch (error) {
    console.error('重连失败:', error)
    alert('重连失败')
  } finally {
    isReconnecting.value = false
  }
}

// 放弃重连
const handleCancelReconnect = () => {
  showReconnectDialog.value = false
  gameStore.clearPendingGame()
  if (reconnectCountdown) {
    clearInterval(reconnectCountdown)
    reconnectCountdown = null
  }
}

// 加载房间列表
const loadRooms = async () => {
  if (socketStore.isConnected) {
    await roomStore.fetchRoomList()
  }
}

// 加载签到状态
const loadCheckinStatus = async () => {
  try {
    checkinStatus.value = await api.coins.getCheckinStatus()
  } catch (error) {
    console.error('加载签到状态失败:', error)
  }
}

// 签到
const handleCheckin = async () => {
  if (checkinStatus.value?.hasCheckedIn) return

  try {
    const res = await api.coins.checkin()
    userStore.updateCoins(res.coins)
    checkinStatus.value = {
      hasCheckedIn: true,
      consecutiveDays: res.consecutiveDays,
      todayReward: res.reward,
    }
    alert(`签到成功！获得 ${res.reward} 金币`)
  } catch (error) {
    console.error('签到失败:', error)
  }
}

// 快速匹配
const handleQuickMatch = async () => {
  try {
    const room = await roomStore.quickMatch(100)
    router.push(`/room/${room.id}`)
  } catch (error: unknown) {
    if (error instanceof Error) {
      alert(error.message)
    }
  }
}

// 创建房间
const handleCreateRoom = async () => {
  const roomName = newRoom.value.name || `${userStore.user?.nickname}的房间`

  try {
    const room = await roomStore.createRoom(roomName, newRoom.value.baseScore)
    showCreateRoom.value = false
    newRoom.value.name = ''
    router.push(`/room/${room.id}`)
  } catch (error: unknown) {
    if (error instanceof Error) {
      alert(error.message)
    }
  }
}

// 加入房间
const joinRoom = async (roomId: string) => {
  try {
    await roomStore.joinRoom(roomId)
    router.push(`/room/${roomId}`)
  } catch (error: unknown) {
    if (error instanceof Error) {
      alert(error.message)
    }
  }
}

// 登出
const handleLogout = () => {
  userStore.logout()
  router.push('/login')
}

onMounted(() => {
  // 初始化房间事件监听
  roomStore.initRoomListeners()

  // 加载数据
  loadRooms()
  loadCheckinStatus()

  // 检查未完成的游戏
  checkPendingGame()

  // 定时刷新房间列表
  refreshInterval = setInterval(loadRooms, 5000)
})

// 监听 socket 连接状态变化，连接后检查未完成游戏
watch(
  () => socketStore.isConnected,
  (connected) => {
    if (connected) {
      checkPendingGame()
    }
  }
)

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
  if (reconnectCountdown) {
    clearInterval(reconnectCountdown)
  }
})
</script>

<template>
  <div class="lobby-page">
    <header class="lobby-header">
      <div class="user-info">
        <div class="avatar">
          <img v-if="userStore.user?.avatar" :src="userStore.user.avatar" alt="avatar" />
          <span v-else>{{ userStore.user?.nickname?.[0] || '?' }}</span>
        </div>
        <div class="info">
          <div class="nickname">{{ userStore.user?.nickname }}</div>
          <div class="coins">金币: {{ userStore.user?.coins || 0 }}</div>
        </div>
        <div class="connection-status" :class="socketStore.connectionStatus">
          {{ socketStore.connectionStatus === 'connected' ? '在线' : socketStore.connectionStatus === 'connecting' ? '连接中' : '离线' }}
        </div>
      </div>
      <div class="header-actions">
        <button class="btn-checkin" :disabled="checkinStatus?.hasCheckedIn" @click="handleCheckin">
          {{ checkinStatus?.hasCheckedIn ? '已签到' : '签到' }}
        </button>
        <button class="btn-profile" @click="router.push('/profile')">个人中心</button>
        <button class="btn-logout" @click="handleLogout">退出</button>
      </div>
    </header>

    <main class="lobby-main">
      <section class="quick-actions">
        <button
          class="btn-match"
          :disabled="roomStore.isMatching || !socketStore.isConnected"
          @click="handleQuickMatch"
        >
          {{ roomStore.isMatching ? '匹配中...' : '快速匹配' }}
        </button>
        <button
          class="btn-create"
          :disabled="!socketStore.isConnected"
          @click="showCreateRoom = true"
        >
          创建房间
        </button>
      </section>

      <section class="room-list">
        <div class="list-header">
          <h2>房间列表</h2>
          <button class="btn-refresh" :disabled="roomStore.isLoading" @click="loadRooms">
            {{ roomStore.isLoading ? '刷新中...' : '刷新' }}
          </button>
        </div>
        <div v-if="roomStore.roomList.length === 0" class="empty">
          {{ socketStore.isConnected ? '暂无房间，快去创建一个吧！' : '等待连接...' }}
        </div>
        <div v-else class="rooms">
          <div
            v-for="room in roomStore.roomList"
            :key="room.id"
            class="room-item"
            :class="{ full: room.playerCount >= room.maxPlayers }"
            @click="room.playerCount < room.maxPlayers && joinRoom(room.id)"
          >
            <div class="room-name">{{ room.name }}</div>
            <div class="room-info">
              <span class="base-score">底分: {{ room.baseScore }}</span>
              <span class="player-count" :class="{ full: room.playerCount >= room.maxPlayers }">
                {{ room.playerCount }}/{{ room.maxPlayers }}人
              </span>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- 创建房间弹窗 -->
    <div v-if="showCreateRoom" class="modal-overlay" @click.self="showCreateRoom = false">
      <div class="modal-content">
        <h3>创建房间</h3>
        <div class="form-item">
          <label>房间名称</label>
          <input
            v-model="newRoom.name"
            type="text"
            :placeholder="`${userStore.user?.nickname}的房间`"
          />
        </div>
        <div class="form-item">
          <label>底分</label>
          <div class="base-score-options">
            <button
              v-for="score in [100, 500, 1000]"
              :key="score"
              :class="{ active: newRoom.baseScore === score }"
              @click="newRoom.baseScore = score"
            >
              {{ score }}
            </button>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showCreateRoom = false">取消</button>
          <button class="btn-confirm" @click="handleCreateRoom">创建</button>
        </div>
      </div>
    </div>

    <!-- 重连提示弹窗 -->
    <div v-if="showReconnectDialog" class="modal-overlay">
      <div class="modal-content reconnect-modal">
        <h3>游戏进行中</h3>
        <p class="reconnect-message">您有一局未完成的游戏</p>
        <p class="reconnect-countdown">剩余时间: {{ reconnectRemainingTime }}秒</p>
        <div class="modal-actions">
          <button class="btn-cancel" @click="handleCancelReconnect">放弃</button>
          <button class="btn-confirm" :disabled="isReconnecting" @click="handleReconnect">
            {{ isReconnecting ? '重连中...' : '立即回到游戏' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.lobby-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, $bg-primary 0%, $bg-dark 100%);
}

.lobby-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-md $spacing-lg;
  background: rgba(0, 0, 0, 0.3);

  .user-info {
    display: flex;
    align-items: center;
    gap: $spacing-md;

    .avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: $primary-color;
      display: flex;
      align-items: center;
      justify-content: center;
      color: $text-light;
      font-size: $font-size-lg;
      overflow: hidden;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .info {
      color: $text-light;

      .nickname {
        font-size: $font-size-lg;
        font-weight: 500;
      }

      .coins {
        font-size: $font-size-sm;
        opacity: 0.8;
      }
    }

    .connection-status {
      padding: 4px 8px;
      border-radius: 12px;
      font-size: $font-size-xs;
      color: $text-light;

      &.connected {
        background: $success-color;
      }

      &.connecting {
        background: $warning-color;
      }

      &.disconnected {
        background: $error-color;
      }
    }
  }

  .header-actions {
    display: flex;
    gap: $spacing-sm;

    button {
      padding: $spacing-sm $spacing-md;
      border-radius: $border-radius;
      font-size: $font-size-sm;
      transition: all $transition-fast;

      &.btn-checkin {
        background: $warning-color;
        color: $text-light;

        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      }

      &.btn-profile {
        background: $secondary-color;
        color: $text-light;
      }

      &.btn-logout {
        background: rgba(255, 255, 255, 0.2);
        color: $text-light;
      }
    }
  }
}

.lobby-main {
  flex: 1;
  padding: $spacing-lg;
  overflow-y: auto;
}

.quick-actions {
  display: flex;
  gap: $spacing-md;
  margin-bottom: $spacing-xl;

  button {
    flex: 1;
    height: 60px;
    border-radius: $border-radius-lg;
    font-size: $font-size-xl;
    font-weight: 500;
    color: $text-light;
    transition: all $transition-fast;

    &.btn-match {
      background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);

      &:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(231, 76, 60, 0.4);
      }

      &:disabled {
        opacity: 0.6;
      }
    }

    &.btn-create {
      background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);

      &:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(52, 152, 219, 0.4);
      }

      &:disabled {
        opacity: 0.6;
      }
    }
  }
}

.room-list {
  background: rgba(255, 255, 255, 0.1);
  border-radius: $border-radius-lg;
  padding: $spacing-lg;

  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: $spacing-md;

    h2 {
      color: $text-light;
    }

    .btn-refresh {
      padding: $spacing-xs $spacing-md;
      background: rgba(255, 255, 255, 0.2);
      color: $text-light;
      border-radius: $border-radius;
      font-size: $font-size-sm;

      &:disabled {
        opacity: 0.6;
      }
    }
  }

  .empty {
    text-align: center;
    color: rgba(255, 255, 255, 0.6);
    padding: $spacing-xl;
  }

  .rooms {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: $spacing-md;
  }

  .room-item {
    background: rgba(255, 255, 255, 0.1);
    border-radius: $border-radius;
    padding: $spacing-md;
    cursor: pointer;
    transition: all $transition-fast;

    &:hover:not(.full) {
      background: rgba(255, 255, 255, 0.2);
      transform: translateY(-2px);
    }

    &.full {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .room-name {
      color: $text-light;
      font-weight: 500;
      margin-bottom: $spacing-xs;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .room-info {
      display: flex;
      justify-content: space-between;
      color: rgba(255, 255, 255, 0.7);
      font-size: $font-size-sm;

      .player-count.full {
        color: $error-color;
      }
    }
  }
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-content {
  width: 320px;
  background: $bg-card;
  border-radius: $border-radius-lg;
  padding: $spacing-lg;

  h3 {
    text-align: center;
    margin-bottom: $spacing-lg;
  }

  .form-item {
    margin-bottom: $spacing-md;

    label {
      display: block;
      margin-bottom: $spacing-xs;
      color: $text-secondary;
    }

    input {
      width: 100%;
      height: 40px;
      padding: 0 $spacing-md;
      border: 1px solid $border-color;
      border-radius: $border-radius;
    }

    .base-score-options {
      display: flex;
      gap: $spacing-sm;

      button {
        flex: 1;
        height: 40px;
        border-radius: $border-radius;
        background: $bg-light;
        color: $text-secondary;
        transition: all $transition-fast;

        &.active {
          background: $primary-color;
          color: $text-light;
        }

        &:hover:not(.active) {
          background: darken($bg-light, 5%);
        }
      }
    }
  }

  .modal-actions {
    display: flex;
    gap: $spacing-md;
    margin-top: $spacing-lg;

    button {
      flex: 1;
      height: 40px;
      border-radius: $border-radius;

      &.btn-cancel {
        background: $bg-light;
        color: $text-secondary;
      }

      &.btn-confirm {
        background: $primary-color;
        color: $text-light;

        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      }
    }
  }

  &.reconnect-modal {
    .reconnect-message {
      text-align: center;
      color: $text-secondary;
      margin-bottom: $spacing-sm;
    }

    .reconnect-countdown {
      text-align: center;
      color: $error-color;
      font-size: $font-size-lg;
      font-weight: bold;
      margin-bottom: $spacing-md;
    }
  }
}
</style>
