# 性能优化指南 - 2核4G 服务器

## 优化概览

| 优化项 | 原配置 | 优化后 | 预期提升 |
|--------|--------|--------|----------|
| 数据库连接池 | 10 | 30 | 3x 并发能力 |
| Node.js 进程 | 1 | 2 (PM2 cluster) | 2x 吞吐量 |
| MySQL max_connections | 200 | 300 | 更多并发 |
| MySQL buffer_pool | 256M | 512M | 查询更快 |
| Redis maxmemory | 128M | 256M | 更多缓存 |

---

## 第一步：优化数据库连接池

SSH 到服务器后执行：

```bash
# 备份原文件
cp /opt/LT/chat-app/server/src/config/database.js /opt/LT/chat-app/server/src/config/database.js.bak

# 编辑配置
nano /opt/LT/chat-app/server/src/config/database.js
```

修改 `connectionLimit`:

```javascript
const pool = mysql.createPool({
  // ... 其他配置不变
  connectionLimit: 30,        // 从 10 改为 30
  queueLimit: 100,            // 添加队列上限
  connectTimeout: 10000,
  acquireTimeout: 10000,
});
```

---

## 第二步：使用 PM2 多进程

### 2.1 安装 PM2

```bash
npm install -g pm2
```

### 2.2 停止 Docker 中的 Node 服务

```bash
cd /opt/LT
docker-compose stop server
```

### 2.3 创建 PM2 配置文件

```bash
cat > /opt/LT/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'chat-server',
    script: './src/app.js',
    cwd: '/opt/LT/chat-app/server',
    instances: 2,
    exec_mode: 'cluster',
    max_memory_restart: '800M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      DB_HOST: '127.0.0.1',
      DB_PORT: 3306,
      DB_USER: 'chat_user',
      DB_PASSWORD: '你的数据库密码',
      DB_NAME: 'chat_app',
      REDIS_HOST: '127.0.0.1',
      REDIS_PORT: 6379,
      JWT_SECRET: '你的JWT密钥'
    }
  }]
};
EOF
```

### 2.4 启动 PM2

```bash
cd /opt/LT
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # 开机自启
```

### 2.5 查看状态

```bash
pm2 status
pm2 logs
pm2 monit   # 实时监控
```

---

## 第三步：优化 MySQL 配置

### 3.1 更新 docker-compose.yml

修改 MySQL 的 command 部分：

```yaml
mysql:
  command: >
    --max_connections=300
    --innodb_buffer_pool_size=512M
    --innodb_log_file_size=128M
    --innodb_flush_log_at_trx_commit=2
    --innodb_flush_method=O_DIRECT
    --thread_cache_size=16
    --table_open_cache=2000
```

### 3.2 重启 MySQL

```bash
cd /opt/LT
docker-compose restart mysql
```

---

## 第四步：优化 Redis 配置

更新 docker-compose.yml 中 Redis 部分：

```yaml
redis:
  command: >
    redis-server
    --appendonly yes
    --maxmemory 256mb
    --maxmemory-policy allkeys-lru
    --tcp-keepalive 300
```

```bash
docker-compose restart redis
```

---

## 第五步：验证优化效果

重新运行 k6 测试：

```bash
# 本地执行
cd chat-app/k6-tests
k6 run scenarios/login.js --vus 100 --duration 60s
```

预期效果：
- 响应时间从 7-8 秒降低到 1-2 秒
- 吞吐量从 10 req/s 提升到 50+ req/s

---

## 快速部署脚本

一键应用所有优化：

```bash
#!/bin/bash
# optimize.sh - 一键优化脚本

# 1. 更新数据库连接池
sed -i 's/connectionLimit: 10/connectionLimit: 30/' /opt/LT/chat-app/server/src/config/database.js

# 2. 安装 PM2
npm install -g pm2

# 3. 停止 Docker 中的 Node 服务
cd /opt/LT && docker-compose stop server

# 4. 创建 PM2 配置并启动
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# 5. 重启数据库服务（应用新配置需要重建）
docker-compose up -d mysql redis

echo "优化完成！运行 pm2 status 查看状态"
```

---

## 资源分配建议 (2核4G)

| 服务 | CPU | 内存 |
|------|-----|------|
| MySQL | 0.5核 | 1G (buffer_pool 512M) |
| Redis | 0.2核 | 256M |
| Node.js x2 | 1.2核 | 1.6G (800M x 2) |
| 系统预留 | 0.1核 | 1G |
| **总计** | 2核 | 4G |

---

## 常见问题

### Q: PM2 重启后服务不启动？
```bash
pm2 resurrect  # 恢复之前保存的进程
```

### Q: 如何回滚到 Docker 模式？
```bash
pm2 delete all
cd /opt/LT && docker-compose up -d server
```

### Q: 如何查看 MySQL 当前连接数？
```bash
docker exec chat-mysql mysql -uroot -p -e "SHOW STATUS LIKE 'Threads_connected';"
```
