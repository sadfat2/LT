<template>
  <view class="chat-page">
    <!-- 消息列表 -->
    <scroll-view
      ref="scrollView"
      scroll-y
      class="message-list"
      :scroll-top="scrollTop"
      :scroll-into-view="scrollIntoView"
      @scrolltoupper="loadMore"
    >
      <view v-if="hasMore" class="load-more" @click="loadMore">
        {{ loading ? '加载中...' : '加载更多' }}
      </view>

      <view
        v-for="(message, index) in messages"
        :key="message.id"
        :id="`msg-${message.id}`"
        class="message-item"
        :class="{ self: message.sender_id === currentUserId }"
      >
        <!-- 时间分割 -->
        <view
          v-if="shouldShowTime(message, index)"
          class="time-divider"
        >
          {{ formatMessageTime(message.created_at) }}
        </view>

        <!-- 消息气泡 -->
        <view class="message-content">
          <image
            v-if="message.sender_id !== currentUserId"
            class="avatar-small"
            :src="otherUser?.avatar || '/static/images/default-avatar.png'"
            mode="aspectFill"
          />

          <view
            class="bubble"
            :class="{ revoked: message.status === 'revoked' }"
            @longpress="showMessageActions(message)"
          >
            <!-- 文本消息 -->
            <text v-if="message.type === 'text'" class="text-content">
              {{ message.content }}
            </text>

            <!-- 图片消息 -->
            <image
              v-else-if="message.type === 'image'"
              class="image-content"
              :src="message.media_url"
              mode="widthFix"
              @click="previewImage(message.media_url)"
            />

            <!-- 语音消息 -->
            <view
              v-else-if="message.type === 'voice'"
              class="voice-content"
              @click="playVoice(message)"
            >
              <view class="voice-icon" :class="{ playing: playingId === message.id }">
                <view class="voice-wave"></view>
                <view class="voice-wave"></view>
                <view class="voice-wave"></view>
              </view>
              <text class="voice-duration">{{ message.duration }}''</text>
            </view>
          </view>

          <image
            v-if="message.sender_id === currentUserId"
            class="avatar-small"
            :src="currentUser?.avatar || '/static/images/default-avatar.png'"
            mode="aspectFill"
          />
        </view>

        <!-- 消息状态 -->
        <view
          v-if="message.sender_id === currentUserId"
          class="message-status"
        >
          <text v-if="message.status === 'sending'" class="status sending">发送中</text>
          <text v-else-if="message.status === 'read'" class="status read">已读</text>
        </view>
      </view>
    </scroll-view>

    <!-- 正在输入提示 -->
    <view v-if="isTyping" class="typing-hint">
      对方正在输入...
    </view>

    <!-- 输入区域 -->
    <view class="input-area">
      <view class="input-row">
        <view class="voice-switch" @click="toggleVoice">
          <text>{{ showVoice ? '键盘' : '语音' }}</text>
        </view>

        <!-- 文本输入 -->
        <input
          v-if="!showVoice"
          v-model="inputText"
          class="text-input"
          type="text"
          placeholder="输入消息..."
          confirm-type="send"
          @confirm="sendTextMessage"
          @input="onInput"
        />

        <!-- 语音按钮 -->
        <view
          v-else
          class="voice-btn"
          @touchstart="startRecord"
          @touchend="stopRecord"
          @touchcancel="cancelRecord"
          @touchmove="onRecordMove"
        >
          <text>{{ recording ? '松开发送' : '按住说话' }}</text>
        </view>

        <view class="more-btn" @click="toggleMore">
          <text>+</text>
        </view>

        <button
          v-if="inputText.trim()"
          class="send-btn"
          @click="sendTextMessage"
        >
          发送
        </button>
      </view>

      <!-- 更多面板 -->
      <view v-if="showMore" class="more-panel">
        <view class="panel-item" @click="chooseImage">
          <view class="panel-icon">
            <text>图</text>
          </view>
          <text class="panel-text">相册</text>
        </view>
        <view class="panel-item" @click="takePhoto">
          <view class="panel-icon">
            <text>拍</text>
          </view>
          <text class="panel-text">拍照</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useConversationStore } from '../../store/conversation'
import { useSocketStore } from '../../store/socket'
import { useUserStore } from '../../store/user'
import { uploadApi } from '../../api'
import type { Message, User } from '../../types'

const conversationStore = useConversationStore()
const socketStore = useSocketStore()
const userStore = useUserStore()

const conversationId = ref<number>(0)
const otherUserId = ref<number>(0)
const otherUser = ref<User | null>(null)

const messages = ref<Message[]>([])
const inputText = ref('')
const showVoice = ref(false)
const showMore = ref(false)
const recording = ref(false)
const playingId = ref<number | null>(null)
const isTyping = ref(false)
const loading = ref(false)
const hasMore = ref(true)
const page = ref(1)

