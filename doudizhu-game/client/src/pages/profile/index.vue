<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'
import api from '@/api'
import type { CheckinStatus, Transaction } from '@/types'

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

const checkinStatus = ref<CheckinStatus | null>(null)
const transactions = ref<Transaction[]>([])
const showEditNickname = ref(false)
const newNickname = ref('')
const isUpdating = ref(false)

const loadStats = async () => {
  try {
    stats.value = await api.user.getStats()
  } catch (error) {
    console.error('加载战绩失败:', error)
  }
}

const loadCheckinStatus = async () => {
  try {
    checkinStatus.value = await api.coins.getCheckinStatus()
  } catch (error) {
    console.error('加载签到状态失败:', error)
  }
}

const loadTransactions = async () => {
  try {
    const res = await api.coins.getTransactions()
    transactions.value = res.transactions
  } catch (error) {
    console.error('加载交易记录失败:', error)
  }
}

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
    loadTransactions()
  } catch (error) {
    console.error('签到失败:', error)
  }
}

const openEditNickname = () => {
  newNickname.value = userStore.user?.nickname || ''
  showEditNickname.value = true
}

const handleUpdateNickname = async () => {
  if (!newNickname.value.trim()) {
    alert('昵称不能为空')
    return
  }

  if (newNickname.value === userStore.user?.nickname) {
    showEditNickname.value = false
    return
  }

  isUpdating.value = true
  try {
    const res = await api.user.updateProfile({ nickname: newNickname.value })
    userStore.setUser(res.user)
    showEditNickname.value = false
    alert('昵称修改成功')
  } catch (error) {
    console.error('修改昵称失败:', error)
    alert('修改昵称失败')
  } finally {
    isUpdating.value = false
  }
}

const goBack = () => {
  router.push('/')
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
}

onMounted(() => {
  loadStats()
  loadCheckinStatus()
  loadTransactions()
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
          <div class="nickname">
            {{ userStore.user?.nickname }}
            <button class="btn-edit" @click="openEditNickname">修改</button>
          </div>
          <div class="account">账号: {{ userStore.user?.account }}</div>
          <div class="coins">金币: {{ userStore.user?.coins || 0 }}</div>
        </div>
      </section>

      <section class="checkin-card">
        <h2>每日签到</h2>
        <div class="checkin-info">
          <div class="consecutive">
            <span class="days">{{ checkinStatus?.consecutiveDays || 0 }}</span>
            <span class="label">连续签到天数</span>
          </div>
          <button
            class="btn-checkin"
            :disabled="checkinStatus?.hasCheckedIn"
            @click="handleCheckin"
          >
            {{ checkinStatus?.hasCheckedIn ? `已领取 ${checkinStatus?.todayReward || 0} 金币` : '立即签到' }}
          </button>
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

      <section class="transactions-card">
        <h2>交易记录</h2>
        <div v-if="transactions.length === 0" class="empty">暂无交易记录</div>
        <div v-else class="transactions-list">
          <div v-for="tx in transactions.slice(0, 10)" :key="tx.id" class="transaction-item">
            <div class="tx-info">
              <span class="tx-desc">{{ tx.description }}</span>
              <span class="tx-time">{{ formatDate(tx.createdAt) }}</span>
            </div>
            <div class="tx-amount" :class="tx.amount >= 0 ? 'positive' : 'negative'">
              {{ tx.amount >= 0 ? '+' : '' }}{{ tx.amount }}
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- 修改昵称弹窗 -->
    <div v-if="showEditNickname" class="modal-overlay" @click.self="showEditNickname = false">
      <div class="modal-content">
        <h3>修改昵称</h3>
        <div class="form-item">
          <input
            v-model="newNickname"
            type="text"
            placeholder="请输入新昵称"
            maxlength="20"
          />
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showEditNickname = false">取消</button>
          <button class="btn-confirm" :disabled="isUpdating" @click="handleUpdateNickname">
            {{ isUpdating ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
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
      display: flex;
      align-items: center;
      gap: $spacing-sm;

      .btn-edit {
        font-size: $font-size-xs;
        padding: 2px 8px;
        background: rgba(255, 255, 255, 0.2);
        color: $text-light;
        border-radius: $border-radius;
      }
    }

    .account,
    .coins {
      font-size: $font-size-sm;
      opacity: 0.8;
    }
  }
}

.checkin-card {
  padding: $spacing-lg;
  background: rgba(255, 255, 255, 0.1);
  border-radius: $border-radius-lg;
  margin-bottom: $spacing-lg;

  h2 {
    color: $text-light;
    margin-bottom: $spacing-md;
  }

  .checkin-info {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .consecutive {
      display: flex;
      flex-direction: column;
      align-items: center;

      .days {
        font-size: $font-size-xxl;
        font-weight: bold;
        color: $warning-color;
      }

      .label {
        font-size: $font-size-sm;
        color: rgba(255, 255, 255, 0.7);
      }
    }

    .btn-checkin {
      padding: $spacing-md $spacing-xl;
      background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%);
      color: $text-light;
      border-radius: $border-radius-lg;
      font-size: $font-size-base;
      font-weight: 500;

      &:disabled {
        opacity: 0.7;
        background: rgba(255, 255, 255, 0.2);
      }
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

.transactions-card {
  padding: $spacing-lg;
  background: rgba(255, 255, 255, 0.1);
  border-radius: $border-radius-lg;

  h2 {
    color: $text-light;
    margin-bottom: $spacing-md;
  }

  .empty {
    text-align: center;
    color: rgba(255, 255, 255, 0.5);
    padding: $spacing-lg;
  }

  .transactions-list {
    .transaction-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: $spacing-md;
      background: rgba(255, 255, 255, 0.05);
      border-radius: $border-radius;
      margin-bottom: $spacing-sm;

      &:last-child {
        margin-bottom: 0;
      }

      .tx-info {
        display: flex;
        flex-direction: column;

        .tx-desc {
          color: $text-light;
          font-size: $font-size-sm;
        }

        .tx-time {
          color: rgba(255, 255, 255, 0.5);
          font-size: $font-size-xs;
          margin-top: 2px;
        }
      }

      .tx-amount {
        font-weight: 500;
        font-size: $font-size-base;

        &.positive {
          color: $success-color;
        }

        &.negative {
          color: $error-color;
        }
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
  width: 300px;
  background: $bg-card;
  border-radius: $border-radius-lg;
  padding: $spacing-lg;

  h3 {
    text-align: center;
    margin-bottom: $spacing-lg;
  }

  .form-item {
    margin-bottom: $spacing-md;

    input {
      width: 100%;
      height: 40px;
      padding: 0 $spacing-md;
      border: 1px solid $border-color;
      border-radius: $border-radius;
    }
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
        background: $primary-color;
        color: $text-light;

        &:disabled {
          opacity: 0.6;
        }
      }
    }
  }
}
</style>
