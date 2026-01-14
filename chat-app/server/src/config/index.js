module.exports = {
  port: process.env.PORT || 3000,

  // 数据库配置
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'chat_user',
    password: process.env.DB_PASSWORD || 'chat123456',
    database: process.env.DB_NAME || 'chat_app'
  },

  // Redis 配置
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  },

  // JWT 配置
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
    adminSecret: process.env.JWT_ADMIN_SECRET || 'your-admin-secret-jwt-key',
    expiresIn: '7d',
    adminExpiresIn: '24h'
  },

  // 功能开关
  features: {
    // 是否允许注册（false = 关闭注册入口）
    registerEnabled: process.env.FEATURE_REGISTER_ENABLED !== 'false',
    // 是否启用语音通话（false = 关闭语音通话入口）
    voiceCallEnabled: process.env.FEATURE_VOICE_CALL_ENABLED !== 'false'
  },

  // IP 注册限制配置（仅对推荐链接注册生效）
  ipLimit: {
    // 是否启用 IP 限制
    enabled: process.env.IP_LIMIT_ENABLED === 'true',
    // 同一 IP 通过同一推荐链接允许注册的最大次数
    maxRegistrationsPerLink: parseInt(process.env.IP_LIMIT_MAX_PER_LINK) || 1
  },

  // 上传配置
  upload: {
    maxSize: 10 * 1024 * 1024, // 10MB（图片）
    maxFileSize: 20 * 1024 * 1024, // 20MB（文件）
    maxVideoSize: 50 * 1024 * 1024, // 50MB（视频）
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedVoiceTypes: [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/aac',
      'audio/webm', 'audio/ogg', 'audio/opus'  // H5 录音格式
    ],
    allowedFileTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain'
    ],
    allowedVideoTypes: [
      'video/mp4',
      'video/quicktime',  // MOV
      'video/webm',
      'video/3gpp',       // 3GP (安卓常用)
      'video/3gpp2',      // 3G2
      'video/x-m4v',      // M4V (iOS 常用)
      'video/x-msvideo',  // AVI
      'video/x-matroska', // MKV
      'video/mov',        // 某些浏览器使用这个
      'video/mpeg',       // MPEG
      'video/ogg',        // OGG
      'application/octet-stream', // 某些移动端浏览器可能发送这个
    ]
  }
};
