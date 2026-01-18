# 域名快速切换方案

## 背景

项目上线后域名可能被恶意举报，需要频繁更换域名。本文档提供两种解决方案：

1. **一键切换脚本** - 快速更换到新域名
2. **多域名并行** - 同时配置多个域名作为备用

---

## 方案一：一键域名切换

### 使用方式

```bash
sudo bash change-domain.sh <新主域名> <新管理后台域名> <邮箱>

# 示例
sudo bash change-domain.sh chat2.example.com admin2.example.com your@email.com
```

### 脚本功能

| 步骤 | 说明 |
|------|------|
| 1. 参数验证 | 检查域名格式、邮箱格式 |
| 2. 配置备份 | 备份 .env、nginx.conf 到 backups/ |
| 3. DNS 检查 | 验证新域名已解析到服务器 |
| 4. 更新 .env | 修改 DOMAIN、ADMIN_DOMAIN、ALLOWED_ORIGINS |
| 5. 申请 SSL | 调用 certbot 为新域名申请证书 |
| 6. 更新 Nginx | 替换 server_name 和证书路径 |
| 7. 重建前端 | 更新前端 .env 并重新构建 |
| 8. 重启服务 | docker-compose restart + nginx reload |
| 9. 验证部署 | 检查服务状态和 HTTPS 访问 |

### 脚本核心逻辑

```bash
#!/bin/bash
set -e

# === 参数 ===
NEW_DOMAIN=$1
NEW_ADMIN_DOMAIN=$2
EMAIL=$3

# === 1. 备份当前配置 ===
backup_dir="backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$backup_dir"
cp .env "$backup_dir/"
cp /etc/nginx/conf.d/chat.conf "$backup_dir/"

# === 2. DNS 检查 ===
SERVER_IP=$(curl -s ifconfig.me)
DOMAIN_IP=$(dig +short $NEW_DOMAIN | tail -1)
if [ "$SERVER_IP" != "$DOMAIN_IP" ]; then
    echo "错误：$NEW_DOMAIN 未解析到本服务器 ($SERVER_IP)"
    echo "当前解析：$DOMAIN_IP"
    exit 1
fi

# === 3. 更新 .env ===
sed -i "s/^DOMAIN=.*/DOMAIN=$NEW_DOMAIN/" .env
sed -i "s/^ADMIN_DOMAIN=.*/ADMIN_DOMAIN=$NEW_ADMIN_DOMAIN/" .env
sed -i "s|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=https://$NEW_DOMAIN,https://$NEW_ADMIN_DOMAIN|" .env

# === 4. 申请 SSL 证书 ===
certbot certonly --nginx \
    -d $NEW_DOMAIN \
    -d $NEW_ADMIN_DOMAIN \
    --email $EMAIL \
    --agree-tos \
    --non-interactive

# === 5. 更新 Nginx 配置 ===
# 主域名
sed -i "s/server_name YOUR_DOMAIN;/server_name $NEW_DOMAIN;/g" /etc/nginx/conf.d/chat.conf
sed -i "s|/etc/letsencrypt/live/YOUR_DOMAIN/|/etc/letsencrypt/live/$NEW_DOMAIN/|g" /etc/nginx/conf.d/chat.conf

# 管理后台域名
sed -i "s/server_name ADMIN_DOMAIN;/server_name $NEW_ADMIN_DOMAIN;/g" /etc/nginx/conf.d/chat.conf
sed -i "s|/etc/letsencrypt/live/ADMIN_DOMAIN/|/etc/letsencrypt/live/$NEW_ADMIN_DOMAIN/|g" /etc/nginx/conf.d/chat.conf

# === 6. 重新生成前端环境配置 ===
cat > /opt/LT/chat-app/client/.env << EOF
VITE_API_URL=https://$NEW_DOMAIN
VITE_SOCKET_URL=https://$NEW_DOMAIN
VITE_CDN_URL=https://$NEW_DOMAIN
EOF

cat > /opt/LT/chat-app/admin/.env << EOF
VITE_API_BASE_URL=https://$NEW_ADMIN_DOMAIN
VITE_CLIENT_URL=https://$NEW_DOMAIN
EOF

# === 7. 重新构建前端 ===
cd /opt/LT/chat-app/client && npm run build:h5
cd /opt/LT/chat-app/admin && npm run build

# === 8. 重启服务 ===
cd /opt/LT/chat-app/single-deploy
docker-compose restart
nginx -t && nginx -s reload

# === 9. 验证 ===
echo "验证新域名..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://$NEW_DOMAIN)
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ 域名切换成功！"
    echo "主域名：https://$NEW_DOMAIN"
    echo "管理后台：https://$NEW_ADMIN_DOMAIN"
else
    echo "⚠️ 访问返回 $HTTP_CODE，请检查配置"
fi
```

---

## 方案二：多域名并行

### 使用方式

