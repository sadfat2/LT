const mysql = require('mysql2/promise')
const config = require('../config')

// 创建连接池
const pool = mysql.createPool({
  host: config.mysql.host,
  port: config.mysql.port,
  user: config.mysql.user,
  password: config.mysql.password,
  database: config.mysql.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

module.exports = {
  // 执行查询
  async query(sql, params) {
    const [rows] = await pool.execute(sql, params)
    return rows
  },

  // 获取单条记录
  async findOne(sql, params) {
    const rows = await this.query(sql, params)
    return rows[0] || null
  },

  // 插入并返回 ID
  async insert(sql, params) {
    const [result] = await pool.execute(sql, params)
    return result.insertId
  },

  // 更新并返回影响行数
  async update(sql, params) {
    const [result] = await pool.execute(sql, params)
    return result.affectedRows
  },

  // 删除并返回影响行数
  async delete(sql, params) {
    const [result] = await pool.execute(sql, params)
    return result.affectedRows
  },

  // 获取连接（用于事务）
  async getConnection() {
    return pool.getConnection()
  },

  // 关闭连接池
  async end() {
    await pool.end()
  },
}
