/**
 * PM2 多进程配置
 *
 * 2核4G 服务器推荐配置
 *
 * 使用方式：
 *   pm2 start ecosystem.config.js
 *   pm2 reload ecosystem.config.js  # 热重载
 *   pm2 stop all
 *   pm2 logs
 */

module.exports = {
  apps: [{
    name: 'chat-server',
    script: './src/app.js',
    cwd: '/opt/LT/chat-app/server',  // 服务器上的路径

    // ===== 多进程配置 =====
    instances: 2,              // 2核服务器用 2 个进程
    exec_mode: 'cluster',      // cluster 模式

    // ===== 内存限制 =====
    max_memory_restart: '800M', // 单进程内存超过 800M 自动重启

    // ===== 环境变量 =====
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },

    // ===== 日志配置 =====
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '/var/log/pm2/chat-error.log',
    out_file: '/var/log/pm2/chat-out.log',
    merge_logs: true,
    log_type: 'json',

    // ===== 重启策略 =====
    autorestart: true,
    watch: false,              // 生产环境不要开启 watch
    max_restarts: 10,          // 最多重启 10 次
    min_uptime: '10s',         // 启动后至少运行 10 秒才算成功
    restart_delay: 4000,       // 重启间隔 4 秒

    // ===== 优雅关闭 =====
    kill_timeout: 5000,        // 等待 5 秒后强制关闭
    listen_timeout: 10000,     // 监听端口超时 10 秒

    // ===== 健康检查 =====
    exp_backoff_restart_delay: 100,  // 指数退避重启延迟
  }]
};
