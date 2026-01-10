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
    expiresIn: '7d'
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
    allowedVideoTypes: ['video/mp4', 'video/quicktime', 'video/webm']
  }
};
