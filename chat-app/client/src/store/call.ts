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
    if (status.value !== 'ringing' || !callId.value) {
      return false
    }

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
          if (result.success) {
            status.value = 'connecting'
            resolve(true)
          } else {
            webrtcManager?.close()
            webrtcManager = null
            uni.showToast({ title: result.error || '接听失败', icon: 'none' })
            resolve(false)
          }
        })
      })
    } catch (error) {
      webrtcManager?.close()
      webrtcManager = null

      const err = error as Error
      uni.showToast({ title: err.message || '接听失败', icon: 'none' })
      return false
    }
  }

  /**
   * 拒绝来电
   */
  const rejectCall = (): void => {
    if (status.value !== 'ringing' || !callId.value) return

    socketStore.socket?.emit('call:reject', {
      callId: callId.value,
      reason: 'declined'
    })

    resetCallState()
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
    // 如果正在通话中，自动拒绝
    if (isInCall.value) {
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
  }

  /**
   * 处理对方接听
   */
  const handleCallAccepted = async (data: { callId: string; receiverInfo: PeerInfo }) => {
    if (callId.value !== data.callId) return

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
    if (callId.value !== data.callId) return

    webrtcManager?.close()
    webrtcManager = null

    endReason.value = 'rejected'
    status.value = 'ended'

    uni.showToast({ title: '对方已拒绝', icon: 'none' })

    setTimeout(() => resetCallState(), 2000)
  }

  /**
   * 处理通话结束
   */
  const handleCallEnded = (data: { callId: string; duration: number; endedBy: number; reason?: string }) => {
    if (callId.value !== data.callId) return

    webrtcManager?.close()
    webrtcManager = null
    stopDurationTimer()

    endReason.value = (data.reason as CallEndReason) || 'hangup'
    status.value = 'ended'

    setTimeout(() => resetCallState(), 2000)
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

    setTimeout(() => resetCallState(), 2000)
  }

  /**
   * 处理呼叫取消
   */
  const handleCallCancelled = (data: { callId: string }) => {
    if (callId.value !== data.callId) return

    endReason.value = 'cancelled'
    status.value = 'ended'

    uni.showToast({ title: '对方已取消', icon: 'none' })

    setTimeout(() => resetCallState(), 2000)
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
    }
    remoteAudio.srcObject = stream
    remoteAudio.play().catch(console.error)
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
