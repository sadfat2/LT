/**
 * H5 平台录音工具类
 * 使用 MediaRecorder API 实现浏览器端录音
 */
export class H5Recorder {
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []
  private stream: MediaStream | null = null
  private startTime: number = 0
  private isRecording: boolean = false

  /**
   * 检查浏览器是否支持录音
   */
  static isSupported(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder)
  }

  /**
   * 获取支持的 MIME 类型
   */
  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg'
    ]
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }
    return 'audio/webm' // 默认
  }

  /**
   * 请求麦克风权限
   */
  async requestPermission(): Promise<boolean> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      return true
    } catch (error) {
      console.error('麦克风权限获取失败:', error)
      return false
    }
  }

  /**
   * 开始录音
   */
  async start(): Promise<boolean> {
    if (this.isRecording) {
      return false
    }

    try {
      // 如果没有 stream，先获取权限
      if (!this.stream) {
        const hasPermission = await this.requestPermission()
        if (!hasPermission) {
          return false
        }
      }

      this.audioChunks = []
      this.startTime = Date.now()

      const mimeType = this.getSupportedMimeType()
      this.mediaRecorder = new MediaRecorder(this.stream!, {
        mimeType,
        audioBitsPerSecond: 128000
      })

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }

      this.mediaRecorder.start(100) // 每 100ms 收集一次数据
      this.isRecording = true
      return true
    } catch (error) {
      console.error('录音启动失败:', error)
      return false
    }
  }

  /**
   * 停止录音并返回音频数据
   */
  async stop(): Promise<{ blob: Blob; duration: number } | null> {
    if (!this.isRecording || !this.mediaRecorder) {
      return null
    }

    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = () => {
        const duration = Math.round((Date.now() - this.startTime) / 1000)
        const mimeType = this.mediaRecorder!.mimeType || 'audio/webm'
        const blob = new Blob(this.audioChunks, { type: mimeType })

        this.isRecording = false
        this.audioChunks = []

        resolve({ blob, duration })
      }

      this.mediaRecorder!.stop()
    })
  }

  /**
   * 取消录音
   */
  cancel(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop()
      this.isRecording = false
      this.audioChunks = []
    }
  }

  /**
   * 获取当前录音时长（秒）
   */
  getDuration(): number {
    if (!this.isRecording) {
      return 0
    }
    return Math.round((Date.now() - this.startTime) / 1000)
  }

  /**
   * 是否正在录音
   */
  getIsRecording(): boolean {
    return this.isRecording
  }

  /**
   * 释放资源
   */
  destroy(): void {
    this.cancel()
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }
    this.mediaRecorder = null
  }
}

/**
 * 将 Blob 转换为 Base64
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      resolve(reader.result as string)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * 获取 Blob 的文件扩展名
 */
export function getBlobExtension(blob: Blob): string {
  const mimeType = blob.type
  if (mimeType.includes('webm')) return 'webm'
  if (mimeType.includes('mp4')) return 'm4a'
  if (mimeType.includes('ogg')) return 'ogg'
  return 'webm'
}
