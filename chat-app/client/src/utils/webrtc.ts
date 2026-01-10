/**
 * WebRTC 封装类
 * 处理点对点音频通话的核心逻辑
 */

// ICE 服务器配置
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
]

// 事件回调类型
export interface WebRTCCallbacks {
  onLocalStream?: (stream: MediaStream) => void
  onRemoteStream?: (stream: MediaStream) => void
  onIceCandidate?: (candidate: RTCIceCandidate) => void
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void
  onError?: (error: Error) => void
}

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null
  private localStream: MediaStream | null = null
  private remoteStream: MediaStream | null = null
  private callbacks: WebRTCCallbacks = {}
  private isMuted: boolean = false

  /**
   * 检查浏览器是否支持 WebRTC
   */
  static isSupported(): boolean {
    return !!(
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia &&
      window.RTCPeerConnection
    )
  }

  /**
   * 请求麦克风权限并获取音频流
   */
  async requestAudioStream(): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })
      this.localStream = stream
      this.callbacks.onLocalStream?.(stream)
      return stream
    } catch (error) {
      const err = error as Error
      let message = '无法获取麦克风权限'

      if (err.name === 'NotAllowedError') {
        message = '麦克风权限被拒绝，请在浏览器设置中允许访问'
      } else if (err.name === 'NotFoundError') {
        message = '未检测到麦克风设备'
      } else if (err.name === 'NotReadableError') {
        message = '麦克风被其他应用占用'
      }

      throw new Error(message)
    }
  }

  /**
   * 初始化 RTCPeerConnection
   */
  initPeerConnection(callbacks: WebRTCCallbacks): RTCPeerConnection {
    this.callbacks = callbacks

    // 创建 PeerConnection
    this.peerConnection = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
    })

    // 监听 ICE 候选
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.callbacks.onIceCandidate?.(event.candidate)
      }
    }

    // 监听远程流
    this.peerConnection.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0]
        this.callbacks.onRemoteStream?.(event.streams[0])
      }
    }

    // 监听连接状态变化
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState
      if (state) {
        this.callbacks.onConnectionStateChange?.(state)

        // 连接失败或断开时的处理
        if (state === 'failed' || state === 'disconnected') {
          this.callbacks.onError?.(new Error(`连接状态: ${state}`))
        }
      }
    }

    // ICE 连接状态变化
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE 状态:', this.peerConnection?.iceConnectionState)
    }

    // 添加本地音频轨道
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection?.addTrack(track, this.localStream!)
      })
    }

    return this.peerConnection
  }

  /**
   * 创建 Offer（呼叫者调用）
   */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('PeerConnection 未初始化')
    }

    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    })

    await this.peerConnection.setLocalDescription(offer)
    return offer
  }

  /**
   * 处理收到的 Offer（接听者调用）
   */
  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('PeerConnection 未初始化')
    }

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer))

    const answer = await this.peerConnection.createAnswer()
    await this.peerConnection.setLocalDescription(answer)

    return answer
  }

  /**
   * 处理收到的 Answer（呼叫者调用）
   */
  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('PeerConnection 未初始化')
    }

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
  }

  /**
   * 添加 ICE 候选
   */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('PeerConnection 未初始化')
    }

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
    } catch (error) {
      console.warn('添加 ICE 候选失败:', error)
    }
  }

  /**
   * 切换静音状态
   */
  toggleMute(): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0]
      if (audioTrack) {
        this.isMuted = !this.isMuted
        audioTrack.enabled = !this.isMuted
      }
    }
    return this.isMuted
  }

  /**
   * 设置静音状态
   */
  setMuted(muted: boolean): void {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0]
      if (audioTrack) {
        this.isMuted = muted
        audioTrack.enabled = !muted
      }
    }
  }

  /**
   * 获取当前静音状态
   */
  getMuted(): boolean {
    return this.isMuted
  }

  /**
   * 获取本地流
   */
  getLocalStream(): MediaStream | null {
    return this.localStream
  }

  /**
   * 获取远程流
   */
  getRemoteStream(): MediaStream | null {
    return this.remoteStream
  }

  /**
   * 获取连接状态
   */
  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState || null
  }

  /**
   * 关闭连接并释放资源
   */
  close(): void {
    // 停止所有本地轨道
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop())
      this.localStream = null
    }

    // 停止所有远程轨道
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => track.stop())
      this.remoteStream = null
    }

    // 关闭 PeerConnection
    if (this.peerConnection) {
      this.peerConnection.close()
      this.peerConnection = null
    }

    // 重置状态
    this.isMuted = false
    this.callbacks = {}
  }
}

// 导出单例工厂方法
export const createWebRTCManager = (): WebRTCManager => {
  return new WebRTCManager()
}
