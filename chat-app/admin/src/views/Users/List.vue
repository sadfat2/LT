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
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewDetail(row)">详情</el-button>
            <el-button link type="primary" @click="viewMessages(row)">聊天记录</el-button>
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
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
}
</style>
