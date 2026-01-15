import http from 'k6/http'
import { WebSocket } from 'k6/experimental/websockets'
import { Trend, Counter, Rate } from 'k6/metrics'

// 自定义指标
export const messageLatency = new Trend('message_latency', true)
export const messageSent = new Rate('message_sent')
export const broadcastLatency = new Trend('broadcast_latency', true)
export const broadcastSuccess = new Rate('broadcast_success')

/**
 * Engine.io 协议常量
 * @see https://github.com/socketio/engine.io-protocol
 */
const EIO_PACKET = {
  OPEN: '0',
  CLOSE: '1',
  PING: '2',
  PONG: '3',
  MESSAGE: '4',
  UPGRADE: '5',
  NOOP: '6'
}

/**
 * Socket.io 协议常量
 * @see https://github.com/socketio/socket.io-protocol
 */
const SIO_PACKET = {
  CONNECT: 0,
  DISCONNECT: 1,
  EVENT: 2,
  ACK: 3,
  CONNECT_ERROR: 4,
  BINARY_EVENT: 5,
  BINARY_ACK: 6
}

/**
 * Socket.io 客户端封装
 */
export class SocketIOClient {
  constructor(baseUrl, wsUrl, token) {
    this.baseUrl = baseUrl
    this.wsUrl = wsUrl
    this.token = token
    this.sid = null
    this.ws = null
    this.connected = false
    this.ackId = 0
    this.callbacks = new Map()
    this.eventHandlers = new Map()
    this.pingInterval = null
  }

  /**
   * 连接到 Socket.io 服务器
   */
  async connect() {
    // Step 1: HTTP 握手获取 sid
    const handshakeUrl = `${this.baseUrl}/socket.io/?EIO=4&transport=polling&token=${this.token}`
    const response = http.get(handshakeUrl)

    if (response.status !== 200) {
      console.error(`Handshake failed: ${response.status}`)
      return false
    }

    // 解析 Engine.io OPEN 包
    // 格式: 0{"sid":"xxx","upgrades":["websocket"],"pingInterval":25000,"pingTimeout":60000}
    const body = response.body
    if (!body.startsWith(EIO_PACKET.OPEN)) {
      console.error(`Invalid handshake response: ${body}`)
      return false
    }

    const openData = JSON.parse(body.substring(1))
    this.sid = openData.sid
    this.pingInterval = openData.pingInterval || 25000

    // Step 2: 升级到 WebSocket
    const wsUrl = `${this.wsUrl}/socket.io/?EIO=4&transport=websocket&sid=${this.sid}&token=${this.token}`

    return new Promise((resolve) => {
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        // 发送 upgrade probe
        this.ws.send(EIO_PACKET.PING + 'probe')
      }

      this.ws.onmessage = (e) => {
        this.handleMessage(e.data, resolve)
      }

      this.ws.onerror = (e) => {
        console.error(`WebSocket error: ${e.message || e}`)
        this.connected = false
        resolve(false)
      }

      this.ws.onclose = () => {
        this.connected = false
        this.stopPing()
      }

      // 设置连接超时
      setTimeout(() => {
        if (!this.connected) {
          console.error('Connection timeout')
          this.close()
          resolve(false)
        }
      }, 10000)
    })
  }

  /**
   * 处理接收到的消息
   */
  handleMessage(data, connectResolve) {
    if (!data || data.length === 0) return

    const packetType = data[0]

    switch (packetType) {
      case EIO_PACKET.OPEN:
        // Engine.io OPEN (握手响应)
        break

      case EIO_PACKET.PING:
        // Engine.io PING，回复 PONG
        this.ws.send(EIO_PACKET.PONG)
        break

      case EIO_PACKET.PONG:
        // Engine.io PONG
        if (data === EIO_PACKET.PONG + 'probe') {
          // 升级确认，发送 UPGRADE
          this.ws.send(EIO_PACKET.UPGRADE)
          // 发送 Socket.io CONNECT
          this.ws.send(EIO_PACKET.MESSAGE + SIO_PACKET.CONNECT)
        }
        break

      case EIO_PACKET.MESSAGE:
        // Socket.io 消息
        this.handleSocketIOPacket(data.substring(1), connectResolve)
        break

      case EIO_PACKET.CLOSE:
        this.close()
        break
    }
  }

  /**
   * 处理 Socket.io 数据包
   */
  handleSocketIOPacket(data, connectResolve) {
    if (!data || data.length === 0) return

    const packetType = parseInt(data[0])
    const payload = data.substring(1)

    switch (packetType) {
      case SIO_PACKET.CONNECT:
        // 连接成功
        this.connected = true
        this.startPing()
        if (connectResolve) connectResolve(true)
        // 触发 connect 事件
        this.triggerEvent('connect', JSON.parse(payload || '{}'))
        break

      case SIO_PACKET.DISCONNECT:
        this.connected = false
        this.triggerEvent('disconnect')
        break

      case SIO_PACKET.EVENT:
        this.handleEvent(payload)
        break

      case SIO_PACKET.ACK:
        this.handleAck(payload)
        break

      case SIO_PACKET.CONNECT_ERROR:
        console.error(`Socket.io connect error: ${payload}`)
        if (connectResolve) connectResolve(false)
        break
    }
  }

  /**
   * 处理服务器事件
   */
  handleEvent(payload) {
    // 解析 ack id (如果有)
    let ackId = null
    let jsonStart = 0

    // 检查是否有 ack id (数字开头)
    const match = payload.match(/^(\d+)/)
    if (match) {
      ackId = parseInt(match[1])
      jsonStart = match[1].length
    }

    try {
      const eventData = JSON.parse(payload.substring(jsonStart))
      const eventName = eventData[0]
      const eventArgs = eventData.slice(1)

      // 触发事件处理器
      this.triggerEvent(eventName, ...eventArgs)

      // 如果需要 ack，发送确认
      if (ackId !== null) {
        this.sendAck(ackId)
      }
    } catch (e) {
      console.error(`Failed to parse event: ${e.message}`)
    }
  }

  /**
   * 处理服务器 ACK
   */
  handleAck(payload) {
    const match = payload.match(/^(\d+)(.*)/)
    if (match) {
      const ackId = parseInt(match[1])
      const data = match[2] ? JSON.parse(match[2]) : null

      const callback = this.callbacks.get(ackId)
      if (callback) {
        callback(data)
        this.callbacks.delete(ackId)
      }
    }
  }

  /**
   * 发送事件到服务器
   */
  emit(eventName, data, callback) {
    if (!this.connected || !this.ws) {
      console.error('Not connected')
      return false
    }

    let packet = EIO_PACKET.MESSAGE + SIO_PACKET.EVENT

    // 如果有回调，添加 ack id
    if (callback) {
      const ackId = this.ackId++
      this.callbacks.set(ackId, callback)
      packet += ackId
    }

    // 序列化事件数据
    const eventData = data !== undefined ? [eventName, data] : [eventName]
    packet += JSON.stringify(eventData)

    try {
      this.ws.send(packet)
      return true
    } catch (e) {
      console.error(`Failed to send: ${e.message}`)
      return false
    }
  }

  /**
   * 发送带确认回调的事件 (Promise 版本)
   */
  emitWithAck(eventName, data, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now()
      const timeoutId = setTimeout(() => {
        reject(new Error('Emit timeout'))
      }, timeout)

      this.emit(eventName, data, (response) => {
        clearTimeout(timeoutId)
        const latency = Date.now() - startTime
        resolve({ response, latency })
      })
    })
  }

  /**
   * 发送 ACK 到服务器
   */
  sendAck(ackId, data) {
    const packet = EIO_PACKET.MESSAGE + SIO_PACKET.ACK + ackId + (data ? JSON.stringify(data) : '')
    this.ws.send(packet)
  }

  /**
   * 注册事件处理器
   */
  on(eventName, handler) {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, [])
    }
    this.eventHandlers.get(eventName).push(handler)
  }

  /**
   * 移除事件处理器
   */
  off(eventName, handler) {
    const handlers = this.eventHandlers.get(eventName)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index !== -1) {
        handlers.splice(index, 1)
      }
    }
  }

  /**
   * 触发事件
   */
  triggerEvent(eventName, ...args) {
    const handlers = this.eventHandlers.get(eventName)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args)
        } catch (e) {
          console.error(`Event handler error: ${e.message}`)
        }
      })
    }
  }

  /**
   * 开始心跳
   */
  startPing() {
    // k6 不支持 setInterval，使用其他方式维持心跳
    // 心跳由服务器发起 PING，客户端回复 PONG（在 handleMessage 中处理）
  }

  /**
   * 停止心跳
   */
  stopPing() {
    // 清理资源
  }

  /**
   * 关闭连接
   */
  close() {
    this.connected = false
    this.stopPing()

    if (this.ws) {
      try {
        // 发送断开连接包
        this.ws.send(EIO_PACKET.MESSAGE + SIO_PACKET.DISCONNECT)
        this.ws.close()
      } catch (e) {
        // 忽略关闭错误
      }
      this.ws = null
    }
  }

  /**
   * 检查是否已连接
   */
  isConnected() {
    return this.connected
  }
}

