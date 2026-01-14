<template>
  <div class="messages-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <el-button @click="router.back()">
            <el-icon><ArrowLeft /></el-icon>
            返回
          </el-button>
          <span class="title">{{ userName }} 的聊天记录</span>
        </div>
      </template>

      <el-row :gutter="20">
        <!-- 会话列表 -->
        <el-col :span="8">
          <div class="conversation-list">
            <h4>会话列表</h4>
            <div v-if="conversations.length === 0" class="empty">暂无会话</div>
            <div
              v-for="conv in conversations"
              :key="conv.id"
              :class="['conversation-item', { active: selectedConvId === conv.id }]"
              @click="selectConversation(conv.id)"
            >
              <el-avatar :size="40" :src="conv.target?.avatar || undefined">
                {{ conv.target?.nickname?.charAt(0) || conv.target?.name?.charAt(0) || '?' }}
              </el-avatar>
              <div class="conv-info">
                <div class="conv-name">{{ conv.target?.nickname || conv.target?.name || '未知' }}</div>
                <div class="conv-meta">
                  <el-tag size="small" :type="conv.type === 'private' ? 'primary' : 'success'">
                    {{ conv.type === 'private' ? '私聊' : '群聊' }}
                  </el-tag>
                  <span class="message-count">{{ conv.message_count }} 条消息</span>
                </div>
              </div>
            </div>
          </div>
        </el-col>

        <!-- 消息列表 -->
        <el-col :span="16">
          <div class="message-list" v-loading="loadingMessages">
            <h4>消息记录</h4>
            <div v-if="!selectedConvId" class="empty">请选择一个会话</div>
            <div v-else-if="messages.length === 0" class="empty">暂无消息</div>
            <div v-else>
              <div
                v-for="msg in messages"
                :key="msg.id"
                :class="['message-item', { 'is-self': msg.sender_id === userId }]"
              >
                <el-avatar :size="36" :src="msg.sender_avatar || undefined">
                  {{ msg.sender_nickname?.charAt(0) || '?' }}
                </el-avatar>
                <div class="message-content">
                  <div class="message-header">
                    <span class="sender-name">{{ msg.sender_nickname }}</span>
                    <span class="message-time">{{ formatDate(msg.created_at) }}</span>
                  </div>
                  <div class="message-body">
                    <!-- 文本消息 -->
                    <template v-if="msg.type === 'text'">
                      {{ msg.content }}
                    </template>
                    <!-- 图片消息 -->
                    <template v-else-if="msg.type === 'image'">
                      <el-image
                        :src="msg.media_url || ''"
                        style="max-width: 200px; max-height: 200px;"
                        fit="contain"
                        :preview-src-list="[msg.media_url || '']"
                      />
                    </template>
                    <!-- 语音消息 -->
                    <template v-else-if="msg.type === 'voice'">
                      <div class="voice-message">
                        <el-icon><Microphone /></el-icon>
                        <span>语音消息 {{ msg.duration }}秒</span>
                      </div>
                    </template>
                    <!-- 文件消息 -->
                    <template v-else-if="msg.type === 'file'">
                      <div class="file-message">
                        <el-icon><Document /></el-icon>
                        <span>{{ msg.file_name }}</span>
                      </div>
                    </template>
                    <!-- 视频消息 -->
                    <template v-else-if="msg.type === 'video'">
                      <div class="video-message">
                        <el-icon><VideoCamera /></el-icon>
                        <span>视频消息 {{ msg.duration }}秒</span>
                      </div>
                    </template>
                    <!-- 系统消息 -->
                    <template v-else-if="msg.type === 'system'">
                      <el-tag type="info" size="small">{{ msg.content }}</el-tag>
                    </template>
                  </div>
                </div>
              </div>

              <!-- 分页 -->
              <div class="pagination">
                <el-pagination
                  v-model:current-page="currentPage"
                  :total="totalMessages"
                  :page-size="pageSize"
                  layout="prev, pager, next"
                  @current-change="loadMessages"
                />
              </div>
            </div>
          </div>
        </el-col>
      </el-row>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ArrowLeft, Microphone, Document, VideoCamera } from '@element-plus/icons-vue'
import { usersApi } from '@/api'
import type { Conversation, Message } from '@/types'
import dayjs from 'dayjs'

const router = useRouter()
const route = useRoute()

const userId = Number(route.params.id)
const userName = ref('')
const conversations = ref<Conversation[]>([])
const messages = ref<Message[]>([])
const selectedConvId = ref<number | null>(null)
const loadingMessages = ref(false)
const currentPage = ref(1)
const totalMessages = ref(0)
const pageSize = 50

function formatDate(date: string) {
  return dayjs(date).format('MM-DD HH:mm')
}

async function loadConversations() {
  try {
    const [convRes, userRes] = await Promise.all([
      usersApi.getConversations(userId),
      usersApi.getDetail(userId)
    ])
    conversations.value = convRes.data
    userName.value = userRes.data.nickname
  } catch (error) {
    console.error('加载会话失败:', error)
  }
}

async function selectConversation(convId: number) {
  selectedConvId.value = convId
  currentPage.value = 1
  await loadMessages()
}

async function loadMessages() {
  if (!selectedConvId.value) return

  loadingMessages.value = true
  try {
    const res = await usersApi.getMessages(userId, {
      conversationId: selectedConvId.value,
      page: currentPage.value,
      limit: pageSize
    })
    messages.value = res.data.list
    totalMessages.value = res.data.total
  } catch (error) {
    console.error('加载消息失败:', error)
  } finally {
    loadingMessages.value = false
  }
}

onMounted(() => {
  loadConversations()
})
</script>

<style scoped lang="scss">
.messages-page {
  .card-header {
    display: flex;
    align-items: center;
    gap: 16px;

    .title {
      font-size: 16px;
      font-weight: 500;
    }
  }

  .conversation-list {
    border-right: 1px solid #f0f0f0;
    padding-right: 20px;
    max-height: 600px;
    overflow-y: auto;

    h4 {
      margin-bottom: 16px;
    }

    .empty {
      color: #909399;
      text-align: center;
      padding: 40px 0;
    }

    .conversation-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border-radius: 8px;
      cursor: pointer;
      margin-bottom: 8px;

      &:hover {
        background-color: #f5f7fa;
      }

      &.active {
        background-color: #ecf5ff;
      }

      .conv-info {
        flex: 1;
        min-width: 0;

        .conv-name {
          font-weight: 500;
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .conv-meta {
          display: flex;
          align-items: center;
          gap: 8px;

          .message-count {
            font-size: 12px;
            color: #909399;
          }
        }
      }
    }
  }

  .message-list {
    max-height: 600px;
    overflow-y: auto;

    h4 {
      margin-bottom: 16px;
    }

    .empty {
      color: #909399;
      text-align: center;
      padding: 40px 0;
    }

    .message-item {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;

      &.is-self {
        .message-body {
          background-color: #ecf5ff;
        }
      }

      .message-content {
        flex: 1;

        .message-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;

          .sender-name {
            font-weight: 500;
            font-size: 13px;
          }

          .message-time {
            font-size: 12px;
            color: #909399;
          }
        }

        .message-body {
          background-color: #f5f7fa;
          padding: 8px 12px;
          border-radius: 8px;
          display: inline-block;
          max-width: 80%;
          word-break: break-word;
        }
      }
    }

    .voice-message,
    .file-message,
    .video-message {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #409eff;
    }

    .pagination {
      margin-top: 20px;
      display: flex;
      justify-content: center;
    }
  }
}
</style>
