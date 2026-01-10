#!/bin/bash

#======================================
# 部署脚本
# 支持首次部署和更新部署
#======================================

set -e

# 配置
DEPLOY_DIR="/opt/chat-app"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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
    echo "用法: sudo bash deploy.sh [选项]"
    echo ""
    echo "选项:"
    echo "  --init              首次部署（克隆代码、构建、启动）"
    echo "  --update            更新部署（拉取代码、重新构建）"
    echo "  --frontend-only     仅更新前端"
    echo "  --backend-only      仅更新后端"
    echo "  --restart           重启所有服务"
    echo "  --status            查看服务状态"
    echo "  --logs              查看后端日志"
    echo "  -h, --help          显示帮助"
    echo ""
    echo "示例:"
    echo "  sudo bash deploy.sh --init        # 首次部署"
    echo "  sudo bash deploy.sh --update      # 更新部署"
}

# 检查是否以 root 运行
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "请使用 root 用户运行此脚本"
        exit 1
    fi
}

# 检查依赖
check_dependencies() {
    local missing=()

    command -v docker &> /dev/null || missing+=("docker")
    command -v nginx &> /dev/null || missing+=("nginx")
    command -v git &> /dev/null || missing+=("git")

    if [ ${#missing[@]} -ne 0 ]; then
        log_error "缺少依赖: ${missing[*]}"
        log_error "请先运行 setup.sh"
        exit 1
    fi
}

# 加载环境变量
load_env() {
    if [ -f "$DEPLOY_DIR/.env" ]; then
        export $(grep -v '^#' "$DEPLOY_DIR/.env" | xargs)
        log_info "已加载环境变量"
    else
        log_error ".env 文件不存在: $DEPLOY_DIR/.env"
        log_error "请先复制 .env.example 并配置"
        exit 1
    fi
}

# 交互式配置
interactive_config() {
    log_step "配置部署参数..."

    # 域名
    read -p "请输入域名 (如 chat.example.com): " DOMAIN
    if [ -z "$DOMAIN" ]; then
        log_error "域名不能为空"
        exit 1
    fi

    # Git 仓库
    read -p "请输入 Git 仓库地址: " GIT_REPO
    if [ -z "$GIT_REPO" ]; then
        log_error "Git 仓库地址不能为空"
        exit 1
    fi

    # 数据库密码
    read -s -p "请输入数据库 root 密码: " DB_ROOT_PASSWORD
    echo
    if [ -z "$DB_ROOT_PASSWORD" ]; then
        DB_ROOT_PASSWORD=$(openssl rand -base64 16)
        log_info "已自动生成数据库密码"
    fi

    # JWT 密钥
    JWT_SECRET=$(openssl rand -base64 32)
    log_info "已自动生成 JWT 密钥"

    # 保存配置
    cat > "$DEPLOY_DIR/.env" << EOF
# 域名配置
DOMAIN=$DOMAIN

# 数据库配置
DB_ROOT_PASSWORD=$DB_ROOT_PASSWORD
DB_USER=chat_user
DB_PASSWORD=$DB_ROOT_PASSWORD
DB_NAME=chat_app

# JWT 密钥
JWT_SECRET=$JWT_SECRET

# CORS 允许的源
ALLOWED_ORIGINS=https://$DOMAIN

# Node.js 环境
NODE_ENV=production
EOF

    log_info "配置已保存到 $DEPLOY_DIR/.env"
}

# 克隆代码
clone_code() {
    log_step "克隆项目代码..."

    if [ -d "$DEPLOY_DIR/chat-app" ]; then
        log_warn "项目目录已存在，跳过克隆"
        return
    fi

    git clone "$GIT_REPO" "$DEPLOY_DIR/chat-app"
    log_info "代码克隆完成"
}

# 拉取最新代码
pull_code() {
    log_step "拉取最新代码..."

    cd "$DEPLOY_DIR/chat-app"
    git fetch origin
    git pull origin main || git pull origin master

    log_info "代码更新完成"
}

# 更新前端域名配置
update_frontend_config() {
    local domain=$1
    log_step "更新前端配置..."

    # 更新 request.ts
    local request_file="$DEPLOY_DIR/chat-app/client/src/utils/request.ts"
    if [ -f "$request_file" ]; then
        sed -i "s|https://chat.yourdomain.com|https://$domain|g" "$request_file"
        sed -i "s|https://cdn.yourdomain.com|https://$domain|g" "$request_file"
        log_info "已更新 request.ts"
    fi

    # 更新 socket.ts
    local socket_file="$DEPLOY_DIR/chat-app/client/src/store/socket.ts"
    if [ -f "$socket_file" ]; then
        sed -i "s|https://chat.yourdomain.com|https://$domain|g" "$socket_file"
        log_info "已更新 socket.ts"
    fi
}

# 构建前端
build_frontend() {
    log_step "构建前端 H5..."

    cd "$DEPLOY_DIR/chat-app/client"

    # 使用 Docker 构建（避免在服务器安装 Node.js）
    docker run --rm \
        -v "$DEPLOY_DIR/chat-app/client:/app" \
        -w /app \
        node:18-alpine \
        sh -c "npm install && npm run build:h5"

    if [ $? -eq 0 ]; then
        log_info "前端构建完成"
        log_info "输出目录: $DEPLOY_DIR/chat-app/client/dist/build/h5"
    else
        log_error "前端构建失败"
        exit 1
    fi
}

# 复制部署文件
copy_deploy_files() {
    log_step "复制部署文件..."

    # 复制 docker-compose.yml
    cp "$SCRIPT_DIR/docker-compose.yml" "$DEPLOY_DIR/"

    # 复制 Dockerfile.server
    cp "$SCRIPT_DIR/Dockerfile.server" "$DEPLOY_DIR/"

    # 复制 nginx.conf
    cp "$SCRIPT_DIR/nginx.conf" "$DEPLOY_DIR/"

    log_info "部署文件复制完成"
}

# 启动 Docker 服务
start_docker_services() {
    log_step "启动 Docker 服务..."

    cd "$DEPLOY_DIR"

    # 构建并启动
    docker compose up -d --build

    # 等待服务健康
    log_info "等待服务启动..."
    sleep 10

    # 检查服务状态
    docker compose ps

    log_info "Docker 服务已启动"
}

# 更新 Docker 服务
update_docker_services() {
    log_step "更新 Docker 服务..."

    cd "$DEPLOY_DIR"

    # 重新构建并启动（零停机）
    docker compose up -d --build

    log_info "Docker 服务已更新"
}

# 配置 Nginx
configure_nginx() {
    log_step "配置 Nginx..."

    local domain=$DOMAIN

    # 替换 nginx.conf 中的域名
    sed -i "s/YOUR_DOMAIN/$domain/g" "$DEPLOY_DIR/nginx.conf"

    # 复制到 Nginx 配置目录
    cp "$DEPLOY_DIR/nginx.conf" "/etc/nginx/sites-available/chat-app"

    # 启用配置
    ln -sf /etc/nginx/sites-available/chat-app /etc/nginx/sites-enabled/

    # 禁用默认配置
    rm -f /etc/nginx/sites-enabled/default

    # 测试配置
    nginx -t

    # 重载 Nginx
    systemctl reload nginx

    log_info "Nginx 配置完成"
}

# 健康检查
health_check() {
    log_step "执行健康检查..."

    local domain=$DOMAIN
    local max_retries=10
    local retry=0

    while [ $retry -lt $max_retries ]; do
        if curl -sf "https://$domain/health" > /dev/null 2>&1; then
            log_info "健康检查通过！"
            return 0
        fi

        retry=$((retry + 1))
        log_warn "健康检查失败，重试 $retry/$max_retries..."
        sleep 5
    done

    log_error "健康检查失败"
    log_warn "请检查服务日志: docker compose logs -f server"
    return 1
}

# 查看状态
show_status() {
    log_step "服务状态"

    cd "$DEPLOY_DIR"

    echo ""
    echo "=== Docker 容器状态 ==="
    docker compose ps

    echo ""
    echo "=== Nginx 状态 ==="
    systemctl status nginx --no-pager -l | head -20

    echo ""
    echo "=== 磁盘使用 ==="
    df -h /opt

    echo ""
    echo "=== 内存使用 ==="
    free -h
}

# 查看日志
show_logs() {
    cd "$DEPLOY_DIR"
    docker compose logs -f server
}

# 重启服务
restart_services() {
    log_step "重启服务..."

    cd "$DEPLOY_DIR"
    docker compose restart

    systemctl reload nginx

    log_info "服务已重启"
}

# 首次部署
init_deploy() {
    echo "========================================"
    echo "  首次部署"
    echo "========================================"
    echo ""

    check_root
    check_dependencies

    # 检查 SSL 证书
    if [ ! -d "/etc/letsencrypt/live" ]; then
        log_warn "未检测到 SSL 证书"
        log_warn "请先运行 ssl-setup.sh 申请证书"
        read -p "是否继续？(y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    # 交互式配置
    interactive_config

    # 加载环境变量
    load_env

    # 克隆代码
    clone_code

    # 更新前端配置
    update_frontend_config "$DOMAIN"

    # 复制部署文件
    copy_deploy_files

    # 构建前端
    build_frontend

    # 启动 Docker 服务
    start_docker_services

    # 配置 Nginx
    configure_nginx

    # 健康检查
    health_check || true

    echo ""
    echo "========================================"
    log_info "部署完成！"
    echo "========================================"
    echo ""
    echo "访问地址: https://$DOMAIN"
    echo ""
    echo "常用命令:"
    echo "  查看状态: bash deploy.sh --status"
    echo "  查看日志: bash deploy.sh --logs"
    echo "  更新部署: bash deploy.sh --update"
    echo ""
}

# 更新部署
update_deploy() {
    echo "========================================"
    echo "  更新部署"
    echo "========================================"
    echo ""

    check_root
    check_dependencies
    load_env

    # 拉取代码
    pull_code

    # 更新前端配置
    update_frontend_config "$DOMAIN"

    # 构建前端
    build_frontend

    # 更新 Docker 服务
    update_docker_services

    # 重载 Nginx
    systemctl reload nginx

    # 健康检查
    health_check || true

    echo ""
    log_info "更新完成！"
}

# 仅更新前端
update_frontend_only() {
    log_step "仅更新前端..."

    check_root
    load_env

    pull_code
    update_frontend_config "$DOMAIN"
    build_frontend

    systemctl reload nginx

    log_info "前端更新完成"
}

# 仅更新后端
update_backend_only() {
    log_step "仅更新后端..."

    check_root
    check_dependencies
    load_env

    pull_code

    cd "$DEPLOY_DIR"
    docker compose up -d --build server

    log_info "后端更新完成"
}

# 主函数
main() {
    case "$1" in
        --init)
            init_deploy
            ;;
        --update)
            update_deploy
            ;;
        --frontend-only)
            update_frontend_only
            ;;
        --backend-only)
            update_backend_only
            ;;
        --restart)
            check_root
            restart_services
            ;;
        --status)
            show_status
            ;;
        --logs)
            show_logs
            ;;
        -h|--help)
            show_help
            ;;
        *)
            log_error "未知选项: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# 检查是否有参数
if [ $# -eq 0 ]; then
    show_help
    exit 1
fi

main "$@"
