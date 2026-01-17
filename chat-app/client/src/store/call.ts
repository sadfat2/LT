import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useSocketStore } from './socket'
import { WebRTCManager, createWebRTCManager } from '../utils/webrtc'

// 通话状态类型
export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected' | 'ended'

// 通话对方信息
export interface PeerInfo {
  id: number
  nickname: string
  avatar: string | null
}

// 通话结束原因
export type CallEndReason = 'hangup' | 'rejected' | 'timeout' | 'cancelled' | 'busy' | 'offline' | 'error' | 'disconnected'

// 监听器初始化标志（防止重复绑定）
let listenersInitialized = false

export const useCallStore = defineStore('call', () => {
  // 状态
  const status = ref<CallStatus>('idle')
  const callId = ref<string | null>(null)
  const peerId = ref<number | null>(null)
  const peerInfo = ref<PeerInfo | null>(null)
  const isCaller = ref(false)
  const startTime = ref<number | null>(null)
  const duration = ref(0)
  const isMuted = ref(false)
  const isSpeaker = ref(false)
  const endReason = ref<CallEndReason | null>(null)

  // WebRTC 管理器
  let webrtcManager: WebRTCManager | null = null
  let durationTimer: ReturnType<typeof setInterval> | null = null
  let statsTimer: ReturnType<typeof setInterval> | null = null  // 音频统计定时器

  // 操作锁，防止快速重复点击
  let isProcessing = false

  // 音频元素（用于播放远程音频）
  let remoteAudio: HTMLAudioElement | null = null

  // 计算属性
  const isInCall = computed(() => ['calling', 'ringing', 'connecting', 'connected'].includes(status.value))
  const isConnected = computed(() => status.value === 'connected')
  const formattedDuration = computed(() => {
    const mins = Math.floor(duration.value / 60)
    const secs = duration.value % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  })

  // Socket store
  const socketStore = useSocketStore()

  /**
   * 初始化通话事件监听
   * 应在 App.vue 或全局位置调用
   */
  const initCallListeners = () => {
    // 防止重复初始化
    if (listenersInitialized) {
      console.log('[Call] 监听器已初始化，跳过重复注册')
      return
    }
    listenersInitialized = true
    console.log('[Call] 初始化通话事件监听器')

    // 收到来电
    socketStore.on('call:incoming', handleIncomingCall)
    // 对方接听
    socketStore.on('call:accepted', handleCallAccepted)
    // 对方拒绝
    socketStore.on('call:rejected', handleCallRejected)
    // 通话结束
    socketStore.on('call:ended', handleCallEnded)
    // 呼叫超时
    socketStore.on('call:timeout', handleCallTimeout)
    // 呼叫取消
    socketStore.on('call:cancelled', handleCallCancelled)
    // WebRTC 信令
    socketStore.on('webrtc:offer', handleWebRTCOffer)
    socketStore.on('webrtc:answer', handleWebRTCAnswer)
    socketStore.on('webrtc:ice', handleWebRTCIce)
  }

  /**
   * 移除通话事件监听
   */
  const removeCallListeners = () => {
    if (!listenersInitialized) {
      return
    }
    listenersInitialized = false
    console.log('[Call] 移除通话事件监听器')

    socketStore.off('call:incoming', handleIncomingCall)
    socketStore.off('call:accepted', handleCallAccepted)
    socketStore.off('call:rejected', handleCallRejected)
    socketStore.off('call:ended', handleCallEnded)
    socketStore.off('call:timeout', handleCallTimeout)
    socketStore.off('call:cancelled', handleCallCancelled)
    socketStore.off('webrtc:offer', handleWebRTCOffer)
    socketStore.off('webrtc:answer', handleWebRTCAnswer)
    socketStore.off('webrtc:ice', handleWebRTCIce)
  }

  // ==================== 主动操作 ====================

  /**
   * 发起通话
   */
  const initiateCall = async (targetUserId: number, targetInfo: PeerInfo): Promise<boolean> => {
    if (isInCall.value) {
      uni.showToast({ title: '您正在通话中', icon: 'none' })
      return false
    }

    // 检查 WebRTC 支持
    // #ifdef H5
    if (!WebRTCManager.isSupported()) {
      uni.showToast({ title: '您的浏览器不支持语音通话', icon: 'none' })
      return false
    }
    // #endif

    try {
      // 初始化 WebRTC
      webrtcManager = createWebRTCManager()

      // 请求麦克风权限
      await webrtcManager.requestAudioStream()

      // 发送呼叫请求
      return new Promise((resolve) => {
        socketStore.socket?.emit('call:request', { targetUserId }, (result: any) => {
          if (result.success) {
            // 更新状态
            status.value = 'calling'
            callId.value = result.callId
            peerId.value = targetUserId
            peerInfo.value = targetInfo
            isCaller.value = true
            endReason.value = null

            resolve(true)
          } else {
            // 清理资源
            webrtcManager?.close()
            webrtcManager = null

            // 显示错误信息
            let errorMsg = result.error || '呼叫失败'
            if (result.code === 'BUSY') {
              errorMsg = '对方正在通话中'
            } else if (result.code === 'OFFLINE') {
              errorMsg = '对方不在线'
            }
            uni.showToast({ title: errorMsg, icon: 'none' })

            resolve(false)
          }
        })
      })
    } catch (error) {
      webrtcManager?.close()
      webrtcManager = null

      const err = error as Error
      uni.showToast({ title: err.message || '呼叫失败', icon: 'none' })
      return false
    }
  }

  /**
   * 接听来电
   */
  const acceptCall = async (): Promise<boolean> => {
    console.log('[Call] 尝试接听，当前状态:', status.value, 'callId:', callId.value, 'isProcessing:', isProcessing)

    // 防止重复操作
    if (isProcessing) {
      console.log('[Call] 接听失败：正在处理中')
      return false
    }

    if (status.value !== 'ringing' || !callId.value) {
      console.log('[Call] 接听失败：状态不正确')
      return false
    }

    // 立即加锁并更新状态，防止重复点击
    isProcessing = true
    status.value = 'connecting'

    try {
      // 初始化 WebRTC
      webrtcManager = createWebRTCManager()

      // 请求麦克风权限
      await webrtcManager.requestAudioStream()

      // 初始化 PeerConnection
      webrtcManager.initPeerConnection({
        onRemoteStream: handleRemoteStream,
        onIceCandidate: handleLocalIceCandidate,
        onConnectionStateChange: handleConnectionStateChange,
        onError: handleWebRTCError,
      })

      // 发送接听消息
      return new Promise((resolve) => {
        socketStore.socket?.emit('call:accept', { callId: callId.value }, (result: any) => {
          isProcessing = false  // 释放锁
          if (result.success) {
            // 状态已经在前面设置为 connecting
            resolve(true)
          } else {
            webrtcManager?.close()
            webrtcManager = null
            resetCallState()  // 失败时重置状态
            uni.showToast({ title: result.error || '接听失败', icon: 'none' })
            resolve(false)
          }
        })
      })
    } catch (error) {
      isProcessing = false  // 释放锁
      webrtcManager?.close()
      webrtcManager = null
      resetCallState()  // 失败时重置状态

      const err = error as Error
      uni.showToast({ title: err.message || '接听失败', icon: 'none' })
      return false
    }
  }

  /**
   * 拒绝来电
   */
  const rejectCall = (): void => {
    console.log('[Call] 尝试拒绝，当前状态:', status.value, 'callId:', callId.value, 'isProcessing:', isProcessing)

    // 防止重复操作
    if (isProcessing) {
      console.log('[Call] 拒绝失败：正在处理中')
      return
    }

    if (status.value !== 'ringing' || !callId.value) {
      console.log('[Call] 拒绝失败：状态不正确')
      return
    }

    // 立即加锁，防止重复点击
    isProcessing = true
    const currentCallId = callId.value

    // 先重置状态，防止后续操作
    resetCallState()
    isProcessing = false  // resetCallState 后释放锁

    socketStore.socket?.emit('call:reject', {
      callId: currentCallId,
      reason: 'declined'
    })
  }

  /**
   * 取消呼叫（呼叫者）
   */
  const cancelCall = (): void => {
    if (status.value !== 'calling' || !callId.value) return

    socketStore.socket?.emit('call:cancel', { callId: callId.value })

    webrtcManager?.close()
    webrtcManager = null
    resetCallState()
  }

  /**
   * 挂断通话
   */
  const endCall = (): void => {
    if (!isInCall.value || !callId.value) return

    socketStore.socket?.emit('call:end', { callId: callId.value })

    webrtcManager?.close()
    webrtcManager = null
    stopDurationTimer()
    stopStatsMonitor()  // 停止音频质量监控
    resetCallState()
  }

  /**
   * 切换静音
   */
  const toggleMute = (): boolean => {
    if (webrtcManager) {
      isMuted.value = webrtcManager.toggleMute()
    }
    return isMuted.value
  }

  /**
   * 切换扬声器（H5 上实际上只是调整音量）
   */
  const toggleSpeaker = (): boolean => {
    isSpeaker.value = !isSpeaker.value
    // H5 上暂时无法真正切换扬声器/听筒，仅更新状态用于 UI 显示
    return isSpeaker.value
  }

  // ==================== 事件处理 ====================

  /**
   * 处理来电
   */
  const handleIncomingCall = (data: { callId: string; callerId: number; callerInfo: PeerInfo }) => {
    console.log('[Call] 收到来电:', data.callId, '当前状态:', status.value)

    // 只有在"真正通话中"时才拒绝（connecting/connected 表示已建立连接）
    // calling/ringing 状态不应该自动拒绝，因为可能是重复事件或竞态条件
    if (['connecting', 'connected'].includes(status.value)) {
      console.log('[Call] 正在通话中，自动拒绝来电')
      socketStore.socket?.emit('call:reject', {
        callId: data.callId,
        reason: 'busy'
      })
      return
    }

    // 如果已经在 ringing 或 calling 状态，说明可能是重复事件，忽略
    if (['calling', 'ringing'].includes(status.value)) {
      // 检查是否是同一个通话的重复事件
      if (callId.value === data.callId) {
        console.log('[Call] 忽略同一通话的重复来电事件')
        return
      }
      // 不同通话，拒绝新来电（用户正在处理另一个通话）
      console.log('[Call] 正在处理另一个通话，拒绝新来电')
      socketStore.socket?.emit('call:reject', {
        callId: data.callId,
        reason: 'busy'
      })
      return
    }

    // 更新状态
    status.value = 'ringing'
    callId.value = data.callId
    peerId.value = data.callerId
    peerInfo.value = data.callerInfo
    isCaller.value = false
    endReason.value = null
    console.log('[Call] 来电状态已更新: ringing')
  }

  /**
   * 处理对方接听
   */
  const handleCallAccepted = async (data: { callId: string; receiverInfo: PeerInfo }) => {
    console.log('[Call] 收到对方接听:', data.callId, '当前 callId:', callId.value, '当前状态:', status.value)
    if (callId.value !== data.callId) {
      console.log('[Call] callId 不匹配，忽略')
      return
    }

    try {
      // 初始化 PeerConnection
      webrtcManager?.initPeerConnection({
        onRemoteStream: handleRemoteStream,
        onIceCandidate: handleLocalIceCandidate,
        onConnectionStateChange: handleConnectionStateChange,
        onError: handleWebRTCError,
      })

      status.value = 'connecting'

      // 创建并发送 Offer
      const offer = await webrtcManager?.createOffer()
      if (offer) {
        socketStore.socket?.emit('webrtc:offer', {
          callId: callId.value,
          sdp: offer
        })
      }
    } catch (error) {
      console.error('创建 Offer 失败:', error)
      endCall()
    }
  }

  /**
   * 处理对方拒绝
   */
  const handleCallRejected = (data: { callId: string; reason: string }) => {
    console.log('[Call] 收到拒绝:', data.callId, '原因:', data.reason, '当前 callId:', callId.value, '当前状态:', status.value)
    if (callId.value !== data.callId) {
      console.log('[Call] callId 不匹配，忽略')
      return
    }

    webrtcManager?.close()
    webrtcManager = null

    endReason.value = 'rejected'
    status.value = 'ended'

    uni.showToast({ title: '对方已拒绝', icon: 'none' })

    setTimeout(() => resetCallState(), 500)
  }

  /**
   * 处理通话结束
   */
  const handleCallEnded = (data: { callId: string; duration: number; endedBy: number; reason?: string }) => {
    if (callId.value !== data.callId) return

    webrtcManager?.close()
    webrtcManager = null
    stopDurationTimer()
    stopStatsMonitor()  // 停止音频质量监控

    endReason.value = (data.reason as CallEndReason) || 'hangup'
    status.value = 'ended'

    setTimeout(() => resetCallState(), 500)
  }

  /**
   * 处理呼叫超时
   */
  const handleCallTimeout = (data: { callId: string }) => {
    if (callId.value !== data.callId) return

    webrtcManager?.close()
    webrtcManager = null

    endReason.value = 'timeout'
    status.value = 'ended'

    uni.showToast({ title: '对方无应答', icon: 'none' })

    setTimeout(() => resetCallState(), 500)
  }

  /**
   * 处理呼叫取消
   */
  const handleCallCancelled = (data: { callId: string }) => {
    if (callId.value !== data.callId) return

    endReason.value = 'cancelled'
    status.value = 'ended'

    uni.showToast({ title: '对方已取消', icon: 'none' })

    setTimeout(() => resetCallState(), 500)
  }

  // ==================== WebRTC 信令处理 ====================

  /**
   * 处理收到的 Offer
   */
  const handleWebRTCOffer = async (data: { callId: string; sdp: RTCSessionDescriptionInit; from: number }) => {
    if (callId.value !== data.callId || !webrtcManager) return

    try {
      const answer = await webrtcManager.handleOffer(data.sdp)
      socketStore.socket?.emit('webrtc:answer', {
        callId: callId.value,
        sdp: answer
      })
    } catch (error) {
      console.error('处理 Offer 失败:', error)
      endCall()
    }
  }

  /**
   * 处理收到的 Answer
   */
  const handleWebRTCAnswer = async (data: { callId: string; sdp: RTCSessionDescriptionInit; from: number }) => {
    if (callId.value !== data.callId || !webrtcManager) return

    try {
      await webrtcManager.handleAnswer(data.sdp)
    } catch (error) {
      console.error('处理 Answer 失败:', error)
      endCall()
    }
  }

  /**
   * 处理收到的 ICE Candidate
   */
  const handleWebRTCIce = async (data: { callId: string; candidate: RTCIceCandidateInit; from: number }) => {
    if (callId.value !== data.callId || !webrtcManager) return

    try {
      await webrtcManager.addIceCandidate(data.candidate)
    } catch (error) {
      console.warn('添加 ICE 候选失败:', error)
    }
  }

  // ==================== WebRTC 回调处理 ====================

  /**
   * 处理本地 ICE 候选
   */
  const handleLocalIceCandidate = (candidate: RTCIceCandidate) => {
    socketStore.socket?.emit('webrtc:ice', {
      callId: callId.value,
      candidate: candidate.toJSON()
    })
  }

  /**
   * 处理远程音频流
   */
  const handleRemoteStream = (stream: MediaStream) => {
    // #ifdef H5
    // 创建音频元素播放远程音频
    if (!remoteAudio) {
      remoteAudio = new Audio()
      remoteAudio.autoplay = true
      // 降低音量以减少回声和反馈风险（0.7 = 70%）
      remoteAudio.volume = 0.7

      // 监听音频播放状态（调试用）
      remoteAudio.addEventListener('stalled', () => {
        console.warn('远程音频播放停滞')
      })
      remoteAudio.addEventListener('waiting', () => {
        console.warn('远程音频缓冲中...')
      })
    }

    remoteAudio.srcObject = stream
    console.log('[通话] 远程音频音量:', remoteAudio.volume)

    // 配置抖动缓冲（关键优化！减少网络波动导致的卡顿）
    if (webrtcManager) {
      // 使用 200ms 抖动缓冲，提高容错能力
      webrtcManager.configureJitterBuffer(200)
    }

    // 输出远程音频轨道信息
    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length > 0) {
      const track = audioTracks[0]
      console.log('[WebRTC] 远程音频轨道:', {
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        settings: track.getSettings(),
      })
    }

    // 确保播放成功
    remoteAudio.play()
      .then(() => console.log('远程音频播放开始'))
      .catch((err) => {
        console.error('远程音频播放失败:', err)
        // 某些浏览器需要用户交互后才能播放音频
        uni.showModal({
          title: '需要操作',
          content: '点击确定以启用通话声音',
          showCancel: false,
          success: () => remoteAudio?.play().catch(console.error)
        })
      })
    // #endif
  }

  /**
   * 处理连接状态变化
   */
  const handleConnectionStateChange = (state: RTCPeerConnectionState) => {
    console.log('WebRTC 连接状态:', state)

    if (state === 'connected') {
      status.value = 'connected'
      startTime.value = Date.now()
      startDurationTimer()
      startStatsMonitor()  // 开始音频质量监控
    } else if (state === 'failed' || state === 'disconnected') {
      // 连接失败或断开
      if (status.value === 'connected') {
        endCall()
      }
    }
  }

  /**
   * 处理 WebRTC 错误
   */
  const handleWebRTCError = (error: Error) => {
    console.error('WebRTC 错误:', error)
    uni.showToast({ title: '通话连接失败', icon: 'none' })
    endCall()
  }

  // ==================== 辅助方法 ====================

  /**
   * 开始计时
   */
  const startDurationTimer = () => {
    if (durationTimer) return

    durationTimer = setInterval(() => {
      if (startTime.value) {
        duration.value = Math.floor((Date.now() - startTime.value) / 1000)
      }
    }, 1000)
  }

  /**
   * 停止计时
   */
  const stopDurationTimer = () => {
    if (durationTimer) {
      clearInterval(durationTimer)
      durationTimer = null
    }
  }

  /**
   * 开始音频统计监控
   */
  const startStatsMonitor = () => {
    if (statsTimer) return

    // 每 3 秒输出一次音频统计
    statsTimer = setInterval(async () => {
      if (!webrtcManager) return

      const stats = await webrtcManager.getAudioStats()
      if (stats) {
        const lossRate = stats.packetsReceived > 0
          ? ((stats.packetsLost / (stats.packetsReceived + stats.packetsLost)) * 100).toFixed(2)
          : '0'

        console.log('[通话质量]', {
          '丢包率': `${lossRate}%`,
          '丢包数': stats.packetsLost,
          '收包数': stats.packetsReceived,
          '抖动': `${(stats.jitter * 1000).toFixed(1)}ms`,
          'RTT': `${(stats.roundTripTime * 1000).toFixed(1)}ms`,
        })

        // 如果丢包率过高，输出警告
        if (parseFloat(lossRate) > 5) {
          console.warn('[通话质量] 警告：丢包率过高，可能导致音频质量下降')
        }
      }
    }, 3000)
  }

  /**
   * 停止音频统计监控
   */
  const stopStatsMonitor = () => {
    if (statsTimer) {
      clearInterval(statsTimer)
      statsTimer = null
    }
  }

  /**
   * 重置通话状态
   */
  const resetCallState = () => {
    status.value = 'idle'
    callId.value = null
    peerId.value = null
    peerInfo.value = null
    isCaller.value = false
    startTime.value = null
    duration.value = 0
    isMuted.value = false
    isSpeaker.value = false
    endReason.value = null
    isProcessing = false  // 重置操作锁

    // 清理音频元素
    if (remoteAudio) {
      remoteAudio.srcObject = null
      remoteAudio = null
    }
  }

  return {
    // 状态
    status,
    callId,
    peerId,
    peerInfo,
    isCaller,
    startTime,
    duration,
    isMuted,
    isSpeaker,
    endReason,
    // 计算属性
    isInCall,
    isConnected,
    formattedDuration,
    // 方法
    initCallListeners,
    removeCallListeners,
    initiateCall,
    acceptCall,
    rejectCall,
    cancelCall,
    endCall,
    toggleMute,
    toggleSpeaker,
  }
})