const scrollTop = ref(0)
const scrollIntoView = ref('')

const currentUserId = computed(() => userStore.user?.id)
const currentUser = computed(() => userStore.user)

let typingTimer: number | null = null
let innerAudioContext: UniApp.InnerAudioContext | null = null
let recorderManager: UniApp.RecorderManager | null = null
// H5 平台使用 HTML5 Audio
let h5Audio: HTMLAudioElement | null = null

onLoad((options) => {
  if (options?.conversationId) {
    conversationId.value = parseInt(options.conversationId)
  }
  if (options?.userId) {
    otherUserId.value = parseInt(options.userId)
  }
  if (options?.nickname) {
    uni.setNavigationBarTitle({ title: options.nickname })
    otherUser.value = {
      id: otherUserId.value,
      nickname: options.nickname,
      account: '',
      avatar: null,
      signature: null
    }
  }
})

onMounted(async () => {
  // 加载消息
  await loadMessages()

  // 监听新消息
  socketStore.on('new_message', handleNewMessage)

  // 监听消息已读
  socketStore.on('message_read_ack', handleReadAck)

  // 监听消息撤回
  socketStore.on('message_revoked', handleRevoked)

  // 监听对方输入
  socketStore.on('user_typing', handleTyping)

  // 滚动到底部
  scrollToBottom()

  // 初始化录音管理器（仅非 H5 平台）
  // #ifndef H5
  recorderManager = uni.getRecorderManager()
  recorderManager.onStop((res) => {
    if (recording.value) {
      sendVoiceMessage(res.tempFilePath, Math.round(res.duration / 1000))
    }
    recording.value = false
  })
  // #endif

  // 初始化音频播放器（仅非 H5 平台）
  // #ifndef H5
  innerAudioContext = uni.createInnerAudioContext()
  innerAudioContext.onEnded(() => {
    playingId.value = null
  })
  // #endif

  // #ifdef H5
  // H5 平台使用 HTML5 Audio
  h5Audio = new Audio()
  h5Audio.onended = () => {
    playingId.value = null
  }
  // #endif
})

onUnmounted(() => {
  socketStore.off('new_message', handleNewMessage)
  socketStore.off('message_read_ack', handleReadAck)
  socketStore.off('message_revoked', handleRevoked)
  socketStore.off('user_typing', handleTyping)

  // #ifndef H5
  if (innerAudioContext) {
    innerAudioContext.destroy()
  }
  // #endif

  // #ifdef H5
  if (h5Audio) {
    h5Audio.pause()
    h5Audio.src = ''
    h5Audio = null
  }
  // #endif
})

const loadMessages = async () => {
  if (!conversationId.value || loading.value) return

  loading.value = true
  try {
    const res = await conversationStore.fetchMessages(conversationId.value, page.value)
    messages.value = conversationStore.messages
    hasMore.value = res.hasMore
  } finally {
    loading.value = false
  }
}

const loadMore = async () => {
  if (!hasMore.value || loading.value) return
  page.value++
  await loadMessages()
}

const handleNewMessage = ({ conversationId: convId, message }: { conversationId: number; message: Message }) => {
  if (convId === conversationId.value) {
    messages.value.push(message)
    scrollToBottom()

    // 标记已读
    if (message.sender_id !== currentUserId.value) {
      socketStore.markMessageRead(convId, message.id)
    }
  }
}

const handleReadAck = ({ messageId }: { messageId: number }) => {
  const message = messages.value.find(m => m.id === messageId)
  if (message) {
    message.status = 'read'
  }
}

const handleRevoked = ({ messageId }: { messageId: number }) => {
  const message = messages.value.find(m => m.id === messageId)
  if (message) {
    message.status = 'revoked'
    message.content = '此消息已撤回'
  }
}

const handleTyping = ({ conversationId: convId, userId }: { conversationId: number; userId: number }) => {
  if (convId === conversationId.value && userId === otherUserId.value) {
    isTyping.value = true
    if (typingTimer) {
      clearTimeout(typingTimer)
    }
    typingTimer = setTimeout(() => {
      isTyping.value = false
    }, 3000) as unknown as number
  }
}

const sendTextMessage = () => {
  const text = inputText.value.trim()
  if (!text) return

  // 临时消息
  const tempMessage: Message = {
    id: Date.now(),
    conversation_id: conversationId.value,
    sender_id: currentUserId.value!,
    type: 'text',
    content: text,
    status: 'sending',
    created_at: new Date().toISOString()
  }
  messages.value.push(tempMessage)
  scrollToBottom()

  inputText.value = ''

  socketStore.sendMessage(
    {
      conversationId: conversationId.value || undefined,
      receiverId: otherUserId.value,
      type: 'text',
      content: text
    },
    (result) => {
      // 更新消息
      const index = messages.value.findIndex(m => m.id === tempMessage.id)
      if (index !== -1) {
        if (result.success && result.message) {
          messages.value[index] = result.message
          if (!conversationId.value) {
            conversationId.value = result.conversationId!
          }
        } else {
          messages.value[index].status = 'sent'
        }
      }
    }
  )
}

