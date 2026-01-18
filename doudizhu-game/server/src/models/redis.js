const { createClient } = require('redis')
const config = require('../config')

const client = createClient({
  url: config.redis.url,
})

client.on('error', (err) => console.error('Redis Client Error:', err))
client.on('connect', () => console.log('Redis 客户端连接中...'))
client.on('ready', () => console.log('Redis 客户端就绪'))

// 自动连接
client.connect().catch(console.error)

module.exports = {
  // 基础操作
  async get(key) {
    return client.get(key)
  },

  async set(key, value, options = {}) {
    if (options.EX) {
      return client.set(key, value, { EX: options.EX })
    }
    return client.set(key, value)
  },

  async del(key) {
    return client.del(key)
  },

  async exists(key) {
    return client.exists(key)
  },

  async expire(key, seconds) {
    return client.expire(key, seconds)
  },

  async ttl(key) {
    return client.ttl(key)
  },

  // JSON 操作
  async getJSON(key) {
    const data = await client.get(key)
    return data ? JSON.parse(data) : null
  },

  async setJSON(key, value, options = {}) {
    const data = JSON.stringify(value)
    if (options.EX) {
      return client.set(key, data, { EX: options.EX })
    }
    return client.set(key, data)
  },

  // 集合操作
  async sAdd(key, member) {
    return client.sAdd(key, member)
  },

  async sRem(key, member) {
    return client.sRem(key, member)
  },

  async sMembers(key) {
    return client.sMembers(key)
  },

  async sIsMember(key, member) {
    return client.sIsMember(key, member)
  },

  // 有序集合操作
  async zAdd(key, score, member) {
    return client.zAdd(key, { score, value: member })
  },

  async zRem(key, member) {
    return client.zRem(key, member)
  },

  async zRange(key, start, stop) {
    return client.zRange(key, start, stop)
  },

  // Hash 操作
  async hSet(key, field, value) {
    return client.hSet(key, field, value)
  },

  async hGet(key, field) {
    return client.hGet(key, field)
  },

  async hGetAll(key) {
    return client.hGetAll(key)
  },

  async hDel(key, field) {
    return client.hDel(key, field)
  },

  // 发布订阅
  async publish(channel, message) {
    return client.publish(channel, JSON.stringify(message))
  },

  // 工具方法
  async ping() {
    return client.ping()
  },

  async quit() {
    return client.quit()
  },

  // 获取原始客户端
  getClient() {
    return client
  },
}
