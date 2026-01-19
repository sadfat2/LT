<template>
  <div class="users-page">
    <el-card>
      <!-- 搜索栏 -->
      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索账号或昵称"
          style="width: 240px"
          clearable
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select v-model="statusFilter" placeholder="状态筛选" clearable style="width: 120px; margin-left: 12px;">
          <el-option label="正常" value="active" />
          <el-option label="封停" value="banned" />
        </el-select>
        <el-button type="primary" style="margin-left: 12px" @click="handleSearch">搜索</el-button>
        <el-button type="success" style="margin-left: 12px" @click="openCreateDialog">
          <el-icon style="margin-right: 4px"><Plus /></el-icon>
          新增用户
        </el-button>
      </div>

      <!-- 用户列表 -->
      <el-table :data="users" v-loading="loading" style="margin-top: 20px">
        <el-table-column label="用户" min-width="200">
          <template #default="{ row }">
            <div class="user-cell">
              <el-avatar :size="40" :src="row.avatar || undefined">
                {{ row.nickname?.charAt(0) || row.account?.charAt(0) }}
              </el-avatar>
              <div class="user-info">
                <div class="nickname">{{ row.nickname }}</div>
                <div class="account">{{ row.account }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'danger'">
              {{ row.status === 'active' ? '正常' : '封停' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="在线" width="80">
          <template #default="{ row }">
            <el-tag :type="row.is_online ? 'success' : 'info'" size="small">
              {{ row.is_online ? '在线' : '离线' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="推荐链接" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.referral_code" :type="row.referral_active ? 'primary' : 'info'" size="small">
              {{ row.referral_code }}
            </el-tag>
            <span v-else class="text-gray">-</span>
          </template>
        </el-table-column>
        <el-table-column label="注册时间" prop="created_at" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewDetail(row)">详情</el-button>
            <el-button link type="primary" @click="viewMessages(row)">聊天记录</el-button>
            <el-button link type="warning" @click="handleResetPassword(row)">重置密码</el-button>
            <el-button
              v-if="row.status === 'active'"
              link
              type="danger"
              @click="handleBan(row)"
            >封停</el-button>
            <el-button
              v-else
              link
              type="success"
              @click="handleUnban(row)"
            >解封</el-button>
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
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="loadUsers"
          @size-change="loadUsers"
        />
      </div>
    </el-card>

    <!-- 封停弹窗 -->
    <el-dialog v-model="banDialogVisible" title="封停用户" width="400px">
      <el-form>
        <el-form-item label="封停原因">
          <el-input
            v-model="banReason"
            type="textarea"
            :rows="3"
            placeholder="请输入封停原因（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="banDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="banLoading" @click="confirmBan">确认封停</el-button>
      </template>
    </el-dialog>

    <!-- 新增用户弹窗 -->
    <el-dialog v-model="createDialogVisible" title="新增用户" width="450px">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="80px">
        <el-form-item label="账号" prop="account">
          <el-input
            v-model="createForm.account"
            placeholder="4-20位字母或数字"
            maxlength="20"
          />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="createForm.password"
            type="password"
            placeholder="6-20位字符"
            maxlength="20"
            show-password
          />
        </el-form-item>
        <el-form-item label="昵称" prop="nickname">
          <el-input
            v-model="createForm.nickname"
            placeholder="可选，不填则使用账号作为昵称"
            maxlength="20"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="createLoading" @click="confirmCreate">确认创建</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码弹窗 -->
    <el-dialog v-model="resetPasswordDialogVisible" title="重置用户密码" width="450px">
      <div v-if="currentResetUser" class="reset-user-info">
        用户: {{ currentResetUser.nickname }} (账号: {{ currentResetUser.account }})
      </div>
      <el-form ref="resetPasswordFormRef" :model="resetPasswordForm" :rules="resetPasswordRules" label-width="80px">
        <el-form-item label="新密码" prop="newPassword">
          <el-input
            v-model="resetPasswordForm.newPassword"
            type="password"
            placeholder="6-20位字符"
            maxlength="20"
            show-password
          />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input
            v-model="resetPasswordForm.confirmPassword"
            type="password"
            placeholder="再次输入密码"
            maxlength="20"
            show-password
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resetPasswordDialogVisible = false">取消</el-button>
        <el-button type="warning" :loading="resetPasswordLoading" @click="confirmResetPassword">确认重置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { usersApi } from '@/api'
import type { User } from '@/types'
import dayjs from 'dayjs'

const router = useRouter()

const users = ref<User[]>([])
const loading = ref(false)
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const searchKeyword = ref('')
const statusFilter = ref('')

const banDialogVisible = ref(false)
const banReason = ref('')
const banLoading = ref(false)
const currentBanUser = ref<User | null>(null)

// 新增用户相关
const createDialogVisible = ref(false)
const createLoading = ref(false)
const createFormRef = ref<FormInstance>()
const createForm = ref({
  account: '',
  password: '',
  nickname: ''
})
const createRules: FormRules = {
  account: [
    { required: true, message: '请输入账号', trigger: 'blur' },
    { min: 4, max: 20, message: '账号长度为4-20位', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9]+$/, message: '账号只能包含字母和数字', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 20, message: '密码长度为6-20位', trigger: 'blur' }
  ]
}

// 重置密码相关
const resetPasswordDialogVisible = ref(false)
const resetPasswordLoading = ref(false)
const resetPasswordFormRef = ref<FormInstance>()
const currentResetUser = ref<User | null>(null)
const resetPasswordForm = ref({
  newPassword: '',
  confirmPassword: ''
})
const resetPasswordRules: FormRules = {
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 20, message: '密码长度为6-20位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    {
      validator: (_rule: any, value: string, callback: (error?: Error) => void) => {
        if (value !== resetPasswordForm.value.newPassword) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

function formatDate(date: string) {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

async function loadUsers() {
  loading.value = true
  try {
    const res = await usersApi.getList({
      page: currentPage.value,
      limit: pageSize.value,
      keyword: searchKeyword.value,
      status: statusFilter.value
    })
    users.value = res.data.list
    total.value = res.data.total
  } catch (error) {
    console.error('加载用户列表失败:', error)
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  currentPage.value = 1
  loadUsers()
}

function viewDetail(user: User) {
  router.push(`/users/${user.id}`)
}

function viewMessages(user: User) {
  router.push(`/users/${user.id}/messages`)
}

function handleBan(user: User) {
  currentBanUser.value = user
  banReason.value = ''
  banDialogVisible.value = true
}

async function confirmBan() {
  if (!currentBanUser.value) return

  banLoading.value = true
  try {
    await usersApi.ban(currentBanUser.value.id, banReason.value)
    ElMessage.success('封停成功')
    banDialogVisible.value = false
    loadUsers()
  } catch (error) {
    console.error('封停失败:', error)
  } finally {
    banLoading.value = false
  }
}

async function handleUnban(user: User) {
  try {
    await ElMessageBox.confirm(`确定要解封用户 "${user.nickname}" 吗？`, '确认解封')
    await usersApi.unban(user.id)
    ElMessage.success('解封成功')
    loadUsers()
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('解封失败:', error)
    }
  }
}

function openCreateDialog() {
  createForm.value = {
    account: '',
    password: '',
    nickname: ''
  }
  createDialogVisible.value = true
}

async function confirmCreate() {
  if (!createFormRef.value) return

  try {
    await createFormRef.value.validate()
  } catch {
    return
  }

  createLoading.value = true
  try {
    await usersApi.create({
      account: createForm.value.account,
      password: createForm.value.password,
      nickname: createForm.value.nickname || undefined
    })
    ElMessage.success('用户创建成功')
    createDialogVisible.value = false
    loadUsers()
  } catch (error: any) {
    const message = error?.response?.data?.message || '创建失败，请重试'
    ElMessage.error(message)
  } finally {
    createLoading.value = false
  }
}

function handleResetPassword(user: User) {
  currentResetUser.value = user
  resetPasswordForm.value = {
    newPassword: '',
    confirmPassword: ''
  }
  resetPasswordDialogVisible.value = true
}

async function confirmResetPassword() {
  if (!resetPasswordFormRef.value || !currentResetUser.value) return

  try {
    await resetPasswordFormRef.value.validate()
  } catch {
    return
  }

  resetPasswordLoading.value = true
  try {
    await usersApi.resetPassword(currentResetUser.value.id, resetPasswordForm.value.newPassword)
    ElMessage.success('密码重置成功')
    resetPasswordDialogVisible.value = false
  } catch (error: any) {
    const message = error?.response?.data?.message || '重置失败，请重试'
    ElMessage.error(message)
  } finally {
    resetPasswordLoading.value = false
  }
}

onMounted(() => {
  loadUsers()
})
</script>

<style scoped lang="scss">
.users-page {
  .search-bar {
    display: flex;
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

  .text-gray {
    color: #c0c4cc;
  }

  .pagination {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }

  .reset-user-info {
    padding: 12px;
    margin-bottom: 16px;
    background: #f5f7fa;
    border-radius: 4px;
    color: #606266;
    font-size: 14px;
  }
}
</style>