```bash
# 添加备用域名
sudo bash manage-domains.sh add backup.example.com

# 移除域名
sudo bash manage-domains.sh remove backup.example.com

# 列出所有域名
sudo bash manage-domains.sh list

# 设置主域名（前端使用的域名）
sudo bash manage-domains.sh set-primary chat2.example.com
```

### 配置说明

在 `.env` 中添加备用域名：

```bash
# 主域名
DOMAIN=chat1.example.com
ADMIN_DOMAIN=admin1.example.com

# 备用域名（逗号分隔）
BACKUP_DOMAINS=chat2.example.com,chat3.example.com
BACKUP_ADMIN_DOMAINS=admin2.example.com

# CORS 需要包含所有域名
ALLOWED_ORIGINS=https://chat1.example.com,https://chat2.example.com,https://chat3.example.com,https://admin1.example.com,https://admin2.example.com
```

### Nginx 多域名配置

```nginx
# 主域名 + 备用域名
server {
    listen 443 ssl http2;
    server_name chat1.example.com chat2.example.com chat3.example.com;

    # 使用主域名的证书（或通配符证书）
    ssl_certificate /etc/letsencrypt/live/chat1.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chat1.example.com/privkey.pem;

    # ... 其他配置不变
}
```

### 多域名 SSL 证书

**方式一：单独申请（推荐）**

每个域名单独申请证书，便于管理：

```bash
certbot certonly --nginx -d chat1.example.com --email your@email.com
certbot certonly --nginx -d chat2.example.com --email your@email.com
```

**方式二：合并申请**

一个证书包含多个域名：

```bash
certbot certonly --nginx \
    -d chat1.example.com \
    -d chat2.example.com \
    -d chat3.example.com \
    --email your@email.com
```

---

## 需要修改的文件清单

更换域名时涉及的所有文件：

| 文件 | 修改内容 |
|------|----------|
| `single-deploy/.env` | DOMAIN、ADMIN_DOMAIN、ALLOWED_ORIGINS |
| `/etc/nginx/conf.d/chat.conf` | server_name、ssl_certificate 路径 |
| `client/.env` | VITE_API_URL、VITE_SOCKET_URL、VITE_CDN_URL |
| `admin/.env` | VITE_API_BASE_URL、VITE_CLIENT_URL |
| SSL 证书 | 需要为新域名申请证书 |

---

## 手动更换域名步骤

如果不使用脚本，手动更换域名步骤：

### 1. 更新 DNS

在域名服务商处添加 A 记录，指向服务器 IP。

### 2. 申请 SSL 证书

```bash
certbot certonly --nginx -d new.example.com -d admin-new.example.com --email your@email.com
```

### 3. 更新 .env

```bash
cd /opt/LT/chat-app/single-deploy
vim .env

# 修改以下内容：
DOMAIN=new.example.com
ADMIN_DOMAIN=admin-new.example.com
ALLOWED_ORIGINS=https://new.example.com,https://admin-new.example.com
```

### 4. 更新 Nginx 配置

```bash
vim /etc/nginx/conf.d/chat.conf

# 替换所有旧域名为新域名
# 替换证书路径
```

### 5. 重建前端

```bash
# 更新前端环境变量
cat > /opt/LT/chat-app/client/.env << EOF
VITE_API_URL=https://new.example.com
VITE_SOCKET_URL=https://new.example.com
VITE_CDN_URL=https://new.example.com
EOF

# 重新构建
cd /opt/LT/chat-app/client && npm run build:h5

# 管理后台
cat > /opt/LT/chat-app/admin/.env << EOF
VITE_API_BASE_URL=https://admin-new.example.com
VITE_CLIENT_URL=https://new.example.com
EOF

cd /opt/LT/chat-app/admin && npm run build
```

### 6. 重启服务

```bash
cd /opt/LT/chat-app/single-deploy
docker-compose restart
nginx -t && nginx -s reload
```

### 7. 验证

```bash
curl -I https://new.example.com
curl -I https://admin-new.example.com
```

---

## 后续优化建议

### 1. 使用 Cloudflare

接入 Cloudflare 可以：
- **隐藏真实 IP** - 防止针对服务器的攻击
- **快速切换域名** - 只需修改 DNS，无需重新部署
- **免费 SSL** - 不用再手动申请 certbot
- **DDoS 防护** - 基础防护免费

### 2. 域名预备池

提前注册多个备用域名，DNS 解析好，需要时直接切换。

### 3. 通配符证书

如果使用同一主域名的多个子域名，可以申请通配符证书：

```bash
certbot certonly --manual --preferred-challenges dns -d "*.example.com" -d "example.com"
```

---

## 预期效果

| 指标 | 手动操作 | 使用脚本 |
|------|----------|----------|
| 更换域名时间 | 30+ 分钟 | 5 分钟 |
| 操作复杂度 | 修改 5+ 文件 | 1 条命令 |
| 出错概率 | 高 | 低 |
| 备用域名支持 | 无 | 支持多个 |
