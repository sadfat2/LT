<template>
  <view class="chat-page">
    <!-- 自定义导航栏 -->
    <view class="custom-nav">
      <view class="nav-left" @click="goBack">
        <text class="back-icon">‹</text>
      </view>
      <view class="nav-title">
        <text>{{ navTitle }}</text>
      </view>
      <view class="nav-right" @click="goGroupDetail" v-if="conversationType === 'group'">
        <text class="more-icon">···</text>
      </view>
      <view class="nav-right" v-else></view>
    </view>

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

        <!-- 系统消息（通话记录等） -->
        <view v-if="message.type === 'system'" class="system-message">
          <text class="system-message-text">{{ message.content }}</text>
        </view>

        <!-- 消息气泡 -->
        <view v-else class="message-content">
          <!-- 接收者头像（左侧） -->
          <image
            v-if="message.sender_id !== currentUserId"
            class="avatar-small"
            :src="getSenderAvatar(message)"
            mode="aspectFill"
          />

          <view class="message-body">
            <!-- 群聊显示发送者昵称 -->
            <text
              v-if="conversationType === 'group' && message.sender_id !== currentUserId"
              class="sender-name"
            >
              {{ getSenderName(message) }}
            </text>

            <!-- 图片消息（无气泡） -->
            <image
              v-if="message.type === 'image'"
              class="image-content"
              :src="message.media_url"
              mode="widthFix"
              @click="previewImage(message.media_url)"
              @longpress="showMessageActions(message)"
            />

            <!-- 视频消息 -->
            <view
              v-else-if="message.type === 'video'"
              class="video-content"
              @click="playVideo(message)"
              @longpress="showMessageActions(message)"
            >
              <image
                class="video-cover"
                :src="message.thumbnail_url || '/static/images/video-placeholder.png'"
                mode="aspectFill"
              />
              <view class="video-play-icon">
                <text>▶</text>
              </view>
              <text v-if="message.duration" class="video-duration">{{ formatDuration(message.duration) }}</text>
            </view>

            <!-- 文件消息 -->
            <view
              v-else-if="message.type === 'file'"
              class="file-content"
              @click="openFile(message)"
              @longpress="showMessageActions(message)"
            >
              <view class="file-icon">
                <text>{{ getFileIcon(message.file_name) }}</text>
              </view>
              <view class="file-info">
                <text class="file-name">{{ message.file_name || '未知文件' }}</text>
                <text class="file-size">{{ formatFileSize(message.file_size) }}</text>
              </view>
            </view>

            <!-- 文本/语音消息（有气泡） -->
            <view
              v-else
              class="bubble"
              :class="{ revoked: message.status === 'revoked' }"
              @longpress="showMessageActions(message)"
            >
              <!-- 文本消息 -->
              <text v-if="message.type === 'text'" class="text-content">
                {{ message.content }}
              </text>

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
          </view>

          <!-- 发送者头像（右侧） -->
          <image
            v-if="message.sender_id === currentUserId"
            class="avatar-small"
            :src="currentUser?.avatar || '/static/images/default-avatar.svg'"
            mode="aspectFill"
          />
        </view>

        <!-- 消息状态 -->
        <view
          v-if="message.sender_id === currentUserId && message.type !== 'system'"
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
          @touchstart.prevent="startRecord"
          @touchend.prevent="stopRecord"
          @touchcancel="cancelRecord"
          @touchmove="onRecordMove"
          @mousedown.prevent="startRecord"
          @mouseup.prevent="stopRecord"
          @mouseleave="cancelRecord"
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
        <view class="panel-item" @click="chooseVideo">
          <view class="panel-icon">
            <text>视</text>
          </view>
          <text class="panel-text">视频</text>
        </view>
        <view class="panel-item" @click="chooseFile">
          <view class="panel-icon">
            <text>文</text>
          </view>
          <text class="panel-text">文件</text>
        </view>
        <!-- 语音通话（仅私聊） -->
        <view v-if="conversationType === 'private'" class="panel-item" @click="startVoiceCall">
          <view class="panel-icon call-icon">
            <text>📞</text>
          </view>
          <text class="panel-text">语音通话</text>
        </view>
      </view>
    </view>

    <!-- 通话组件 -->
    <CallModal />
    <CallScreen />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useConversationStore } from '../../store/conversation'
