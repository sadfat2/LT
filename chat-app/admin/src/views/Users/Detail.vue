<template>
  <div class="user-detail" v-loading="loading">
    <el-card v-if="user">
      <template #header>
        <div class="card-header">
          <el-button @click="router.back()">
            <el-icon><ArrowLeft /></el-icon>
            返回
          </el-button>
          <span class="title">用户详情</span>
        </div>
      </template>

      <el-row :gutter="24">
        <!-- 基本信息 -->
        <el-col :span="8">
          <div class="user-profile">
            <el-avatar :size="100" :src="user.avatar || undefined">
              {{ user.nickname?.charAt(0) || user.account?.charAt(0) }}
            </el-avatar>
            <h2 class="nickname">{{ user.nickname }}</h2>
            <p class="account">账号: {{ user.account }}</p>
            <div class="status-tags">
              <el-tag :type="user.status === 'active' ? 'success' : 'danger'" size="large">
                {{ user.status === 'active' ? '正常' : '封停' }}
              </el-tag>
              <el-tag :type="user.is_online ? 'success' : 'info'" size="large">
                {{ user.is_online ? '在线' : '离线' }}
              </el-tag>
            </div>
            <div class="actions">
              <el-button
                v-if="user.status === 'active'"
                type="danger"
                @click="handleBan"
              >封停账号</el-button>
              <el-button
                v-else
                type="success"
                @click="handleUnban"
              >解封账号</el-button>
              <el-button @click="viewMessages">查看聊天记录</el-button>
            </div>
          </div>
        </el-col>

        <!-- 详细信息 -->
        <el-col :span="16">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="用户ID">{{ user.id }}</el-descriptions-item>
            <el-descriptions-item label="注册时间">{{ formatDate(user.created_at) }}</el-descriptions-item>
            <el-descriptions-item label="好友数量">{{ user.friend_count }}</el-descriptions-item>
            <el-descriptions-item label="群组数量">{{ user.group_count }}</el-descriptions-item>
            <el-descriptions-item label="消息数量">{{ user.message_count }}</el-descriptions-item>
            <el-descriptions-item label="个性签名" :span="2">
              {{ user.signature || '暂无签名' }}
            </el-descriptions-item>
          </el-descriptions>

          <!-- 封停信息 -->
          <el-descriptions v-if="user.status === 'banned'" :column="1" border class="ban-info">
            <el-descriptions-item label="封停时间">{{ formatDate(user.banned_at) }}</el-descriptions-item>
            <el-descriptions-item label="封停原因">{{ user.banned_reason || '无' }}</el-descriptions-item>
          </el-descriptions>

          <!-- 推荐链接 -->
          <div class="referral-section">
            <h3>推荐链接</h3>
            <div v-if="user.referral_link">
              <el-descriptions :column="2" border>
                <el-descriptions-item label="推荐码">
                  <el-tag>{{ user.referral_link.code }}</el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="状态">
                  <el-tag :type="user.referral_link.is_active ? 'success' : 'info'">
                    {{ user.referral_link.is_active ? '已激活' : '已禁用' }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="点击次数">{{ user.referral_link.click_count }}</el-descriptions-item>
                <el-descriptions-item label="注册次数">{{ user.referral_link.register_count }}</el-descriptions-item>
              </el-descriptions>
              <el-button
                style="margin-top: 12px"
                :type="user.referral_link.is_active ? 'warning' : 'success'"
                @click="toggleReferral"
              >
                {{ user.referral_link.is_active ? '禁用链接' : '激活链接' }}
              </el-button>
            </div>
            <div v-else>
              <p class="no-data">该用户暂无推荐链接</p>
              <el-button type="primary" @click="createReferral">创建推荐链接</el-button>
            </div>
          </div>
        </el-col>
      </el-row>
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
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { usersApi, referralsApi } from '@/api'
import type { UserDetail } from '@/types'
import dayjs from 'dayjs'

const router = useRouter()
const route = useRoute()

const user = ref<UserDetail | null>(null)
const loading = ref(false)

const banDialogVisible = ref(false)
const banReason = ref('')
const banLoading = ref(false)

const userId = Number(route.params.id)

function formatDate(date: string | null) {
  if (!date) return '-'
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

async function loadUser() {
  loading.value = true
  try {
    const res = await usersApi.getDetail(userId)
    user.value = res.data
  } catch (error) {
    console.error('加载用户详情失败:', error)
    router.back()
  } finally {
    loading.value = false
  }
}

function viewMessages() {
  router.push(`/users/${userId}/messages`)
}

function handleBan() {
  banReason.value = ''
  banDialogVisible.value = true
}

async function confirmBan() {
  banLoading.value = true
  try {
    await usersApi.ban(userId, banReason.value)
    ElMessage.success('封停成功')
    banDialogVisible.value = false
    loadUser()
  } catch (error) {
    console.error('封停失败:', error)
  } finally {
    banLoading.value = false
  }
}

async function handleUnban() {
  try {
    await ElMessageBox.confirm('确定要解封该用户吗？', '确认解封')
    await usersApi.unban(userId)
    ElMessage.success('解封成功')
    loadUser()
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('解封失败:', error)
    }
  }
}

async function createReferral() {
  try {
    await referralsApi.create(userId)
    ElMessage.success('创建成功')
    loadUser()
  } catch (error) {
    console.error('创建推荐链接失败:', error)
  }
}

async function toggleReferral() {
  if (!user.value?.referral_link) return
  try {
    await referralsApi.toggle(user.value.referral_link.id)
    ElMessage.success('操作成功')
    loadUser()
  } catch (error) {
    console.error('操作失败:', error)
  }
}

onMounted(() => {
  loadUser()
})
</script>

<style scoped lang="scss">
.user-detail {
  .card-header {
    display: flex;
    align-items: center;
    gap: 16px;

    .title {
      font-size: 16px;
      font-weight: 500;
    }
  }

  .user-profile {
    text-align: center;
    padding: 20px;

    .nickname {
      margin: 16px 0 8px;
      font-size: 24px;
    }

    .account {
      color: #909399;
      margin-bottom: 16px;
    }

    .status-tags {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-bottom: 24px;
    }

    .actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
  }

  .ban-info {
    margin-top: 20px;

    :deep(.el-descriptions__label) {
      background-color: #fef0f0;
    }
  }

  .referral-section {
    margin-top: 24px;

    h3 {
      margin-bottom: 16px;
      font-size: 16px;
    }

    .no-data {
      color: #909399;
      margin-bottom: 12px;
    }
  }
}
</style>
