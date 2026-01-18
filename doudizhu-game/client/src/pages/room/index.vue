<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/store/user'
import { useSocketStore } from '@/store/socket'
import { useRoomStore } from '@/store/room'
import type { Player } from '@/types'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const socketStore = useSocketStore()
const roomStore = useRoomStore()

const roomId = ref(route.params.id as string)
const showKickConfirm = ref(false)
const playerToKick = ref<Player | null>(null)

// 按座位排序的玩家列表
const sortedPlayers = computed(() => {
  if (!roomStore.currentRoom) return []
  return [...roomStore.currentRoom.players].sort((a, b) => a.seat - b.seat)
})

// 空座位数量
const emptySeats = computed(() => {
  if (!roomStore.currentRoom) return 3
  return 3 - roomStore.currentRoom.players.length
})

// 当前用户是否准备
const isReady = computed(() => {
  return roomStore.myPlayer?.isReady || false
})

// 离开房间
const leaveRoom = async () => {
  try {
    await roomStore.leaveRoom()
    router.push('/')
  } catch (error) {
    console.error('离开房间失败:', error)
    router.push('/')
  }
}

// 切换准备状态
const toggleReady = async () => {
  try {
    await roomStore.toggleReady()
  } catch (error: unknown) {
    if (error instanceof Error) {
      alert(error.message)
    }
  }
}

// 踢出玩家
const confirmKick = (player: Player) => {
  playerToKick.value = player
  showKickConfirm.value = true
}

const handleKick = async () => {
  if (!playerToKick.value) return
  try {
    await roomStore.kickPlayer(playerToKick.value.id)
    showKickConfirm.value = false
    playerToKick.value = null
  } catch (error: unknown) {
    if (error instanceof Error) {
      alert(error.message)
    }
  }
}

// 监听游戏开始
watch(
  () => roomStore.currentRoom?.status,
  (status) => {
    if (status === 'starting' || status === 'playing') {
      router.push(`/game/${roomId.value}`)
    }
  }
)

// 监听被踢出
socketStore.on('room:kicked', () => {
  alert('您已被踢出房间')
  router.push('/')
})

onMounted(async () => {
  // 初始化房间事件监听
  roomStore.initRoomListeners()

  // 如果没有当前房间数据，尝试加入
  if (!roomStore.currentRoom) {
    try {
      await roomStore.joinRoom(roomId.value)
    } catch (error) {
      console.error('加入房间失败:', error)
      router.push('/')
    }
  }
})

onUnmounted(() => {
  // 如果不是跳转到游戏页面，则离开房间
  if (!router.currentRoute.value.path.startsWith('/game/')) {
    roomStore.leaveRoom().catch(() => {})
  }
})
</script>

<template>
  <div class="room-page">
    <header class="room-header">
      <button class="btn-back" @click="leaveRoom">离开房间</button>
      <div class="room-info">
        <h1>{{ roomStore.currentRoom?.name || '加载中...' }}</h1>
        <span class="base-score">底分: {{ roomStore.currentRoom?.baseScore || 0 }}</span>
      </div>
      <div class="connection-status" :class="socketStore.connectionStatus">
        {{ socketStore.connectionStatus === 'connected' ? '在线' : '离线' }}
      </div>
    </header>

    <main class="room-main">
      <div class="seats">
        <!-- 已有玩家的座位 -->
        <div
          v-for="player in sortedPlayers"
          :key="player.id"
          class="seat occupied"
          :class="{
            owner: player.id === roomStore.currentRoom?.ownerId,
            ready: player.isReady,
            offline: !player.isOnline,
            self: player.id === userStore.user?.id,
          }"
        >
          <div class="seat-content">
            <div class="avatar">
              <img v-if="player.avatar" :src="player.avatar" alt="avatar" />
              <span v-else>{{ player.nickname?.[0] || '?' }}</span>
              <span v-if="player.id === roomStore.currentRoom?.ownerId" class="owner-badge">
                房主
              </span>
            </div>
            <div class="name">{{ player.nickname }}</div>
            <div class="coins">{{ player.coins }} 金币</div>
            <div v-if="player.isReady" class="ready-badge">已准备</div>
            <div v-if="!player.isOnline" class="offline-badge">离线</div>
            <!-- 踢人按钮 -->
            <button
              v-if="
                roomStore.isOwner &&
                player.id !== userStore.user?.id &&
                roomStore.currentRoom?.status === 'waiting'
              "
              class="btn-kick"
              @click="confirmKick(player)"
            >
              踢出
            </button>
          </div>
        </div>

        <!-- 空座位 -->
        <div v-for="i in emptySeats" :key="`empty-${i}`" class="seat empty">
          <div class="seat-content">
            <div class="avatar empty-avatar">
              <span>+</span>
            </div>
            <div class="name">等待加入...</div>
          </div>
        </div>
      </div>

      <div class="room-status">
        <template v-if="roomStore.allReady">
          游戏即将开始...
        </template>
        <template v-else-if="roomStore.currentRoom?.players.length === 3">
          等待所有玩家准备
        </template>
        <template v-else>
          等待玩家加入 ({{ roomStore.currentRoom?.players.length || 0 }}/3)
        </template>
      </div>

      <div class="actions">
        <button
          :class="['btn-ready', { ready: isReady }]"
          :disabled="!socketStore.isConnected"
          @click="toggleReady"
        >
          {{ isReady ? '取消准备' : '准备' }}
        </button>
      </div>
    </main>

    <!-- 踢人确认弹窗 -->
    <div v-if="showKickConfirm" class="modal-overlay" @click.self="showKickConfirm = false">
      <div class="modal-content">
        <h3>确认踢出</h3>
        <p>确定要将 {{ playerToKick?.nickname }} 踢出房间吗？</p>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showKickConfirm = false">取消</button>
          <button class="btn-confirm" @click="handleKick">确定</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.room-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, $bg-primary 0%, $bg-dark 100%);
}