import { useSocketStore } from '../../store/socket'
import { useUserStore } from '../../store/user'
import { useGroupStore } from '../../store/group'
import { useCallStore } from '../../store/call'
import { uploadApi } from '../../api'
import { uploadBlob } from '../../utils/request'
import { H5Recorder, getBlobExtension } from '../../utils/h5Recorder'
import type { Message, User, Group } from '../../types'

const conversationStore = useConversationStore()
const socketStore = useSocketStore()
const userStore = useUserStore()
const groupStore = useGroupStore()
const callStore = useCallStore()

const conversationId = ref<number>(0)
const otherUserId = ref<number>(0)
const otherUser = ref<User | null>(null)
const conversationType = ref<'private' | 'group'>('private')
const groupId = ref<number>(0)
const group = ref<Group | null>(null)
const navTitle = ref('聊天')

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
// H5 平台录音器
let h5Recorder: H5Recorder | null = null

onLoad(async (options) => {
  if (options?.conversationId) {
    conversationId.value = parseInt(options.conversationId)
  }
  if (options?.userId) {
    otherUserId.value = parseInt(options.userId)
  }
  if (options?.type === 'group') {
    conversationType.value = 'group'
    if (options?.groupId) {
      groupId.value = parseInt(options.groupId)
      // 加载群详情
      const groupDetail = await groupStore.fetchGroupDetail(groupId.value)
      group.value = groupDetail
      navTitle.value = groupDetail.name
    }
  } else if (options?.nickname) {
    const nickname = decodeURIComponent(options.nickname)
    const avatar = options?.avatar ? decodeURIComponent(options.avatar) : null
    navTitle.value = nickname
    otherUser.value = {
      id: otherUserId.value,
      nickname: nickname,
      account: '',
      avatar: avatar,
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

  // 初始化通话事件监听
  callStore.initCallListeners()
})

onUnmounted(() => {
  socketStore.off('new_message', handleNewMessage)
  socketStore.off('message_read_ack', handleReadAck)
  socketStore.off('message_revoked', handleRevoked)
  socketStore.off('user_typing', handleTyping)

  // 移除通话事件监听
  callStore.removeCallListeners()

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
  // 先添加临时消息（乐观更新）
  const tempMessage: Message = {
    id: Date.now(),
    conversation_id: conversationId.value,
    sender_id: currentUserId.value!,
    type: 'image',
    content: '',
    media_url: filePath, // 先显示本地图片
    status: 'sending',
    created_at: new Date().toISOString()
  }
  messages.value.push(tempMessage)
  scrollToBottom()

  try {
    const res = await uploadApi.image(filePath)

    socketStore.sendMessage(
      {
        conversationId: conversationId.value || undefined,
        receiverId: otherUserId.value,
        type: 'image',
        content: '',
        mediaUrl: res.data.url
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
            messages.value[index].media_url = res.data.url
          }
        }
      }
    )
  } catch (error) {
    // 发送失败，移除临时消息
    const index = messages.value.findIndex(m => m.id === tempMessage.id)
    if (index !== -1) {
      messages.value.splice(index, 1)
    }
    uni.showToast({ title: '发送图片失败', icon: 'none' })
  }
}

const onInput = () => {
  socketStore.sendTyping(conversationId.value, otherUserId.value)
}

const toggleVoice = async () => {
  // #ifdef H5
  // H5 平台使用 MediaRecorder API
  if (!H5Recorder.isSupported()) {
    uni.showToast({ title: '您的浏览器不支持录音', icon: 'none' })
    return
  }
  if (!h5Recorder) {
    h5Recorder = new H5Recorder()
  }
  // #endif
  showVoice.value = !showVoice.value
  showMore.value = false
}

const toggleMore = () => {
  showMore.value = !showMore.value
}

// 返回上一页
const goBack = () => {
  uni.navigateBack()
}

// 跳转到群详情页面
const goGroupDetail = () => {
  if (groupId.value) {
    uni.navigateTo({
      url: `/pages/group/detail?groupId=${groupId.value}`
    })
  }
}

// 发起语音通话
const startVoiceCall = async () => {
  if (conversationType.value !== 'private' || !otherUser.value) {
    uni.showToast({ title: '暂不支持群聊语音通话', icon: 'none' })
    return
  }

  showMore.value = false

  const success = await callStore.initiateCall(otherUserId.value, {
    id: otherUser.value.id,
    nickname: otherUser.value.nickname,
    avatar: otherUser.value.avatar
  })

  if (!success) {
    // 错误信息已在 callStore 中显示
  }
}

const startRecord = async () => {
  // #ifdef H5
  if (!h5Recorder) {
    h5Recorder = new H5Recorder()
  }
  const hasPermission = await h5Recorder.requestPermission()
  if (!hasPermission) {
    uni.showToast({ title: '请允许使用麦克风', icon: 'none' })
    return
  }
  const started = await h5Recorder.start()
  if (started) {
    recording.value = true
  }
  return
  // #endif

  // #ifndef H5
  recording.value = true
  recorderManager?.start({
    duration: 60000,
    format: 'mp3'
  })
  // #endif
}

const stopRecord = async () => {
  if (!recording.value) return

  // #ifdef H5
  if (h5Recorder) {
    const result = await h5Recorder.stop()
    recording.value = false
    if (result) {
      await sendVoiceMessageH5(result.blob, result.duration)
    }
  }
  return
  // #endif

  // #ifndef H5
  recorderManager?.stop()
  // #endif
}

const cancelRecord = () => {
  recording.value = false
  // #ifdef H5
  h5Recorder?.cancel()
  return
  // #endif

  // #ifndef H5
  recorderManager?.stop()
  // #endif
}

const onRecordMove = (e: TouchEvent) => {
  // 上滑取消
  const touch = e.touches[0]
  if (touch.clientY < 200) {
    cancelRecord()
  }
}

// H5 平台发送语音消息
const sendVoiceMessageH5 = async (blob: Blob, duration: number) => {
  // 添加临时消息
  const tempMessage: Message = {
    id: Date.now(),
    conversation_id: conversationId.value,
    sender_id: currentUserId.value!,
    type: 'voice',
    content: '',
    duration,
    status: 'sending',
    created_at: new Date().toISOString()
  }
  messages.value.push(tempMessage)
  scrollToBottom()

  try {
    const ext = getBlobExtension(blob)
    const filename = `voice_${Date.now()}.${ext}`
    const res = await uploadBlob('/api/upload/voice', blob, filename, { duration })

    socketStore.sendMessage(
      {
        conversationId: conversationId.value || undefined,
        receiverId: conversationType.value === 'private' ? otherUserId.value : undefined,
        type: 'voice',
        content: '',
        mediaUrl: res.data.url,
        duration
      },
      (result) => {
        const index = messages.value.findIndex(m => m.id === tempMessage.id)
        if (index !== -1) {
          if (result.success && result.message) {
            messages.value[index] = result.message
            if (!conversationId.value) {
              conversationId.value = result.conversationId!
            }
          } else {
            messages.value[index].status = 'sent'
            messages.value[index].media_url = res.data.url
          }
        }
      }
    )
  } catch (error) {
    const index = messages.value.findIndex(m => m.id === tempMessage.id)
    if (index !== -1) {
      messages.value.splice(index, 1)
    }
    uni.showToast({ title: '发送语音失败', icon: 'none' })
  }
}

// 从视频提取第一帧作为缩略图 (H5)
const extractVideoThumbnail = (videoUrl: string): Promise<Blob | null> => {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.preload = 'metadata'

    video.onloadeddata = () => {
      // 跳转到第一帧
      video.currentTime = 0.1
    }

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          canvas.toBlob((blob) => {
            resolve(blob)
          }, 'image/jpeg', 0.7)
        } else {
          resolve(null)
        }
      } catch (e) {
        resolve(null)
      }
    }

    video.onerror = () => resolve(null)
    video.src = videoUrl
  })
}

