<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const gameId = ref(route.params.id as string)
const gameContainer = ref<HTMLDivElement | null>(null)

onMounted(() => {
  console.log('进入游戏:', gameId.value)
  // TODO: 初始化 Phaser 游戏
})

onUnmounted(() => {
  // TODO: 销毁 Phaser 游戏
})
</script>

<template>
  <div class="game-page">
    <div ref="gameContainer" class="game-container">
      <div class="placeholder">
        <h2>Phaser 游戏场景</h2>
        <p>游戏 ID: {{ gameId }}</p>
        <p>游戏引擎开发中...</p>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.game-page {
  width: 100%;
  height: 100%;
  background: $bg-dark;
}

.game-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder {
  text-align: center;
  color: $text-light;

  h2 {
    font-size: $font-size-xxl;
    margin-bottom: $spacing-md;
  }

  p {
    color: rgba(255, 255, 255, 0.7);
    margin-bottom: $spacing-sm;
  }
}
</style>
