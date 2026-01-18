<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGameStore } from '@/store/game'
import { useSocketStore } from '@/store/socket'
import { getGameManager, destroyGameManager } from '@/phaser/GameManager'

const route = useRoute()
const router = useRouter()
const gameStore = useGameStore()
const socketStore = useSocketStore()

const gameId = ref(route.params.id as string)
const gameContainer = ref<HTMLDivElement | null>(null)
const isLoading = ref(true)
const errorMessage = ref('')

onMounted(() => {
  console.log('进入游戏:', gameId.value)

  // 检查 Socket 连接
  if (!socketStore.isConnected) {
    errorMessage.value = '连接已断开，请重新登录'
    return
  }

  // 初始化游戏事件监听
  gameStore.initGameListeners()

  // 初始化 Phaser 游戏
  if (gameContainer.value) {
    const gameManager = getGameManager()
    gameManager.init(gameContainer.value, gameStore)
    isLoading.value = false
  }
})

onUnmounted(() => {
  console.log('离开游戏')

  // 移除游戏事件监听
  gameStore.removeGameListeners()

  // 重置游戏状态
  gameStore.resetGame()

  // 销毁 Phaser 游戏
  destroyGameManager()
})

// 返回大厅
function goBack() {
  router.push('/lobby')
}
</script>

<template>
  <div class="game-page">
    <!-- 加载中 -->
    <div v-if="isLoading && !errorMessage" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>游戏加载中...</p>
    </div>

    <!-- 错误提示 -->
    <div v-if="errorMessage" class="error-overlay">
      <div class="error-content">
        <p>{{ errorMessage }}</p>
        <button @click="goBack">返回大厅</button>
      </div>
    </div>

    <!-- 游戏容器 -->
    <div ref="gameContainer" class="game-container"></div>

    <!-- 返回按钮 -->
    <button class="back-button" @click="goBack">
      <span>退出</span>
    </button>
  </div>
</template>

<style lang="scss" scoped>
.game-page {
  width: 100%;
  height: 100%;
  background: $bg-dark;
  position: relative;
  overflow: hidden;
}

.game-container {
  width: 100%;
  height: 100%;
}

.loading-overlay,
.error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.8);
  z-index: 1000;
  color: $text-light;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top-color: $primary-color;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: $spacing-md;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-content {
  text-align: center;

  p {
    font-size: $font-size-lg;
    margin-bottom: $spacing-lg;
  }

  button {
    padding: $spacing-sm $spacing-lg;
    font-size: $font-size-base;
    color: $text-light;
    background: $primary-color;
    border: none;
    border-radius: $border-radius;
    cursor: pointer;
    transition: background $transition-fast;

    &:hover {
      background: darken($primary-color, 10%);
    }
  }
}

.back-button {
  position: absolute;
  top: $spacing-md;
  left: $spacing-md;
  padding: $spacing-xs $spacing-md;
  font-size: $font-size-sm;
  color: $text-light;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: $border-radius;
  cursor: pointer;
  transition: all $transition-fast;
  z-index: 100;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.5);
  }
}
</style>
