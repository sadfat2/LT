# 部署指南

## 架构说明

```
中国用户 → 香港边缘节点 → 日本主服务器
              ↓
        Cloudflare CDN → 静态资源
```

## 文件说明

```
deploy/
├── docker-compose.prod.yml    # 生产环境 Docker 配置
├── .env.example               # 环境变量模板
├── README.md                  # 本文件
└── nginx/
    ├── japan-api.conf         # 日本服务器 Nginx 配置
    └── hongkong-proxy.conf    # 香港服务器 Nginx 配置
```

## 部署步骤

### 1. 购买域名

在 Cloudflare 或其他注册商购买域名（无需备案）。

### 2. 购买服务器

**日本主服务器（推荐 CN2 GIA 线路）：**
- 配置：4核8G
- 带宽：20Mbps CN2 或 100Mbps BGP
- 推荐：恒创科技、亿速云、DMIT

**香港边缘节点（推荐 CN2 GIA 线路）：**
- 配置：2核4G
- 带宽：10Mbps CN2 或 50Mbps BGP

### 3. 配置 Cloudflare

1. 注册 Cloudflare 账号：https://dash.cloudflare.com/sign-up
2. 添加域名，修改 NS 记录
3. 配置 DNS 记录：

| 类型 | 名称 | 内容 | 代理状态 |
|------|------|------|----------|
| A | chat | 香港服务器IP | 灰色云（仅DNS） |
| A | cdn | 日本服务器IP | 橙色云（已代理） |

**重要**：`chat` 子域名必须关闭代理（灰色云），否则 WebSocket 会有问题。

### 4. 部署日本服务器

```bash
# 1. SSH 连接
ssh root@YOUR_JAPAN_SERVER_IP

# 2. 安装 Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker

# 3. 安装 Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# 4. 安装 Nginx 和 Certbot
apt update && apt install -y nginx certbot python3-certbot-nginx

# 5. 上传项目代码
# 使用 scp 或 git clone 到 /opt/chat-app

# 6. 创建环境变量文件
cd /opt/chat-app/deploy
cp .env.example .env
nano .env  # 填入实际值

# 7. 启动服务
docker-compose -f docker-compose.prod.yml up -d

# 8. 配置 SSL 证书
certbot --nginx -d api.yourdomain.com -d cdn.yourdomain.com

# 9. 配置 Nginx
cp nginx/japan-api.conf /etc/nginx/sites-available/chat-api
ln -s /etc/nginx/sites-available/chat-api /etc/nginx/sites-enabled/
# 编辑配置，替换 /path/to/chat-app 为实际路径
nano /etc/nginx/sites-available/chat-api
nginx -t && systemctl reload nginx

# 10. 启用 TCP BBR（优化网络）
echo "net.core.default_qdisc=fq" >> /etc/sysctl.conf
echo "net.ipv4.tcp_congestion_control=bbr" >> /etc/sysctl.conf
sysctl -p
```

### 5. 部署香港服务器

```bash
# 1. SSH 连接
ssh root@YOUR_HK_SERVER_IP

# 2. 安装 Nginx 和 Certbot
apt update && apt install -y nginx certbot python3-certbot-nginx

# 3. 配置 SSL 证书
certbot --nginx -d chat.yourdomain.com

# 4. 配置 Nginx 代理
# 上传 nginx/hongkong-proxy.conf 到服务器
nano /etc/nginx/sites-available/chat-proxy
# 替换 YOUR_JAPAN_SERVER_IP 为日本服务器 IP

# 5. 启用配置
ln -s /etc/nginx/sites-available/chat-proxy /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# 6. 启用 TCP BBR
echo "net.core.default_qdisc=fq" >> /etc/sysctl.conf
echo "net.ipv4.tcp_congestion_control=bbr" >> /etc/sysctl.conf
sysctl -p
```

### 6. 修改前端配置

在部署前，修改以下文件中的域名：

**client/src/utils/request.ts:**
```typescript
const BASE_URL = import.meta.env.DEV ? '' : 'https://chat.yourdomain.com'
const CDN_BASE_URL = import.meta.env.DEV ? '' : 'https://cdn.yourdomain.com'
```

**client/src/store/socket.ts:**
```typescript
const SOCKET_URL = import.meta.env.DEV ? 'http://localhost:3000' : 'https://chat.yourdomain.com'
```

### 7. 构建部署前端

```bash
cd chat-app/client
npm run build:h5

# 上传到日本服务器
scp -r dist/build/h5/* root@YOUR_JAPAN_SERVER_IP:/opt/chat-app/client/dist/build/h5/
```

## 验证测试

```bash
# 从中国测试延迟
ping chat.yourdomain.com
ping cdn.yourdomain.com

# 测试 API
curl https://chat.yourdomain.com/health

# 测试 WebSocket（需要安装 wscat）
npm install -g wscat
wscat -c wss://chat.yourdomain.com/socket.io/?transport=websocket
```

## 常用命令

```bash
# 查看服务状态
docker-compose -f docker-compose.prod.yml ps

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f server

# 重启服务
docker-compose -f docker-compose.prod.yml restart server

# 更新部署
git pull
docker-compose -f docker-compose.prod.yml up -d --build server
```

## 故障排查

1. **WebSocket 连接失败**
   - 检查香港 Nginx 配置中的 WebSocket 代理设置
   - 确认 Cloudflare 的 `chat` 子域名代理已关闭

2. **静态资源加载慢**
   - 检查 Cloudflare CDN 缓存规则
   - 确认 `cdn` 子域名代理已开启

3. **API 请求超时**
   - 检查日本服务器 Docker 容器状态
   - 查看 Nginx 错误日志：`/var/log/nginx/chat-*-error.log`