// 选择视频
const chooseVideo = () => {
  showMore.value = false

  // #ifdef H5
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm'
  input.onchange = async (e: any) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > 50 * 1024 * 1024) {
      uni.showToast({ title: '视频不能超过50MB', icon: 'none' })
      return
    }

    // 创建临时 URL 用于提取缩略图
    const videoUrl = URL.createObjectURL(file)

    // 提取缩略图
    const thumbnailBlob = await extractVideoThumbnail(videoUrl)

    // 添加临时消息
    const tempMessage: Message = {
      id: Date.now(),
      conversation_id: conversationId.value,
      sender_id: currentUserId.value!,
      type: 'video',
      content: '',
      media_url: videoUrl,
      thumbnail_url: videoUrl, // 临时使用视频URL
      status: 'sending',
      created_at: new Date().toISOString()
    }
    messages.value.push(tempMessage)
    scrollToBottom()

    try {
      uni.showLoading({ title: '上传中...' })

      // 上传缩略图
      let thumbnailUrl = ''
      if (thumbnailBlob) {
        const thumbRes = await uploadBlob('/api/upload/image', thumbnailBlob, `thumb_${Date.now()}.jpg`)
        thumbnailUrl = thumbRes.data.url
      }

      // 上传视频
      const videoRes = await uploadBlob('/api/upload/video', file, file.name)
      uni.hideLoading()

      // 释放临时 URL
      URL.revokeObjectURL(videoUrl)

      socketStore.sendMessage(
        {
          conversationId: conversationId.value || undefined,
          receiverId: conversationType.value === 'private' ? otherUserId.value : undefined,
          type: 'video',
          content: '',
          mediaUrl: videoRes.data.url,
          thumbnailUrl,
          duration: videoRes.data.duration || 0
        },
        (result) => {
          const index = messages.value.findIndex(m => m.id === tempMessage.id)
          if (index !== -1) {
            if (result.success && result.message) {
              messages.value[index] = result.message
              if (!conversationId.value) {
                conversationId.value = result.conversationId!
              }
            } else {
              messages.value[index].status = 'sent'
              messages.value[index].media_url = videoRes.data.url
              messages.value[index].thumbnail_url = thumbnailUrl
            }
          }
        }
      )
    } catch (error) {
      uni.hideLoading()
      URL.revokeObjectURL(videoUrl)
      const index = messages.value.findIndex(m => m.id === tempMessage.id)
      if (index !== -1) {
        messages.value.splice(index, 1)
      }
      uni.showToast({ title: '发送视频失败', icon: 'none' })
    }
  }
  input.click()
  return
  // #endif

  // #ifndef H5
  uni.chooseVideo({
    sourceType: ['album', 'camera'],
    maxDuration: 60,
    compressed: true,
    success: async (res) => {
      // 检查文件大小 (50MB 限制)
      if (res.size > 50 * 1024 * 1024) {
        uni.showToast({ title: '视频不能超过50MB', icon: 'none' })
        return
      }
      await sendVideoMessage(res.tempFilePath, res.duration || 0, res.thumbTempFilePath)
    }
  })
  // #endif
}

