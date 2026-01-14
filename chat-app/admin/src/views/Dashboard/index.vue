<template>
  <div class="dashboard">
    <!-- 统计卡片 -->
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
            <el-icon size="32"><Plus /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-title">今日新增</div>
            <div class="stat-value">{{ overview?.today_new_users || 0 }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon" style="background: #e6a23c;">
            <el-icon size="32"><Star /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-title">今日活跃</div>
            <div class="stat-value">{{ overview?.today_active_users || 0 }}</div>
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

    <!-- 图表 -->
    <el-row :gutter="24" class="chart-row">
      <el-col :span="16">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>用户趋势</span>
              <el-radio-group v-model="chartDays" size="small" @change="loadTrends">
                <el-radio-button :value="7">7天</el-radio-button>
                <el-radio-button :value="30">30天</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <v-chart :option="chartOption" style="height: 350px;" autoresize />
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="info-card">
          <template #header>
            <span>系统概况</span>
          </template>
          <div class="info-list">
            <div class="info-item">
              <span class="label">累计消息</span>
              <span class="value">{{ overview?.total_messages || 0 }}</span>
            </div>
            <div class="info-item">
              <span class="label">累计群组</span>
              <span class="value">{{ overview?.total_groups || 0 }}</span>
            </div>
            <div class="info-item">
              <span class="label">封停用户</span>
              <span class="value" style="color: #f56c6c;">{{ overview?.banned_users || 0 }}</span>
            </div>
            <div class="info-item">
              <span class="label">推荐链接</span>
              <span class="value">{{ overview?.total_referrals || 0 }}</span>
            </div>
            <div class="info-item">
              <span class="label">推荐注册</span>
              <span class="value">{{ overview?.referral_registrations || 0 }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { User, Plus, Star, Connection } from '@element-plus/icons-vue'
import { statisticsApi } from '@/api'
import type { StatisticsOverview, StatisticsTrends } from '@/types'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent])

const overview = ref<StatisticsOverview | null>(null)
const trends = ref<StatisticsTrends | null>(null)
const chartDays = ref(7)

const chartOption = computed(() => ({
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
      areaStyle: {
        opacity: 0.3
      },
      itemStyle: {
        color: '#409eff'
      }
    },
    {
      name: '活跃用户',
      type: 'line',
      smooth: true,
      data: trends.value?.active_users || [],
      areaStyle: {
        opacity: 0.3
      },
      itemStyle: {
        color: '#67c23a'
      }
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

onMounted(() => {
  loadOverview()
  loadTrends()
})
</script>

<style scoped lang="scss">
.dashboard {
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

  .chart-row {
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
  }

  .info-card {
    height: 100%;

    .info-list {
      .info-item {
        display: flex;
        justify-content: space-between;
        padding: 12px 0;
        border-bottom: 1px solid #f0f0f0;

        &:last-child {
          border-bottom: none;
        }

        .label {
          color: #909399;
        }

        .value {
          font-weight: 600;
          color: #303133;
        }
      }
    }
  }
}
</style>
