module.exports = {
  // 服务器配置
  port: process.env.PORT || 4000,

  // JWT 配置
  jwt: {
    secret: process.env.JWT_SECRET || 'doudizhu_secret_key_2024',
    expiresIn: '7d',
  },

  // MySQL 配置
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3307,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'root123456',
    database: process.env.MYSQL_DATABASE || 'doudizhu',
  },

  // Redis 配置
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6380',
  },

  // 聊天服务配置（用于跨应用登录）
  chatService: {
    url: process.env.CHAT_SERVICE_URL || 'http://localhost:3000',
    apiKey: process.env.CHAT_API_KEY || '',
  },

  // 游戏配置
  game: {
    // 初始金币
    initialCoins: 10000,
    // 签到奖励（按连续天数递增）
    checkinRewards: [500, 600, 700, 800, 1000, 1500, 2000],
    // 破产线
    bankruptLine: 1000,
    // 每日破产补助次数
    dailyBankruptAidLimit: 3,
    // 破产补助金额
    bankruptAidAmount: 2000,
    // 叫地主超时（秒）
    bidTimeout: 15,
    // 出牌超时（秒）
    playTimeout: 30,
    // 匹配超时（秒）
    matchTimeout: 60,
    // 断线重连超时（秒）
    reconnectTimeout: 60,
  },
}
