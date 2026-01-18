<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'
import api from '@/api'

const router = useRouter()
const userStore = useUserStore()

const stats = ref({
  totalGames: 0,
  wins: 0,
  winRate: 0,
  landlordGames: 0,
  landlordWins: 0,
  farmerGames: 0,
  farmerWins: 0,
})

const loadStats = async () => {
  try {
    stats.value = await api.user.getStats()
  } catch (error) {
    console.error('加载战绩失败:', error)
  }
}

const goBack = () => {
  router.push('/')
}

onMounted(() => {
  loadStats()
})
</script>

<template>
  <div class="profile-page">
    <header class="profile-header">
      <button class="btn-back" @click="goBack">返回</button>
      <h1>个人中心</h1>
    </header>

    <main class="profile-main">
      <section class="user-card">
        <div class="avatar">
          <img v-if="userStore.user?.avatar" :src="userStore.user.avatar" alt="avatar" />
          <span v-else>{{ userStore.user?.nickname?.[0] || '?' }}</span>
        </div>
        <div class="info">
          <div class="nickname">{{ userStore.user?.nickname }}</div>
          <div class="account">账号: {{ userStore.user?.account }}</div>
          <div class="coins">金币: {{ userStore.user?.coins || 0 }}</div>
        </div>
      </section>

      <section class="stats-card">
        <h2>战绩统计</h2>
        <div class="stats-grid">
          <div class="stat-item">
            <div class="value">{{ stats.totalGames }}</div>
            <div class="label">总场次</div>
          </div>
          <div class="stat-item">
            <div class="value">{{ stats.wins }}</div>
            <div class="label">胜利</div>
          </div>
          <div class="stat-item">
            <div class="value">{{ (stats.winRate * 100).toFixed(1) }}%</div>
            <div class="label">胜率</div>
          </div>
        </div>
        <div class="stats-detail">
          <div class="detail-item">
            <span class="role landlord">地主</span>
            <span>{{ stats.landlordWins }}/{{ stats.landlordGames }} 场</span>
          </div>
          <div class="detail-item">
            <span class="role farmer">农民</span>
            <span>{{ stats.farmerWins }}/{{ stats.farmerGames }} 场</span>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style lang="scss" scoped>
.profile-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, $bg-primary 0%, $bg-dark 100%);
}

.profile-header {
  display: flex;
  align-items: center;
  padding: $spacing-md $spacing-lg;
  background: rgba(0, 0, 0, 0.3);
  color: $text-light;

  .btn-back {
    padding: $spacing-sm $spacing-md;
    background: rgba(255, 255, 255, 0.2);
    color: $text-light;
    border-radius: $border-radius;
    margin-right: $spacing-lg;
  }

  h1 {
    font-size: $font-size-xl;
  }
}

.profile-main {
  flex: 1;
  padding: $spacing-lg;
  overflow-y: auto;
}

.user-card {
  display: flex;
  align-items: center;
  gap: $spacing-lg;
  padding: $spacing-lg;
  background: rgba(255, 255, 255, 0.1);
  border-radius: $border-radius-lg;
  margin-bottom: $spacing-lg;

  .avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: $primary-color;
    display: flex;
    align-items: center;
    justify-content: center;
    color: $text-light;
    font-size: $font-size-xxl;
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
      font-size: $font-size-xl;
      font-weight: 500;
      margin-bottom: $spacing-xs;
    }

    .account,
    .coins {
      font-size: $font-size-sm;
      opacity: 0.8;
    }
  }
}

.stats-card {
  padding: $spacing-lg;
  background: rgba(255, 255, 255, 0.1);
  border-radius: $border-radius-lg;

  h2 {
    color: $text-light;
    margin-bottom: $spacing-lg;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: $spacing-md;
    margin-bottom: $spacing-lg;

    .stat-item {
      text-align: center;
      padding: $spacing-md;
      background: rgba(255, 255, 255, 0.1);
      border-radius: $border-radius;

      .value {
        font-size: $font-size-xxl;
        font-weight: 500;
        color: $text-light;
      }

      .label {
        font-size: $font-size-sm;
        color: rgba(255, 255, 255, 0.7);
        margin-top: $spacing-xs;
      }
    }
  }

  .stats-detail {
    .detail-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: $spacing-md;
      background: rgba(255, 255, 255, 0.05);
      border-radius: $border-radius;
      color: $text-light;
      margin-bottom: $spacing-sm;

      &:last-child {
        margin-bottom: 0;
      }

      .role {
        padding: $spacing-xs $spacing-sm;
        border-radius: $border-radius;
        font-size: $font-size-sm;

        &.landlord {
          background: $danger-color;
        }

        &.farmer {
          background: $success-color;
        }
      }
    }
  }
}
</style>