const sendVoiceMessage = async (filePath: string, duration: number) => {
  try {
    const res = await uploadApi.voice(filePath, duration)

    socketStore.sendMessage({
      conversationId: conversationId.value || undefined,
      receiverId: otherUserId.value,
      type: 'voice',
      content: '',
      mediaUrl: res.data.url,
      duration
    })
  } catch (error) {
    uni.showToast({ title: '发送语音失败', icon: 'none' })
  }
}

const chooseImage = async () => {
  showMore.value = false

  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album'],
    success: async (res) => {
      await sendImageMessage(res.tempFilePaths[0])
    }
  })
}

const takePhoto = () => {
  showMore.value = false

  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['camera'],
    success: async (res) => {
      await sendImageMessage(res.tempFilePaths[0])
    }
  })
}

const sendImageMessage = async (filePath: string) => {
  try {
    const res = await uploadApi.image(filePath)

    socketStore.sendMessage({
      conversationId: conversationId.value || undefined,
      receiverId: otherUserId.value,
      type: 'image',
      content: '',
      mediaUrl: res.data.url
    })
  } catch (error) {
    uni.showToast({ title: '发送图片失败', icon: 'none' })
  }
}

const onInput = () => {
  socketStore.sendTyping(conversationId.value, otherUserId.value)
}

const toggleVoice = () => {
  // #ifdef H5
  uni.showToast({ title: '语音功能仅支持 App/小程序', icon: 'none' })
  return
  // #endif
  showVoice.value = !showVoice.value
  showMore.value = false
}

const toggleMore = () => {
  showMore.value = !showMore.value
}

const startRecord = () => {
  recording.value = true
  recorderManager?.start({
    duration: 60000,
    format: 'mp3'
  })
}

const stopRecord = () => {
  if (recording.value) {
    recorderManager?.stop()
  }
}

const cancelRecord = () => {
  recording.value = false
  recorderManager?.stop()
}

const onRecordMove = (e: TouchEvent) => {
  // 上滑取消
  const touch = e.touches[0]
  if (touch.clientY < 200) {
    cancelRecord()
  }
}

const playVoice = (message: Message) => {
  if (!message.media_url) return

  // #ifdef H5
  // H5 平台使用 HTML5 Audio
  if (playingId.value === message.id) {
    h5Audio?.pause()
    if (h5Audio) h5Audio.currentTime = 0
    playingId.value = null
  } else {
    if (h5Audio) {
      h5Audio.src = message.media_url
      h5Audio.play().catch(() => {
        uni.showToast({ title: '播放失败', icon: 'none' })
      })
      playingId.value = message.id
    }
  }
  return
  // #endif

  // #ifndef H5
  if (playingId.value === message.id) {
    innerAudioContext?.stop()
    playingId.value = null
  } else {
    innerAudioContext!.src = message.media_url
    innerAudioContext?.play()
    playingId.value = message.id
  }
  // #endif
}

const previewImage = (url?: string) => {
  if (!url) return
  uni.previewImage({
    urls: [url],
    current: url
  })
}

const showMessageActions = (message: Message) => {
  if (message.status === 'revoked') return

  const items: string[] = []

  if (message.sender_id === currentUserId.value) {
    // 检查是否在2分钟内
    const messageTime = new Date(message.created_at).getTime()
    const now = Date.now()
    if (now - messageTime < 2 * 60 * 1000) {
      items.push('撤回')
    }
  }

  if (message.type === 'text') {
    items.push('复制')
  }

  if (items.length === 0) return

  uni.showActionSheet({
    itemList: items,
    success: (res) => {
      const action = items[res.tapIndex]
      if (action === '撤回') {
        revokeMessage(message)
      } else if (action === '复制') {
        uni.setClipboardData({
          data: message.content,
          success: () => {
            uni.showToast({ title: '已复制', icon: 'success' })
          }
        })
      }
    }
  })
}

const revokeMessage = (message: Message) => {
  socketStore.revokeMessage(message.id, conversationId.value, (result) => {
    if (result.success) {
      message.status = 'revoked'
      message.content = '此消息已撤回'
    } else {
      uni.showToast({ title: result.error || '撤回失败', icon: 'none' })
    }
  })
}

