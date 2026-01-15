/**
 * 数据库连接池优化配置
 *
 * 替换 server/src/config/database.js 中的配置
 *
 * 2核4G 服务器推荐配置
 */

const mysql = require('mysql2/promise');
const config = require('./index');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,

  // ===== 连接池优化 =====
  waitForConnections: true,
  connectionLimit: 30,        // 从 10 增加到 30（2核建议值）
  queueLimit: 100,            // 等待队列上限，防止无限等待

  // ===== 连接保活 =====
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,  // 10秒后开始保活检测

  // ===== 超时配置 =====
  connectTimeout: 10000,      // 连接超时 10秒
  acquireTimeout: 10000,      // 获取连接超时 10秒

  // ===== 空闲连接回收 =====
  idleTimeout: 60000,         // 空闲连接 60秒后回收
});

// 测试连接
pool.getConnection()
  .then(connection => {
    console.log('数据库连接成功');
    connection.release();
  })
  .catch(err => {
    console.error('数据库连接失败:', err.message);
  });

module.exports = pool;
