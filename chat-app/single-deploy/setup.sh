#!/bin/bash

#======================================
# 服务器初始化脚本
# 适用于 Ubuntu 20.04/22.04
#======================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否以 root 运行
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "请使用 root 用户运行此脚本: sudo bash setup.sh"
        exit 1
    fi
}

# 更新系统
update_system() {
    log_info "更新系统包..."
    apt update && apt upgrade -y
    apt install -y curl wget git vim unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release
}

# 安装 Docker
install_docker() {
    if command -v docker &> /dev/null; then
        log_info "Docker 已安装，跳过..."
        docker --version
        return
    fi

    log_info "安装 Docker..."

    # 添加 Docker 官方 GPG 密钥
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    # 设置 Docker 仓库
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    # 安装 Docker
    apt update
    apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # 启动 Docker
    systemctl enable docker
    systemctl start docker

    log_info "Docker 安装完成"
    docker --version
    docker compose version
}

# 安装 Nginx
install_nginx() {
    if command -v nginx &> /dev/null; then
        log_info "Nginx 已安装，跳过..."
        nginx -v
        return
    fi

    log_info "安装 Nginx..."
    apt install -y nginx

    # 启动 Nginx
    systemctl enable nginx
    systemctl start nginx

    log_info "Nginx 安装完成"
    nginx -v
}

# 安装 Certbot
install_certbot() {
    if command -v certbot &> /dev/null; then
        log_info "Certbot 已安装，跳过..."
        certbot --version
        return
    fi

    log_info "安装 Certbot..."
    apt install -y certbot python3-certbot-nginx

    log_info "Certbot 安装完成"
    certbot --version
}

# 配置防火墙
configure_firewall() {
    log_info "配置防火墙..."

    # 允许 SSH
    ufw allow 22/tcp

    # 允许 HTTP
    ufw allow 80/tcp

    # 允许 HTTPS
    ufw allow 443/tcp

    # 启用防火墙（非交互式）
    echo "y" | ufw enable

    log_info "防火墙配置完成"
    ufw status
}

# 启用 TCP BBR
enable_bbr() {
    log_info "启用 TCP BBR 网络优化..."

    # 检查是否已启用
    if sysctl net.ipv4.tcp_congestion_control | grep -q bbr; then
        log_info "TCP BBR 已启用，跳过..."
        return
    fi

    # 添加 BBR 配置
    cat >> /etc/sysctl.conf << EOF

# TCP BBR 网络优化
net.core.default_qdisc=fq
net.ipv4.tcp_congestion_control=bbr
EOF

    # 应用配置
    sysctl -p

    log_info "TCP BBR 已启用"
}

# 创建部署目录
create_directories() {
    log_info "创建部署目录..."

    mkdir -p /opt/chat-app
    mkdir -p /opt/chat-app/backups/mysql
    mkdir -p /opt/chat-app/backups/uploads
    mkdir -p /var/www/certbot

    log_info "目录创建完成"
    ls -la /opt/chat-app
}

# 配置系统限制
configure_limits() {
    log_info "配置系统限制..."

    # 增加文件描述符限制
    cat >> /etc/security/limits.conf << EOF

# 增加文件描述符限制（用于高并发）
* soft nofile 65535
* hard nofile 65535
root soft nofile 65535
root hard nofile 65535
EOF

    # 增加 systemd 限制
    mkdir -p /etc/systemd/system.conf.d
    cat > /etc/systemd/system.conf.d/limits.conf << EOF
[Manager]
DefaultLimitNOFILE=65535
EOF

    log_info "系统限制配置完成"
}

# 主函数
main() {
    echo "========================================"
    echo "  聊天应用服务器初始化脚本"
    echo "  适用于 Ubuntu 20.04/22.04"
    echo "========================================"
    echo ""

    check_root

    log_info "开始服务器初始化..."

    update_system
    install_docker
    install_nginx
    install_certbot
    configure_firewall
    enable_bbr
    create_directories
    configure_limits

    echo ""
    echo "========================================"
    log_info "服务器初始化完成！"
    echo "========================================"
    echo ""
    echo "下一步操作："
    echo "1. 将项目代码克隆到 /opt/chat-app/"
    echo "2. 配置 .env 环境变量"
    echo "3. 运行 ssl-setup.sh 申请 SSL 证书"
    echo "4. 运行 deploy.sh --init 部署应用"
    echo ""
}

main "$@"
