<template>
  <el-container class="layout-container">
    <el-aside width="220px" class="aside">
      <div class="logo">
        <h2>聊天管理后台</h2>
      </div>
      <el-menu
        :default-active="activeMenu"
        class="menu"
        background-color="#001529"
        text-color="#ffffffa6"
        active-text-color="#fff"
        router
      >
        <el-menu-item index="/dashboard">
          <el-icon><DataAnalysis /></el-icon>
          <span>仪表盘</span>
        </el-menu-item>
        <el-menu-item index="/users">
          <el-icon><User /></el-icon>
          <span>用户管理</span>
        </el-menu-item>
        <el-menu-item index="/referrals">
          <el-icon><Link /></el-icon>
          <span>推荐链接</span>
        </el-menu-item>
        <el-menu-item index="/statistics">
          <el-icon><TrendCharts /></el-icon>
          <span>数据统计</span>
        </el-menu-item>
        <el-menu-item index="/admins">
          <el-icon><UserFilled /></el-icon>
          <span>管理员管理</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item v-if="currentTitle">{{ currentTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <span class="user-info">
              <el-avatar :size="32" :src="adminStore.adminInfo?.avatar || undefined">
                {{ adminStore.adminInfo?.nickname?.charAt(0) || 'A' }}
              </el-avatar>
              <span class="username">{{ adminStore.adminInfo?.nickname || adminStore.adminInfo?.username }}</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAdminStore } from '@/store'
import {
  DataAnalysis,
  User,
  Link,
  TrendCharts,
  UserFilled,
  ArrowDown
} from '@element-plus/icons-vue'

const route = useRoute()
const adminStore = useAdminStore()

const activeMenu = computed(() => {
  const path = route.path
  // 处理子路由，返回父级路径
  if (path.startsWith('/users/')) return '/users'
  return path
})

const currentTitle = computed(() => {
  return route.meta.title as string | undefined
})

function handleCommand(command: string) {
  if (command === 'logout') {
    adminStore.logout()
  }
}
</script>

<style scoped lang="scss">
.layout-container {
  height: 100vh;
}

.aside {
  background-color: #001529;

  .logo {
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);

    h2 {
      color: #fff;
      font-size: 18px;
      margin: 0;
    }
  }

  .menu {
    border-right: none;

    :deep(.el-menu-item) {
      &:hover {
        background-color: #000c17 !important;
      }

      &.is-active {
        background-color: #1890ff !important;
      }
    }
  }
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #fff;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);

  .header-right {
    .user-info {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;

      .username {
        color: #333;
      }
    }
  }
}

.main {
  background-color: #f0f2f5;
  padding: 24px;
  overflow-y: auto;
}
</style>
