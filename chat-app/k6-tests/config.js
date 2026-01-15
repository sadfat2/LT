// K6 性能测试配置文件

// 服务器配置
export const BASE_URL = __ENV.BASE_URL || 'https://chat.laoyegong.xyz'
export const WS_URL = __ENV.WS_URL || 'wss://chat.laoyegong.xyz'

// 测试用户配置
export const USER_COUNT = 100
export const USER_PASSWORD = 'password123'

// 生成测试用户列表
export const USERS = Array.from({ length: USER_COUNT }, (_, i) => ({
  account: `testuser${i + 1}`,
  password: USER_PASSWORD
}))

// 测试参数（本地测试配置：中等负载）
export const TEST_CONFIG = {
  // 登录场景配置
  login: {
    vus: 50,            // 虚拟用户数（中等负载）
    duration: '1m',     // 持续时间
    thresholds: {
      http_req_duration: ['p(95)<500'],  // 95%请求小于500ms
      http_req_failed: ['rate<0.01']     // 失败率小于1%
    }
  },

  // 连接场景配置
  connection: {
    vus: 50,
    duration: '1m',
    thresholds: {
      ws_connecting: ['p(95)<200'],      // 连接时间小于200ms
      ws_session_duration: ['avg>50000'] // 平均会话时长大于50秒
    }
  },

  // 消息发送场景配置
  messaging: {
    vus: 50,
    duration: '1m',
    messageRate: 1,     // 每用户每秒发送消息数
    thresholds: {
      message_sent: ['rate>0.99'],       // 发送成功率大于99%
      message_latency: ['p(95)<500']     // 消息延迟p95小于500ms
    }
  },

  // 群聊广播场景配置
  broadcast: {
    groupCount: 5,      // 测试群数量
    membersPerGroup: 20,// 每群成员数
    duration: '1m',
    thresholds: {
      broadcast_latency: ['p(95)<1000'], // 广播延迟p95小于1秒
      broadcast_success: ['rate>0.99']   // 广播成功率大于99%
    }
  }
}

// Socket.io 配置
export const SOCKETIO_CONFIG = {
  pingInterval: 25000,  // 心跳间隔
  pingTimeout: 60000,   // 心跳超时
  transports: ['websocket']  // 传输方式
}