// 发送视频消息 (非H5平台)
const sendVideoMessage = async (filePath: string, duration: number, thumbPath?: string) => {
  const tempMessage: Message = {
    id: Date.now(),
    conversation_id: conversationId.value,
    sender_id: currentUserId.value!,
    type: 'video',
    content: '',
    media_url: filePath,
    thumbnail_url: thumbPath,
    duration,
    status: 'sending',
    created_at: new Date().toISOString()
  }
  messages.value.push(tempMessage)
  scrollToBottom()

  try {
    uni.showLoading({ title: '上传中...' })

    // 上传缩略图
    let thumbnailUrl = ''
    if (thumbPath) {
      const thumbRes = await uploadApi.image(thumbPath)
      thumbnailUrl = thumbRes.data.url
    }

    // 上传视频
    const res = await uploadApi.video(filePath, duration)
    uni.hideLoading()

    socketStore.sendMessage(
      {
        conversationId: conversationId.value || undefined,
        receiverId: conversationType.value === 'private' ? otherUserId.value : undefined,
        type: 'video',
        content: '',
        mediaUrl: res.data.url,
        thumbnailUrl,
        duration
      },
      (result) => {
        const index = messages.value.findIndex(m => m.id === tempMessage.id)
        if (index !== -1) {
          if (result.success && result.message) {
            messages.value[index] = result.message
            if (!conversationId.value) {
              conversationId.value = result.conversationId!
            }
          } else {
            messages.value[index].status = 'sent'
            messages.value[index].media_url = res.data.url
            messages.value[index].thumbnail_url = thumbnailUrl
          }
        }
      }
    )
  } catch (error) {
    uni.hideLoading()
    const index = messages.value.findIndex(m => m.id === tempMessage.id)
    if (index !== -1) {
      messages.value.splice(index, 1)
    }
    uni.showToast({ title: '发送视频失败', icon: 'none' })
  }
}

