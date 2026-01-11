# 单服务器部署指南

一键部署聊天应用到单台 Ubuntu 服务器。

## 系统要求

- **操作系统**: Ubuntu 20.04 / 22.04 LTS
- **最低配置**: 2 核 CPU, 4GB 内存, 40GB 磁盘
- **推荐配置**: 4 核 CPU, 8GB 内存, 80GB SSD
- **网络**: 公网 IP，80/443 端口可访问

## 部署架构

```
                    ┌─────────────────────────────────────────┐
                    │            Ubuntu 服务器                 │
   用户请求 ───────►│                                          │
   (HTTPS)         │  Nginx (80/443)                          │
                    │    ├── / → 前端 H5 静态文件              │
                    │    ├── /api/* → Node.js 后端             │
                    │    ├── /socket.io/* → WebSocket          │
                    │    └── /uploads/* → 上传文件             │
                    │                                          │
                    │  Docker Compose:                         │
                    │    ├── chat-server (Node.js)            │
                    │    ├── chat-mysql (MySQL 8.0)           │
                    │    └── chat-redis (Redis 7)             │
                    └─────────────────────────────────────────┘
```

## 快速开始

### 1. 准备工作

1. 购买一台 Ubuntu 服务器
2. 注册一个域名并将 A 记录指向服务器 IP
3. 确保 80/443 端口可访问

### 2. 上传部署文件

```bash
# 本地执行：上传部署文件到服务器
scp -r single-deploy/ root@YOUR_SERVER_IP:/opt/
```

### 3. 服务器初始化

```bash
# SSH 登录服务器
ssh root@YOUR_SERVER_IP

# 执行初始化脚本
cd /opt/single-deploy
chmod +x *.sh
sudo bash setup.sh
```

