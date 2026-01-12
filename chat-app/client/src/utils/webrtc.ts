/**
 * WebRTC 封装类
 * 处理点对点音频通话的核心逻辑
 */

// ICE 服务器配置
const ICE_SERVERS: RTCIceServer[] = [
  // STUN 服务器
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // 免费 TURN 服务器 (Open Relay Project)
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
]

// 音频配置模式
export type AudioMode = 'optimized' | 'raw' | 'balanced'

// 音频约束配置
const AUDIO_CONSTRAINTS: Record<AudioMode, MediaTrackConstraints> = {
  // 优化模式：强制启用所有音频处理（推荐用于通话）
  optimized: {
    echoCancellation: true,           // 强制启用回声消除
    noiseSuppression: true,           // 强制启用降噪
    autoGainControl: true,            // 强制启用自动增益
    sampleRate: { ideal: 48000 },
    channelCount: { ideal: 1 },       // 优先单声道（减少回声）
    sampleSize: { ideal: 16 },
    latency: { ideal: 0.01 },
    // Google Chrome 高级音频处理（实验性但广泛支持）
    // @ts-ignore - 这些是 Chrome 特有的约束
    googEchoCancellation: true,
    googAutoGainControl: true,
    googNoiseSuppression: true,
    googHighpassFilter: true,         // 高通滤波器，过滤低频噪音
    googTypingNoiseDetection: true,   // 检测并抑制键盘敲击声
  } as MediaTrackConstraints,
  // 原始模式：禁用浏览器音频处理（用于音乐等场景）
  raw: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    sampleRate: { ideal: 48000 },
    channelCount: { ideal: 1 },
  },
  // 平衡模式：仅启用回声消除和降噪
  balanced: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: false,           // 不自动调节增益
    sampleRate: { ideal: 48000 },
    channelCount: { ideal: 1 },
    latency: { ideal: 0.02 },
  },
}

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
  private audioMode: AudioMode = 'optimized' // 启用回声消除和降噪

  /**
   * 设置音频模式
   * @param mode 'optimized' | 'raw' | 'balanced'
   */
  setAudioMode(mode: AudioMode): void {
    this.audioMode = mode
    console.log('[WebRTC] 音频模式设置为:', mode)
  }

  /**
   * 优化 Opus 编码参数的 SDP 修改
   * 启用前向纠错 (FEC) 和其他音质优化
   */
  private mungeOpusSDP(sdp: string): string {
    // 查找 Opus 编解码器的 fmtp 行并添加优化参数
    // useinbandfec=1: 启用前向纠错（关键！解决丢包导致的卡顿）
    // usedtx=0: 禁用不连续传输（保持音频流稳定）
    // maxplaybackrate=48000: 最大播放率
    // stereo=0: 单声道
    // maxaveragebitrate=24000: 适中比特率（平衡质量和网络）

    // 更灵活的正则表达式，匹配各种 fmtp 格式
    const opusFmtpRegex = /a=fmtp:111\s+(.*?)(\r?\n)/g

    const optimizedSdp = sdp.replace(opusFmtpRegex, (match, params, lineEnd) => {
      // 检查是否已经有这些参数，避免重复添加
      let newParams = params
      if (!params.includes('useinbandfec')) {
        newParams += ';useinbandfec=1'
      }
      if (!params.includes('usedtx')) {
        newParams += ';usedtx=0'
      }
      if (!params.includes('maxplaybackrate')) {
        newParams += ';maxplaybackrate=48000'
      }
      if (!params.includes('stereo')) {
        newParams += ';stereo=0'
      }
      if (!params.includes('maxaveragebitrate')) {
        newParams += ';maxaveragebitrate=64000'  // 提高到 64kbps
      }

      console.log('[WebRTC] Opus SDP 优化:', {
        original: params,
        optimized: newParams,
      })

      return `a=fmtp:111 ${newParams}${lineEnd}`
    })

    // 如果没有找到 fmtp:111，记录警告
    if (optimizedSdp === sdp) {
      console.warn('[WebRTC] 未找到 Opus fmtp 行，SDP 未被优化')
      console.log('[WebRTC] SDP 内容:', sdp.substring(0, 500))
    }

    return optimizedSdp
  }

  /**
   * 优化音频编码参数
   * 设置比特率和优先级
   */
  private async optimizeAudioCodec(): Promise<void> {
    const senders = this.peerConnection?.getSenders()
    if (!senders) return

    for (const sender of senders) {
      if (sender.track?.kind === 'audio') {
        try {
          const params = sender.getParameters()
          if (params.encodings && params.encodings.length > 0) {
            // 提高比特率（64kbps 提供更好的音质）
            params.encodings[0].maxBitrate = 64000
            // 设置高优先级
            params.encodings[0].priority = 'high'
            // 设置网络优先级（如果支持）
            // @ts-ignore - networkPriority 是较新的 API
            if ('networkPriority' in params.encodings[0]) {
              params.encodings[0].networkPriority = 'high'
            }
            await sender.setParameters(params)
            console.log('[WebRTC] 编码参数已优化:', {
              maxBitrate: params.encodings[0].maxBitrate,
              priority: params.encodings[0].priority,
            })
          }
        } catch (error) {
          console.warn('优化音频编码参数失败:', error)
        }
      }
    }
  }

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
   * @param mode 可选的音频模式覆盖
   */
  async requestAudioStream(mode?: AudioMode): Promise<MediaStream> {
    const audioMode = mode || this.audioMode
    const constraints = AUDIO_CONSTRAINTS[audioMode]

    console.log('[WebRTC] 使用音频模式:', audioMode, constraints)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: constraints,
        video: false,
      })

      // 记录实际获取的音频轨道设置
      const audioTrack = stream.getAudioTracks()[0]
      if (audioTrack) {
        const settings = audioTrack.getSettings()
        console.log('[WebRTC] 实际音频设置:', settings)
      }

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

    // 设置本地描述
    await this.peerConnection.setLocalDescription(offer)

    // 优化音频编码参数（通过 RTP Sender 而非 SDP）
    await this.optimizeAudioCodec()

    // 返回 localDescription（包含 ICE candidates）
    return this.peerConnection.localDescription!
  }

  /**
   * 处理收到的 Offer（接听者调用）
   */
  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('PeerConnection 未初始化')
    }

    // 设置远程描述
    await this.peerConnection.setRemoteDescription(offer)

    const answer = await this.peerConnection.createAnswer()

    // 设置本地描述
    await this.peerConnection.setLocalDescription(answer)

    // 优化音频编码参数（通过 RTP Sender 而非 SDP）
    await this.optimizeAudioCodec()

    // 返回 localDescription
    return this.peerConnection.localDescription!
  }

  /**
   * 处理收到的 Answer（呼叫者调用）
   */
  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('PeerConnection 未初始化')
    }

    // 直接传入对象，避免使用已弃用的 new RTCSessionDescription()
    await this.peerConnection.setRemoteDescription(answer)
  }

  /**
   * 添加 ICE 候选
   */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('PeerConnection 未初始化')
    }

    try {
      // 直接传入对象，避免使用已弃用的 new RTCIceCandidate()
      await this.peerConnection.addIceCandidate(candidate)
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
   * 获取 RTP 接收器列表
   * 用于配置抖动缓冲等参数
   */
  getReceivers(): RTCRtpReceiver[] {
    return this.peerConnection?.getReceivers() || []
  }

  /**
   * 配置抖动缓冲（用于减少网络波动导致的音频中断）
   * @param targetMs 目标抖动缓冲延迟（毫秒）
   */
  configureJitterBuffer(targetMs: number = 100): void {
    const receivers = this.getReceivers()
    receivers.forEach((receiver) => {
      if (receiver.track?.kind === 'audio') {
        // jitterBufferTarget 是较新的 API，单位是毫秒
        // @ts-ignore
        if ('jitterBufferTarget' in receiver) {
          // @ts-ignore
          receiver.jitterBufferTarget = targetMs
          console.log(`已设置抖动缓冲目标: ${targetMs}ms`)
        }
      }
    })
  }

  /**
   * 获取音频质量统计信息
   * 用于监控和调试通话质量
   */
  async getAudioStats(): Promise<{
    jitter: number
    packetsLost: number
    packetsReceived: number
    roundTripTime: number
    audioLevel: number
  } | null> {
    if (!this.peerConnection) return null

    try {
      const stats = await this.peerConnection.getStats()
      const result = {
        jitter: 0,
        packetsLost: 0,
        packetsReceived: 0,
        roundTripTime: 0,
        audioLevel: 0,
      }

      stats.forEach((report) => {
        // 入站 RTP 统计（接收的音频）
        if (report.type === 'inbound-rtp' && report.kind === 'audio') {
          result.jitter = report.jitter || 0
          result.packetsLost = report.packetsLost || 0
          result.packetsReceived = report.packetsReceived || 0
          result.audioLevel = report.audioLevel || 0
        }
        // 连接候选对统计（RTT）
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          result.roundTripTime = report.currentRoundTripTime || 0
        }
      })

      return result
    } catch (error) {
      console.warn('获取音频统计失败:', error)
      return null
    }
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