// 选择文件
const chooseFile = () => {
  showMore.value = false

  // #ifdef H5
  // H5 平台使用 input 选择文件
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt'
  input.onchange = async (e: any) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > 20 * 1024 * 1024) {
      uni.showToast({ title: '文件不能超过20MB', icon: 'none' })
      return
    }

    // 添加临时消息
    const tempMessage: Message = {
      id: Date.now(),
      conversation_id: conversationId.value,
      sender_id: currentUserId.value!,
      type: 'file',
      content: '',
      file_name: file.name,
      file_size: file.size,
      status: 'sending',
      created_at: new Date().toISOString()
    }
    messages.value.push(tempMessage)
    scrollToBottom()

    try {
      uni.showLoading({ title: '上传中...' })
      const res = await uploadBlob('/api/upload/file', file, file.name)
      uni.hideLoading()

      socketStore.sendMessage(
        {
          conversationId: conversationId.value || undefined,
          receiverId: conversationType.value === 'private' ? otherUserId.value : undefined,
          type: 'file',
          content: '',
          mediaUrl: res.data.url,
          fileName: res.data.name,
          fileSize: res.data.size
        },
        (result) => {
          const index = messages.value.findIndex(m => m.id === tempMessage.id)
          if (index !== -1) {
            if (result.success && result.message) {
              messages.value[index] = result.message
              if (!conversationId.value) {
                conversationId.value = result.conversationId!
              }
            } else {
              messages.value[index].status = 'sent'
              messages.value[index].media_url = res.data.url
            }
          }
        }
      )
    } catch (error) {
      uni.hideLoading()
      const index = messages.value.findIndex(m => m.id === tempMessage.id)
      if (index !== -1) {
        messages.value.splice(index, 1)
      }
      uni.showToast({ title: '上传文件失败', icon: 'none' })
    }
  }
  input.click()
  return
  // #endif

  // #ifndef H5
  // 小程序/App 使用 chooseMessageFile
  uni.chooseMessageFile({
    count: 1,
    type: 'file',
    extension: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'],
    success: async (res) => {
      const file = res.tempFiles[0]
      if (file.size > 20 * 1024 * 1024) {
        uni.showToast({ title: '文件不能超过20MB', icon: 'none' })
        return
      }
      await sendFileMessage(file.path, file.name, file.size)
    }
  })
  // #endif
}

// 发送文件消息
const sendFileMessage = async (filePath: string, fileName: string, fileSize: number) => {
  const tempMessage: Message = {
    id: Date.now(),
    conversation_id: conversationId.value,
    sender_id: currentUserId.value!,
    type: 'file',
    content: '',
    file_name: fileName,
    file_size: fileSize,
    status: 'sending',
    created_at: new Date().toISOString()
  }
  messages.value.push(tempMessage)
  scrollToBottom()

  try {
    uni.showLoading({ title: '上传中...' })
    const res = await uploadApi.file(filePath, fileName)
    uni.hideLoading()

    socketStore.sendMessage(
      {
        conversationId: conversationId.value || undefined,
        receiverId: conversationType.value === 'private' ? otherUserId.value : undefined,
        type: 'file',
        content: '',
        mediaUrl: res.data.url,
        fileName: res.data.name,
        fileSize: res.data.size
      },
      (result) => {
        const index = messages.value.findIndex(m => m.id === tempMessage.id)
        if (index !== -1) {
          if (result.success && result.message) {
            messages.value[index] = result.message
            if (!conversationId.value) {
              conversationId.value = result.conversationId!
            }
          } else {
            messages.value[index].status = 'sent'
            messages.value[index].media_url = res.data.url
          }
        }
      }
    )
  } catch (error) {
    uni.hideLoading()
    const index = messages.value.findIndex(m => m.id === tempMessage.id)
    if (index !== -1) {
      messages.value.splice(index, 1)
    }
    uni.showToast({ title: '发送文件失败', icon: 'none' })
  }
}

// 播放视频
const playVideo = (message: Message) => {
  if (!message.media_url) return

  // #ifdef H5
  window.open(message.media_url, '_blank')
  return
  // #endif

  // #ifndef H5
  uni.previewMedia({
    sources: [{
      url: message.media_url,
      type: 'video'
    }],
    current: 0
  })
  // #endif
}

// 打开文件
const openFile = (message: Message) => {
  if (!message.media_url) return

  // #ifdef H5
  window.open(message.media_url, '_blank')
  return
  // #endif

  // #ifndef H5
  uni.downloadFile({
    url: message.media_url,
    success: (res) => {
      uni.openDocument({
        filePath: res.tempFilePath,
        showMenu: true,
        fail: () => {
          uni.showToast({ title: '无法打开此文件', icon: 'none' })
        }
      })
    },
    fail: () => {
      uni.showToast({ title: '下载文件失败', icon: 'none' })
    }
  })
  // #endif
}