这会自动安装：
- Docker + Docker Compose
- Nginx
- Certbot (Let's Encrypt)
- 配置防火墙
- 启用 TCP BBR

### 4. 申请 SSL 证书

```bash
sudo bash ssl-setup.sh chat.yourdomain.com admin@yourdomain.com
```

### 5. 配置前端环境变量

**重要**: 部署前必须配置前端环境变量。

```bash
# 进入项目目录（首次部署前需要先克隆代码）
cd /opt/chat-app/chat-app/client

# 复制模板并编辑
cp .env.example .env
nano .env
```

编辑 `.env` 文件，设置实际域名：

```env
VITE_API_URL=https://chat.yourdomain.com
VITE_SOCKET_URL=https://chat.yourdomain.com
VITE_CDN_URL=https://chat.yourdomain.com
```

### 6. 部署应用

```bash
sudo bash deploy.sh --init
```

部署过程中会要求输入：
- 域名
- Git 仓库地址
- 数据库密码（可自动生成）

### 7. 验证部署

访问 `https://chat.yourdomain.com` 测试应用。

## 脚本说明

| 脚本 | 功能 | 用法 |
|------|------|------|
| `setup.sh` | 服务器初始化 | `sudo bash setup.sh` |
| `ssl-setup.sh` | SSL 证书申请 | `sudo bash ssl-setup.sh <域名> <邮箱>` |
| `deploy.sh` | 部署/更新应用 | `sudo bash deploy.sh [选项]` |
| `backup.sh` | 数据备份 | `sudo bash backup.sh [选项]` |

### deploy.sh 选项

```bash
--init              # 首次部署
--update            # 更新部署（备份、拉取代码、迁移、重建）
--rollback          # 回滚到上一个备份
--frontend-only     # 仅更新前端
--backend-only      # 仅更新后端
--restart           # 重启所有服务
--status            # 查看服务状态
--logs              # 查看后端日志
```

### backup.sh 选项

```bash
--all               # 完整备份（数据库 + 上传文件）
--mysql             # 仅备份数据库
--uploads           # 仅备份上传文件
--list              # 列出现有备份
--restore           # 恢复备份（交互式）
--clean             # 清理旧备份
```

## 更新部署

### 标准更新流程

```bash
# 1. 更新部署（自动备份 → 拉取代码 → 数据库迁移 → 重建）
sudo bash deploy.sh --update
```

更新流程会自动：
1. 创建数据库和文件备份
2. 拉取最新代码
3. 检查并应用数据库迁移
4. 重建 Docker 容器
5. 执行健康检查

### 回滚操作

如果更新后出现问题，可以快速回滚：

```bash
sudo bash deploy.sh --rollback
```

回滚会恢复到最近一次备份的数据库和上传文件。

## 数据库迁移

项目使用版本化的数据库迁移系统，迁移文件位于 `server/sql/migrations/` 目录。

### 迁移文件命名规则

```
000_schema_migrations.sql    # 迁移版本表
001_groups_and_media.sql     # 群聊和媒体功能
002_xxx.sql                  # 后续迁移...
```

### 手动执行迁移

```bash
# 进入服务器容器执行迁移
docker exec chat-server sh /app/sql/migrate.sh
```

### 检查迁移状态

```bash
docker exec chat-mysql mysql -uroot -p$DB_ROOT_PASSWORD chat_app \
  -e "SELECT * FROM schema_migrations"
```

## 定时备份

添加 crontab 任务实现每日自动备份：

```bash
crontab -e
```

添加以下行（每天凌晨 3 点备份）：

```
0 3 * * * /opt/single-deploy/backup.sh --all >> /var/log/chat-backup.log 2>&1
```

## 常用命令

```bash
# 查看服务状态
sudo bash deploy.sh --status

# 查看实时日志
sudo bash deploy.sh --logs

# 更新代码并重新部署
sudo bash deploy.sh --update

# 回滚到上一个备份
sudo bash deploy.sh --rollback

# 仅重启服务
sudo bash deploy.sh --restart

# 查看 Docker 容器
docker compose ps

# 进入 MySQL 调试
docker exec -it chat-mysql mysql -uroot -p$DB_ROOT_PASSWORD chat_app

# 进入 Redis 调试
docker exec -it chat-redis redis-cli
```

## 目录结构

部署后的服务器目录结构：

```
/opt/chat-app/
├── chat-app/                  # 项目代码
│   ├── client/                # 前端代码
│   │   ├── .env               # 前端环境配置（需手动创建）
│   │   ├── .env.example       # 环境配置模板
│   │   └── dist/build/h5/     # 构建后的 H5 文件
│   └── server/                # 后端代码
│       ├── src/               # 源代码
│       ├── sql/               # SQL 文件
│       │   ├── init.sql       # 初始化脚本
│       │   ├── migrate.sh     # 迁移脚本
│       │   └── migrations/    # 迁移文件目录
│       └── uploads/           # 上传文件
│           ├── avatars/       # 头像
│           ├── images/        # 图片
│           ├── voices/        # 语音
│           ├── files/         # 文件
│           └── videos/        # 视频
├── backups/                   # 备份目录
│   ├── mysql/                 # 数据库备份
│   └── uploads/               # 文件备份
├── docker-compose.yml         # Docker 配置
├── Dockerfile.server          # 后端镜像
├── nginx.conf                 # Nginx 配置
└── .env                       # 后端环境变量
```

## 端口说明

| 服务 | 端口 | 访问方式 |
|------|------|----------|
| Nginx (HTTP) | 80 | 公网，重定向到 HTTPS |
| Nginx (HTTPS) | 443 | 公网，主入口 |
| Node.js | 3000 | 仅本地，通过 Nginx 代理 |
| MySQL | 3306 | 仅本地 |
| Redis | 6379 | 仅本地 |

## 上传限制

| 文件类型 | 大小限制 |
|----------|----------|
| 头像 | 2MB |
| 图片 | 10MB |
| 语音 | 5MB |
| 文件 | 20MB |
| 视频 | 50MB |

Nginx 已配置 `client_max_body_size 60M` 以支持最大文件上传。

## 安全建议

1. **SSH 安全**
   - 禁用密码登录，使用密钥认证
   - 修改默认 SSH 端口

2. **数据库安全**
   - 使用强密码
   - MySQL/Redis 仅绑定本地端口

3. **定期更新**
   - 定期更新系统包
   - 定期更新 Docker 镜像

4. **备份策略**
   - 启用定时备份
   - 定期测试备份恢复

## 故障排查

### 服务无法启动

```bash
# 查看 Docker 日志
docker compose logs -f

# 查看 Nginx 日志
tail -f /var/log/nginx/chat-error.log
```

### 健康检查失败

```bash
# 检查后端健康端点
curl http://localhost:3000/health

# 检查容器状态
docker compose ps
```

### SSL 证书问题

```bash
# 手动续期证书
sudo certbot renew --dry-run

# 检查证书状态
sudo certbot certificates
```

### 前端配置问题

```bash
# 检查 .env 文件是否存在
cat /opt/chat-app/chat-app/client/.env

# 重新构建前端
sudo bash deploy.sh --frontend-only
```

### 数据库迁移问题

```bash
# 查看迁移状态
docker exec chat-mysql mysql -uroot -p$DB_ROOT_PASSWORD chat_app \
  -e "SELECT * FROM schema_migrations"

# 手动执行迁移
docker exec chat-server sh /app/sql/migrate.sh
```

## 更新日志

- **v2.0.0** - 部署方案改进
  - 前端配置改用 .env 环境变量注入
  - 新增数据库迁移系统（自动版本管理）
  - 新增 `--rollback` 回滚功能
  - 更新前自动备份
  - 支持 50MB 视频上传
  - 视频文件支持断点续传

- **v1.0.0** - 初始版本
  - 支持单服务器部署
  - Let's Encrypt SSL 自动申请
  - Docker Compose 容器化部署
  - 自动备份和恢复
