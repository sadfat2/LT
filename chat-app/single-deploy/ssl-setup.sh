#!/bin/bash

#======================================
# SSL 证书申请脚本
# 使用 Let's Encrypt Certbot
# 支持主域名和管理后台子域名
#======================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 显示使用帮助
show_help() {
    echo "用法: sudo bash ssl-setup.sh <主域名> <邮箱> [管理后台域名]"
    echo ""
    echo "参数:"
    echo "  主域名        - 聊天应用域名，如 chat.example.com"
    echo "  邮箱          - Let's Encrypt 通知邮箱"
    echo "  管理后台域名  - 可选，管理后台域名，如 admin.example.com"
    echo ""
    echo "示例:"
    echo "  # 仅申请主域名证书"
    echo "  sudo bash ssl-setup.sh chat.example.com admin@example.com"
    echo ""
    echo "  # 同时申请主域名和管理后台域名证书"
    echo "  sudo bash ssl-setup.sh chat.example.com admin@example.com admin.example.com"
    echo ""
    echo "注意:"
    echo "  1. 域名必须已解析到当前服务器 IP"
    echo "  2. 80 端口必须可访问（防火墙已开放）"
    echo "  3. 需要以 root 用户运行"
}

# 检查是否以 root 运行
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "请使用 root 用户运行此脚本"
        exit 1
    fi
}

# 检查参数
check_args() {
    if [ -z "$1" ] || [ -z "$2" ]; then
        log_error "缺少必要参数"
        echo ""
        show_help
        exit 1
    fi
}

# 检查依赖
check_dependencies() {
    if ! command -v certbot &> /dev/null; then
        log_error "Certbot 未安装，请先运行 setup.sh"
        exit 1
    fi

    if ! command -v nginx &> /dev/null; then
        log_error "Nginx 未安装，请先运行 setup.sh"
        exit 1
    fi
}

# 检查域名解析
check_dns() {
    local domain=$1
    local server_ip=$(curl -s ifconfig.me)
    local domain_ip=$(dig +short "$domain" | tail -1)

    log_info "检查域名解析: $domain"
    log_info "  服务器 IP: $server_ip"
    log_info "  域名解析 IP: $domain_ip"

    if [ "$server_ip" != "$domain_ip" ]; then
        log_warn "域名解析 IP 与服务器 IP 不匹配"
        log_warn "请确保域名 $domain 已正确解析到 $server_ip"
        read -p "是否继续？(y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return 1
        fi
    else
        log_info "  域名解析正确"
    fi
    return 0
}

# 配置临时 Nginx（用于证书验证）
setup_temp_nginx() {
    local domain=$1
    local admin_domain=$2

    log_step "配置临时 Nginx..."

    # 创建临时配置
    cat > /etc/nginx/sites-available/certbot-temp << EOF
server {
    listen 80;
    listen [::]:80;
    server_name $domain;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 444;
    }
}
EOF

    # 如果有管理后台域名，添加配置
    if [ -n "$admin_domain" ]; then
        cat >> /etc/nginx/sites-available/certbot-temp << EOF

server {
    listen 80;
    listen [::]:80;
    server_name $admin_domain;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 444;
    }
}
EOF
    fi

    # 启用配置
    ln -sf /etc/nginx/sites-available/certbot-temp /etc/nginx/sites-enabled/

    # 禁用默认配置（如果存在）
    rm -f /etc/nginx/sites-enabled/default

    # 测试配置
    nginx -t

    # 确保 Nginx 正在运行
    if ! systemctl is-active --quiet nginx; then
        log_info "启动 Nginx 服务..."
        systemctl start nginx
        systemctl enable nginx
    else
        systemctl reload nginx
    fi

    log_info "临时 Nginx 配置完成"
}

# 申请 SSL 证书
request_certificate() {
    local domain=$1
    local email=$2

    log_step "申请 SSL 证书: $domain"

    # 确保 webroot 目录存在
    mkdir -p /var/www/certbot

    # 使用 webroot 模式申请证书
    certbot certonly \
        --webroot \
        -w /var/www/certbot \
        -d "$domain" \
        --email "$email" \
        --agree-tos \
        --no-eff-email \
        --non-interactive

    if [ $? -eq 0 ]; then
        log_info "SSL 证书申请成功: $domain"
        return 0
    else
        log_error "SSL 证书申请失败: $domain"
        return 1
    fi
}

# 验证证书
verify_certificate() {
    local domain=$1

    log_info "验证证书: $domain"

    if [ -f "/etc/letsencrypt/live/$domain/fullchain.pem" ]; then
        log_info "  证书文件存在"
        openssl x509 -in "/etc/letsencrypt/live/$domain/fullchain.pem" -text -noout | grep -A2 "Validity"
        return 0
    else
        log_error "  证书文件不存在"
        return 1
    fi
}

# 配置自动续期
setup_auto_renewal() {
    log_step "配置自动续期..."

    # 检查是否已存在续期任务
    if crontab -l 2>/dev/null | grep -q "certbot renew"; then
        log_info "自动续期任务已存在"
        return
    fi

    # 添加续期任务（每天凌晨 3 点检查）
    (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook \"systemctl reload nginx\"") | crontab -

    log_info "自动续期任务已添加"
    log_info "证书将在到期前自动续期"
}

# 清理临时配置
cleanup_temp_nginx() {
    log_info "清理临时 Nginx 配置..."
    rm -f /etc/nginx/sites-enabled/certbot-temp
    rm -f /etc/nginx/sites-available/certbot-temp
}

# 主函数
main() {
    local domain=$1
    local email=$2
    local admin_domain=$3

    echo "========================================"
    echo "  SSL 证书申请脚本"
    echo "  使用 Let's Encrypt"
    echo "========================================"
    echo ""

    check_root
    check_args "$domain" "$email"
    check_dependencies

    log_info "主域名: $domain"
    log_info "邮箱: $email"
    if [ -n "$admin_domain" ]; then
        log_info "管理后台域名: $admin_domain"
    fi
    echo ""

    # 检查域名解析
    log_step "检查域名解析..."
    check_dns "$domain" || exit 1

    if [ -n "$admin_domain" ]; then
        check_dns "$admin_domain" || exit 1
    fi

    # 配置临时 Nginx
    setup_temp_nginx "$domain" "$admin_domain"

    # 申请主域名证书
    request_certificate "$domain" "$email" || exit 1
    verify_certificate "$domain" || exit 1

    # 申请管理后台域名证书
    if [ -n "$admin_domain" ]; then
        request_certificate "$admin_domain" "$email" || exit 1
        verify_certificate "$admin_domain" || exit 1
    fi

    # 配置自动续期
    setup_auto_renewal

    # 清理临时配置
    cleanup_temp_nginx

    echo ""
    echo "========================================"
    log_info "SSL 证书配置完成！"
    echo "========================================"
    echo ""
    echo "证书路径:"
    echo "  主域名证书: /etc/letsencrypt/live/$domain/fullchain.pem"
    echo "  主域名私钥: /etc/letsencrypt/live/$domain/privkey.pem"
    if [ -n "$admin_domain" ]; then
        echo "  管理后台证书: /etc/letsencrypt/live/$admin_domain/fullchain.pem"
        echo "  管理后台私钥: /etc/letsencrypt/live/$admin_domain/privkey.pem"
    fi
    echo ""
    echo "下一步操作:"
    echo "  运行 deploy.sh --init 部署应用"
    echo ""
}

# 处理帮助参数
if [ "$1" == "-h" ] || [ "$1" == "--help" ]; then
    show_help
    exit 0
fi

main "$@"