.room-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-md $spacing-lg;
  background: rgba(0, 0, 0, 0.3);
  color: $text-light;

  .btn-back {
    padding: $spacing-sm $spacing-md;
    background: rgba(255, 255, 255, 0.2);
    color: $text-light;
    border-radius: $border-radius;
  }

  .room-info {
    text-align: center;

    h1 {
      font-size: $font-size-xl;
      margin-bottom: $spacing-xs;
    }

    .base-score {
      font-size: $font-size-sm;
      opacity: 0.8;
    }
  }

  .connection-status {
    padding: 4px 8px;
    border-radius: 12px;
    font-size: $font-size-xs;

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

.room-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: $spacing-xl;
}

.seats {
  display: flex;
  gap: $spacing-xl;
  margin-bottom: $spacing-xl;

  .seat {
    width: 160px;
    height: 220px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: $border-radius-lg;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    transition: all $transition-fast;

    &.occupied {
      background: rgba(255, 255, 255, 0.15);

      &.self {
        border: 2px solid $primary-color;
      }

      &.ready {
        border: 2px solid $success-color;
      }

      &.offline {
        opacity: 0.6;
      }
    }

    &.empty {
      border: 2px dashed rgba(255, 255, 255, 0.3);
    }

    .seat-content {
      text-align: center;

      .avatar {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        color: $text-light;
        font-size: $font-size-xxl;
        margin: 0 auto $spacing-sm;
        position: relative;
        overflow: hidden;

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        &.empty-avatar {
          border: 2px dashed rgba(255, 255, 255, 0.3);
          background: transparent;
        }

        .owner-badge {
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          background: $warning-color;
          color: $text-light;
          font-size: $font-size-xs;
          padding: 2px 8px;
          border-radius: 8px;
        }
      }

      .name {
        color: $text-light;
        font-weight: 500;
        margin-bottom: $spacing-xs;
      }

      .coins {
        color: rgba(255, 255, 255, 0.7);
        font-size: $font-size-sm;
        margin-bottom: $spacing-xs;
      }

      .ready-badge {
        color: $success-color;
        font-size: $font-size-sm;
        font-weight: 500;
      }

      .offline-badge {
        color: $error-color;
        font-size: $font-size-sm;
      }

      .btn-kick {
        margin-top: $spacing-sm;
        padding: $spacing-xs $spacing-sm;
        background: $error-color;
        color: $text-light;
        border-radius: $border-radius;
        font-size: $font-size-xs;

        &:hover {
          background: darken($error-color, 10%);
        }
      }
    }
  }
}

.room-status {
  color: rgba(255, 255, 255, 0.8);
  font-size: $font-size-lg;
  margin-bottom: $spacing-lg;
  text-align: center;
}

.actions {
  .btn-ready {
    padding: $spacing-md $spacing-xxl;
    background: $secondary-color;
    color: $text-light;
    border-radius: $border-radius-lg;
    font-size: $font-size-lg;
    font-weight: 500;
    transition: all $transition-fast;

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    &.ready {
      background: $success-color;
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
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
  width: 300px;
  background: $bg-card;
  border-radius: $border-radius-lg;
  padding: $spacing-lg;

  h3 {
    text-align: center;
    margin-bottom: $spacing-md;
  }

  p {
    text-align: center;
    color: $text-secondary;
    margin-bottom: $spacing-lg;
  }

  .modal-actions {
    display: flex;
    gap: $spacing-md;

    button {
      flex: 1;
      height: 40px;
      border-radius: $border-radius;

      &.btn-cancel {
        background: $bg-light;
        color: $text-secondary;
      }

      &.btn-confirm {
        background: $error-color;
        color: $text-light;
      }
    }
  }
}
</style>
