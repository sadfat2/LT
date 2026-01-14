<template>
  <div class="admins-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>管理员管理</span>
          <el-button type="primary" @click="showCreateDialog">添加管理员</el-button>
        </div>
      </template>

      <!-- 管理员列表 -->
      <el-table :data="admins" v-loading="loading">
        <el-table-column label="用户名" prop="username" width="150" />
        <el-table-column label="昵称" prop="nickname" width="150">
          <template #default="{ row }">
            {{ row.nickname || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="最后登录时间" width="180">
          <template #default="{ row }">
            {{ row.last_login_at ? formatDate(row.last_login_at) : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="最后登录IP" prop="last_login_ip" width="150">
          <template #default="{ row }">
            {{ row.last_login_ip || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="showEditDialog(row)">编辑</el-button>
            <el-button
              link
              type="danger"
              :disabled="row.id === currentAdminId"
              @click="handleDelete(row)"
            >删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 创建/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑管理员' : '添加管理员'"
      width="450px"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="80px"
      >
        <el-form-item label="用户名" prop="username" v-if="!isEdit">
          <el-input v-model="form.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="昵称" prop="nickname">
          <el-input v-model="form.nickname" placeholder="请输入昵称" />
        </el-form-item>
        <el-form-item label="密码" :prop="isEdit ? '' : 'password'">
          <el-input
            v-model="form.password"
            type="password"
            :placeholder="isEdit ? '不修改请留空' : '请输入密码'"
            show-password
          />
        </el-form-item>
        <el-form-item label="确认密码" v-if="form.password">
          <el-input
            v-model="form.confirmPassword"
            type="password"
            placeholder="请再次输入密码"
            show-password
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { adminsApi } from '@/api'
import { useAdminStore } from '@/store'
import type { Admin } from '@/types'
import dayjs from 'dayjs'

const adminStore = useAdminStore()
const currentAdminId = computed(() => adminStore.adminInfo?.id)

const admins = ref<Admin[]>([])
const loading = ref(false)

const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const submitLoading = ref(false)

const form = reactive({
  username: '',
  nickname: '',
  password: '',
  confirmPassword: ''
})

const rules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_]{4,20}$/, message: '用户名需要4-20位字母、数字或下划线', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 20, message: '密码长度需要6-20位', trigger: 'blur' }
  ]
}

function formatDate(date: string) {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

async function loadAdmins() {
  loading.value = true
  try {
    const res = await adminsApi.getList()
    admins.value = res.data
  } catch (error) {
    console.error('加载管理员列表失败:', error)
  } finally {
    loading.value = false
  }
}

function showCreateDialog() {
  isEdit.value = false
  editingId.value = null
  form.username = ''
  form.nickname = ''
  form.password = ''
  form.confirmPassword = ''
  dialogVisible.value = true
}

function showEditDialog(admin: Admin) {
  isEdit.value = true
  editingId.value = admin.id
  form.username = admin.username
  form.nickname = admin.nickname || ''
  form.password = ''
  form.confirmPassword = ''
  dialogVisible.value = true
}

async function handleSubmit() {
  if (!formRef.value) return

  // 验证密码确认
  if (form.password && form.password !== form.confirmPassword) {
    ElMessage.error('两次输入的密码不一致')
    return
  }

  await formRef.value.validate(async (valid) => {
    if (!valid) return

    submitLoading.value = true
    try {
      if (isEdit.value && editingId.value) {
        const data: { nickname?: string; password?: string } = {}
        if (form.nickname) data.nickname = form.nickname
        if (form.password) data.password = form.password
        await adminsApi.update(editingId.value, data)
        ElMessage.success('更新成功')
      } else {
        await adminsApi.create({
          username: form.username,
          password: form.password,
          nickname: form.nickname || undefined
        })
        ElMessage.success('创建成功')
      }
      dialogVisible.value = false
      loadAdmins()
    } catch (error) {
      console.error('操作失败:', error)
    } finally {
      submitLoading.value = false
    }
  })
}

async function handleDelete(admin: Admin) {
  try {
    await ElMessageBox.confirm(
      `确定要删除管理员 "${admin.username}" 吗？`,
      '确认删除',
      { type: 'warning' }
    )
    await adminsApi.delete(admin.id)
    ElMessage.success('删除成功')
    loadAdmins()
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
    }
  }
}

onMounted(() => {
  loadAdmins()
})
</script>

<style scoped lang="scss">
.admins-page {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}
</style>
