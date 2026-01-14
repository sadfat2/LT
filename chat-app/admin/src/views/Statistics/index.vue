<template>
  <div class="statistics-page">
    <!-- 概览卡片 -->
    <el-row :gutter="24" class="stat-cards">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon" style="background: #409eff;">
            <el-icon size="32"><User /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-title">总用户数</div>
            <div class="stat-value">{{ overview?.total_users || 0 }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon" style="background: #67c23a;">
            <el-icon size="32"><ChatDotRound /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-title">累计消息</div>
            <div class="stat-value">{{ overview?.total_messages || 0 }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon" style="background: #e6a23c;">
            <el-icon size="32"><Collection /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-title">累计群组</div>
            <div class="stat-value">{{ overview?.total_groups || 0 }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon" style="background: #f56c6c;">
            <el-icon size="32"><Connection /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-title">当前在线</div>
            <div class="stat-value">{{ overview?.online_count || 0 }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 趋势图表 -->
    <el-card class="chart-card">
      <template #header>
        <div class="card-header">
          <span>数据趋势</span>
          <el-radio-group v-model="chartDays" @change="loadTrends">
            <el-radio-button :value="7">7天</el-radio-button>
            <el-radio-button :value="30">30天</el-radio-button>
            <el-radio-button :value="60">60天</el-radio-button>
          </el-radio-group>
        </div>
      </template>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="用户增长" name="users">
          <v-chart :option="usersChartOption" style="height: 400px;" autoresize />
        </el-tab-pane>
        <el-tab-pane label="消息统计" name="messages">
          <v-chart :option="messagesChartOption" style="height: 400px;" autoresize />
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 在线用户 -->
    <el-card class="online-card">
      <template #header>
        <span>当前在线用户</span>
      </template>
      <el-table :data="onlineUsers" v-loading="loadingOnline" max-height="400">
        <el-table-column label="用户" min-width="200">
          <template #default="{ row }">
            <div class="user-cell">
              <el-avatar :size="32" :src="row.avatar || undefined">
                {{ row.nickname?.charAt(0) || '?' }}
              </el-avatar>
              <div class="user-info">
                <div class="nickname">{{ row.nickname }}</div>
                <div class="account">{{ row.account }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="注册时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination" v-if="onlineTotal > 50">
        <el-pagination
          v-model:current-page="onlinePage"
          :total="onlineTotal"
          :page-size="50"
          layout="prev, pager, next"
          @current-change="loadOnlineUsers"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { User, ChatDotRound, Collection, Connection } from '@element-plus/icons-vue'
import { statisticsApi } from '@/api'
import type { StatisticsOverview, StatisticsTrends, User as UserType } from '@/types'
import dayjs from 'dayjs'

use([CanvasRenderer, LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent])

const overview = ref<StatisticsOverview | null>(null)
const trends = ref<StatisticsTrends | null>(null)
const chartDays = ref(30)
const activeTab = ref('users')

const onlineUsers = ref<UserType[]>([])
const loadingOnline = ref(false)
const onlinePage = ref(1)
const onlineTotal = ref(0)

function formatDate(date: string) {
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

const usersChartOption = computed(() => ({
  tooltip: {
    trigger: 'axis'
  },
  legend: {
    data: ['新增用户', '活跃用户']
  },
  grid: {
    left: '3%',
    right: '4%',
    bottom: '3%',
    containLabel: true
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: trends.value?.dates || []
  },
  yAxis: {
    type: 'value'
  },
  series: [
    {
      name: '新增用户',
      type: 'line',
      smooth: true,
      data: trends.value?.new_users || [],
      areaStyle: { opacity: 0.3 },
      itemStyle: { color: '#409eff' }
    },
    {
      name: '活跃用户',
      type: 'line',
      smooth: true,
      data: trends.value?.active_users || [],
      areaStyle: { opacity: 0.3 },
      itemStyle: { color: '#67c23a' }
    }
  ]
}))

const messagesChartOption = computed(() => ({
  tooltip: {
    trigger: 'axis'
  },
  legend: {
    data: ['消息数量']
  },
  grid: {
    left: '3%',
    right: '4%',
    bottom: '3%',
    containLabel: true
  },
  xAxis: {
    type: 'category',
    data: trends.value?.dates || []
  },
  yAxis: {
    type: 'value'
  },
  series: [
    {
      name: '消息数量',
      type: 'bar',
      data: trends.value?.messages || [],
      itemStyle: { color: '#e6a23c' }
    }
  ]
}))

async function loadOverview() {
  try {
    const res = await statisticsApi.getOverview()
    overview.value = res.data
  } catch (error) {
    console.error('加载概览数据失败:', error)
  }
}

async function loadTrends() {
  try {
    const res = await statisticsApi.getTrends(chartDays.value)
    trends.value = res.data
  } catch (error) {
    console.error('加载趋势数据失败:', error)
  }
}

async function loadOnlineUsers() {
  loadingOnline.value = true
  try {
    const res = await statisticsApi.getOnlineUsers({
      page: onlinePage.value,
      limit: 50
    })
    onlineUsers.value = res.data.list
    onlineTotal.value = res.data.total
  } catch (error) {
    console.error('加载在线用户失败:', error)
  } finally {
    loadingOnline.value = false
  }
}

onMounted(() => {
  loadOverview()
  loadTrends()
  loadOnlineUsers()
})
</script>

<style scoped lang="scss">
.statistics-page {
  .stat-cards {
    margin-bottom: 24px;
  }

  .stat-card {
    :deep(.el-card__body) {
      display: flex;
      align-items: center;
      padding: 20px;
    }

    .stat-icon {
      width: 64px;
      height: 64px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      margin-right: 16px;
    }

    .stat-content {
      .stat-title {
        color: #909399;
        font-size: 14px;
        margin-bottom: 8px;
      }

      .stat-value {
        font-size: 28px;
        font-weight: 600;
        color: #303133;
      }
    }
  }

  .chart-card {
    margin-bottom: 24px;

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  }

  .online-card {
    .user-cell {
      display: flex;
      align-items: center;
      gap: 12px;

      .user-info {
        .nickname {
          font-weight: 500;
        }

        .account {
          font-size: 12px;
          color: #909399;
        }
      }
    }

    .pagination {
      margin-top: 20px;
      display: flex;
      justify-content: center;
    }
  }
}
</style>
