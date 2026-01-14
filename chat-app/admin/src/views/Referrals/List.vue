<template>
  <div class="referrals-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>推荐链接管理</span>
          <el-button type="primary" @click="showCreateDialog">创建推荐链接</el-button>
        </div>
      </template>

      <!-- 链接列表 -->
      <el-table :data="referrals" v-loading="loading">
        <el-table-column label="用户" min-width="200">
          <template #default="{ row }">
            <div class="user-cell">
              <el-avatar :size="40" :src="row.user_avatar || undefined">
                {{ row.user_nickname?.charAt(0) || '?' }}
              </el-avatar>
              <div class="user-info">
                <div class="nickname">{{ row.user_nickname }}</div>
                <div class="account">{{ row.user_account }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="推荐链接" min-width="320">
          <template #default="{ row }">
            <div class="link-cell">
              <el-input
                :model-value="getReferralLink(row.code)"
                readonly
                size="small"
              >
                <template #append>
                  <el-button @click="copyLink(row.code)">
                    <el-icon><DocumentCopy /></el-icon>
                  </el-button>
                </template>
              </el-input>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'info'">
              {{ row.is_active ? '激活' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="点击次数" prop="click_count" width="100" />
        <el-table-column label="注册次数" prop="register_count" width="100" />
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewRegistrations(row)">
              查看注册
            </el-button>
            <el-button
              link
              :type="row.is_active ? 'warning' : 'success'"
              @click="handleToggle(row)"
            >
              {{ row.is_active ? '禁用' : '激活' }}
            </el-button>
            <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @current-change="loadReferrals"
          @size-change="loadReferrals"
        />
      </div>
    </el-card>

    <!-- 创建推荐链接弹窗 -->
    <el-dialog v-model="createDialogVisible" title="创建推荐链接" width="500px">
      <el-form>
        <el-form-item label="选择用户">
          <el-select
            v-model="selectedUserId"
            filterable
            remote
            :remote-method="searchUsers"
            :loading="searchLoading"
            placeholder="请输入用户账号或昵称搜索"
            style="width: 100%"
          >
            <el-option
              v-for="user in userOptions"
              :key="user.id"
              :label="`${user.nickname} (${user.account})`"
              :value="user.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="createLoading" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- 注册用户列表弹窗 -->
    <el-dialog v-model="registrationsDialogVisible" title="通过此链接注册的用户" width="600px">
      <el-table :data="registrations" v-loading="loadingRegistrations">
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
            {{ formatDate(row.user_created_at) }}
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination" v-if="registrationsTotal > 20">
        <el-pagination
          v-model:current-page="registrationsPage"
          :total="registrationsTotal"
          :page-size="20"
          layout="prev, pager, next"
          @current-change="loadRegistrations"
        />
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { DocumentCopy } from '@element-plus/icons-vue'
import { referralsApi, usersApi } from '@/api'
import type { ReferralLink, ReferralRegistration, User } from '@/types'
import dayjs from 'dayjs'

// 客户端基础 URL（可在环境变量中配置）
const CLIENT_BASE_URL = import.meta.env.VITE_CLIENT_URL || 'http://localhost:8080'

const referrals = ref<ReferralLink[]>([])
const loading = ref(false)
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

const createDialogVisible = ref(false)
const selectedUserId = ref<number | null>(null)
const userOptions = ref<User[]>([])
const searchLoading = ref(false)
const createLoading = ref(false)

const registrationsDialogVisible = ref(false)
const registrations = ref<ReferralRegistration[]>([])
const loadingRegistrations = ref(false)
const currentReferralId = ref<number | null>(null)
const registrationsPage = ref(1)
const registrationsTotal = ref(0)

function formatDate(date: string) {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

async function loadReferrals() {
  loading.value = true
  try {
    const res = await referralsApi.getList({
      page: currentPage.value,
      limit: pageSize.value
    })
    referrals.value = res.data.list
    total.value = res.data.total
  } catch (error) {
    console.error('加载推荐链接失败:', error)
  } finally {
    loading.value = false
  }
}

function getReferralLink(code: string) {
  return `${CLIENT_BASE_URL}/#/pages/referral/index?code=${code}`
}

function copyLink(code: string) {
  const link = getReferralLink(code)
  navigator.clipboard.writeText(link)
  ElMessage.success('推荐链接已复制')
}

function showCreateDialog() {
  selectedUserId.value = null
  userOptions.value = []
  createDialogVisible.value = true
}

async function searchUsers(query: string) {
  if (!query) {
    userOptions.value = []
    return
  }

  searchLoading.value = true
  try {
    const res = await usersApi.getList({ keyword: query, limit: 10 })
    userOptions.value = res.data.list
  } catch (error) {
    console.error('搜索用户失败:', error)
  } finally {
    searchLoading.value = false
  }
}

async function handleCreate() {
  if (!selectedUserId.value) {
    ElMessage.warning('请选择用户')
    return
  }

  createLoading.value = true
  try {
    await referralsApi.create(selectedUserId.value)
    ElMessage.success('创建成功')
    createDialogVisible.value = false
    loadReferrals()
  } catch (error) {
    console.error('创建失败:', error)
  } finally {
    createLoading.value = false
  }
}

async function handleToggle(row: ReferralLink) {
  try {
    await referralsApi.toggle(row.id)
    ElMessage.success('操作成功')
    loadReferrals()
  } catch (error) {
    console.error('操作失败:', error)
  }
}

async function handleDelete(row: ReferralLink) {
  try {
    await ElMessageBox.confirm('确定要删除该推荐链接吗？', '确认删除', { type: 'warning' })
    await referralsApi.delete(row.id)
    ElMessage.success('删除成功')
    loadReferrals()
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
    }
  }
}

async function viewRegistrations(row: ReferralLink) {
  currentReferralId.value = row.id
  registrationsPage.value = 1
  registrationsDialogVisible.value = true
  await loadRegistrations()
}

async function loadRegistrations() {
  if (!currentReferralId.value) return

  loadingRegistrations.value = true
  try {
    const res = await referralsApi.getRegistrations(currentReferralId.value, {
      page: registrationsPage.value,
      limit: 20
    })
    registrations.value = res.data.list
    registrationsTotal.value = res.data.total
  } catch (error) {
    console.error('加载注册记录失败:', error)
  } finally {
    loadingRegistrations.value = false
  }
}

onMounted(() => {
  loadReferrals()
})
</script>

<style scoped lang="scss">
.referrals-page {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

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

  .link-cell {
    :deep(.el-input__inner) {
      font-size: 12px;
    }
  }

  .pagination {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }
}
</style>