const shouldShowTime = (message: Message, index: number) => {
  if (index === 0) return true

  const prev = messages.value[index - 1]
  const prevTime = new Date(prev.created_at).getTime()
  const currTime = new Date(message.created_at).getTime()

  return currTime - prevTime > 5 * 60 * 1000 // 5分钟
}

const formatMessageTime = (time: string) => {
  const date = new Date(time)
  const now = new Date()

  if (date.toDateString() === now.toDateString()) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) {
    return `昨天 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messages.value.length > 0) {
      scrollIntoView.value = `msg-${messages.value[messages.value.length - 1].id}`
    }
  })
}
</script>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--bg-color);
}

.message-list {
  flex: 1;
  padding: 20rpx;
  overflow-y: auto;
}

.load-more {
  text-align: center;
  padding: 20rpx;
  color: var(--text-secondary);
  font-size: 26rpx;
}

.message-item {
  margin-bottom: 30rpx;
}

.message-item.self .message-content {
  flex-direction: row-reverse;
}

.message-item.self .bubble {
  background-color: var(--primary-light);
  margin-right: 16rpx;
  margin-left: 0;
}

.message-item.self .message-status {
  text-align: right;
  padding-right: 70rpx;
}

.time-divider {
  text-align: center;
  padding: 20rpx 0;
  font-size: 24rpx;
  color: var(--text-light);
}

.message-content {
  display: flex;
  align-items: flex-start;
}

.avatar-small {
  width: 72rpx;
  height: 72rpx;
  border-radius: 8rpx;
  flex-shrink: 0;
}

.bubble {
  max-width: 60%;
  background-color: var(--bg-white);
  border-radius: 8rpx;
  padding: 20rpx;
  margin-left: 16rpx;
}

.bubble.revoked {
  background-color: transparent;
}

.bubble.revoked .text-content {
  color: var(--text-light);
  font-size: 26rpx;
}

.text-content {
  font-size: 30rpx;
  color: var(--text-color);
  word-break: break-all;
  white-space: pre-wrap;
}

.image-content {
  max-width: 400rpx;
  border-radius: 8rpx;
}

.voice-content {
  display: flex;
  align-items: center;
  min-width: 120rpx;
}

.voice-icon {
  display: flex;
  align-items: flex-end;
  height: 32rpx;
  margin-right: 16rpx;
}

.voice-wave {
  width: 6rpx;
  background-color: var(--text-color);
  margin-right: 4rpx;
  border-radius: 3rpx;
}

.voice-wave:nth-child(1) {
  height: 12rpx;
}

.voice-wave:nth-child(2) {
  height: 20rpx;
}

.voice-wave:nth-child(3) {
  height: 28rpx;
}

.voice-icon.playing .voice-wave {
  animation: voiceWave 0.5s ease-in-out infinite alternate;
}

@keyframes voiceWave {
  from {
    height: 12rpx;
  }
  to {
    height: 28rpx;
  }
}

.voice-duration {
  font-size: 28rpx;
  color: var(--text-color);
}

.message-status {
  margin-top: 8rpx;
  padding-left: 90rpx;
}

.status {
  font-size: 22rpx;
}

.status.sending {
  color: var(--text-light);
}

.status.read {
  color: var(--primary-color);
}

.typing-hint {
  padding: 10rpx 30rpx;
  font-size: 24rpx;
  color: var(--text-secondary);
}

.input-area {
  background-color: #f5f5f5;
  padding: 16rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
}

.input-row {
  display: flex;
  align-items: center;
}

.voice-switch {
  padding: 16rpx;
  font-size: 26rpx;
  color: var(--text-secondary);
}

.text-input {
  flex: 1;
  background-color: var(--bg-white);
  border-radius: 8rpx;
  padding: 16rpx 24rpx;
  font-size: 30rpx;
}

.voice-btn {
  flex: 1;
  background-color: var(--bg-white);
  border-radius: 8rpx;
  padding: 20rpx;
  text-align: center;
  font-size: 28rpx;
  color: var(--text-color);
}

.voice-btn:active {
  background-color: #d9d9d9;
}

.more-btn {
  padding: 16rpx;
  font-size: 40rpx;
  color: var(--text-secondary);
}

.send-btn {
  background-color: var(--primary-color);
  color: #fff;
  font-size: 28rpx;
  padding: 12rpx 24rpx;
  border-radius: 8rpx;
  margin-left: 16rpx;
}

.more-panel {
  display: flex;
  flex-wrap: wrap;
  padding: 30rpx 0;
  background-color: #f5f5f5;
}

.panel-item {
  width: 25%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20rpx;
}

.panel-icon {
  width: 100rpx;
  height: 100rpx;
  background-color: var(--bg-white);
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  color: var(--text-secondary);
  margin-bottom: 16rpx;
}

.panel-text {
  font-size: 24rpx;
  color: var(--text-secondary);
}
</style>