/**
 * 登录并获取 token
 */
export function login(baseUrl, account, password) {
  const response = http.post(
    `${baseUrl}/api/auth/login`,
    JSON.stringify({ account, password }),
    {
      headers: { 'Content-Type': 'application/json' }
    }
  )

  if (response.status === 200) {
    const data = JSON.parse(response.body)
    if (data.code === 200) {
      return {
        success: true,
        token: data.data.token,
        user: data.data.user
      }
    }
  }

  return {
    success: false,
    error: response.body
  }
}

/**
 * 创建私聊会话
 */
export function createPrivateConversation(baseUrl, token, friendId) {
  const response = http.post(
    `${baseUrl}/api/conversations/private`,
    JSON.stringify({ friendId }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }
  )

  if (response.status === 200) {
    const data = JSON.parse(response.body)
    if (data.code === 200) {
      return {
        success: true,
        conversation: data.data
      }
    }
  }

  return {
    success: false,
    error: response.body
  }
}

/**
 * 获取好友列表
 */
export function getFriends(baseUrl, token) {
  const response = http.get(`${baseUrl}/api/friends`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  if (response.status === 200) {
    const data = JSON.parse(response.body)
    if (data.code === 200) {
      // API 返回格式: { data: { list: [...], grouped: {...} } }
      const friends = data.data.list || data.data || []
      return {
        success: true,
        friends: friends
      }
    }
  }

  return {
    success: false,
    friends: [],
    error: response.body
  }
}

/**
 * 获取群组列表
 */
export function getGroups(baseUrl, token) {
  const response = http.get(`${baseUrl}/api/groups`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  if (response.status === 200) {
    const data = JSON.parse(response.body)
    if (data.code === 200) {
      return {
        success: true,
        groups: data.data
      }
    }
  }

  return {
    success: false,
    error: response.body
  }
}