// 获取群聊发送者头像
const getSenderAvatar = (message: Message): string => {
  if (conversationType.value === 'group' && message.sender_id !== currentUserId.value) {
    const member = group.value?.members?.find(m => m.user_id === message.sender_id)
    return member?.user?.avatar || '/static/images/default-avatar.svg'
  }
  return otherUser.value?.avatar || '/static/images/default-avatar.svg'
}

// 获取群聊发送者昵称
const getSenderName = (message: Message): string => {
  if (conversationType.value === 'group') {
    const member = group.value?.members?.find(m => m.user_id === message.sender_id)
    return member?.user?.nickname || member?.user?.account || '未知用户'
  }
  return otherUser.value?.nickname || ''
}

// 获取文件图标
const getFileIcon = (fileName?: string): string => {
  if (!fileName) return '📄'
  const ext = fileName.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'pdf': return '📕'
    case 'doc':
    case 'docx': return '📘'
    case 'xls':
    case 'xlsx': return '📗'
    case 'ppt':
    case 'pptx': return '📙'
    case 'txt': return '📝'
    default: return '📄'
  }
}

// 格式化文件大小
const formatFileSize = (size?: number): string => {
  if (!size) return '未知大小'
  if (size < 1024) return `${size}B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`
  return `${(size / 1024 / 1024).toFixed(1)}MB`
}

// 格式化时长
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
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

/* 自定义导航栏 */
.custom-nav {
  display: flex;
  align-items: center;
  height: 88rpx;
  padding-top: env(safe-area-inset-top);
  background-color: #EDEDED;
  border-bottom: 1rpx solid var(--border-color);
  flex-shrink: 0;
}

.nav-left {
  width: 100rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-icon {
  font-size: 56rpx;
  color: var(--text-color);
  font-weight: 300;
}

.nav-title {
  flex: 1;
  text-align: center;
  font-size: 34rpx;
  font-weight: 500;
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-right {
  width: 100rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.more-icon {
  font-size: 40rpx;
  font-weight: bold;
  color: var(--text-color);
  letter-spacing: 2rpx;
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
  justify-content: flex-end;
}

.message-item.self .bubble {
  background-color: var(--primary-light);
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

.system-message {
  display: flex;
  justify-content: center;
  padding: 16rpx 0;
}

.system-message-text {
  display: inline-block;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8rpx;
  padding: 8rpx 20rpx;
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
  margin: 0 20rpx;
}

.bubble {
  max-width: 60%;
  background-color: var(--bg-white);
  border-radius: 8rpx;
  padding: 20rpx;
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

.message-body {
  display: flex;
  flex-direction: column;
  max-width: 70%;
}

.sender-name {
  font-size: 22rpx;
  color: var(--text-secondary);
  margin-bottom: 8rpx;
}

.message-item.self .message-body {
  align-items: flex-end;
}

.image-content {
  max-width: 400rpx;
  border-radius: 12rpx;
}

.video-content {
  position: relative;
  width: 400rpx;
  height: 300rpx;
  border-radius: 12rpx;
  overflow: hidden;
  background-color: #000;
}

.video-cover {
  width: 100%;
  height: 100%;
}

.video-play-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80rpx;
  height: 80rpx;
  background-color: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-play-icon text {
  color: #fff;
  font-size: 32rpx;
  margin-left: 6rpx;
}

.video-duration {
  position: absolute;
  bottom: 10rpx;
  right: 10rpx;
  font-size: 22rpx;
  color: #fff;
  background-color: rgba(0, 0, 0, 0.5);
  padding: 4rpx 10rpx;
  border-radius: 4rpx;
}

.file-content {
  display: flex;
  align-items: center;
  background-color: var(--bg-white);
  border-radius: 12rpx;
  padding: 20rpx;
  min-width: 400rpx;
}

.message-item.self .file-content {
  background-color: var(--primary-light);
}

.file-icon {
  font-size: 60rpx;
  margin-right: 20rpx;
}

.file-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.file-name {
  font-size: 28rpx;
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 280rpx;
}

.file-size {
  font-size: 22rpx;
  color: var(--text-secondary);
  margin-top: 6rpx;
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
