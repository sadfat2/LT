#!/bin/bash

#======================================
# 部署脚本
# 支持首次部署和更新部署
#======================================

set -e

# 配置
# 项目根目录（整个 LT 项目上传到 /opt/LT）
DEPLOY_DIR="/opt/LT"
# chat-app 目录
CHAT_APP_DIR="$DEPLOY_DIR/chat-app"
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
    echo "  --update            更新部署（备份、拉取代码、迁移、重建）"
    echo "  --rollback          回滚到上一个备份"
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
    echo "  sudo bash deploy.sh --rollback    # 回滚部署"
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
    local env_file="$SCRIPT_DIR/.env"
    if [ -f "$env_file" ]; then
        export $(grep -v '^#' "$env_file" | xargs)
        log_info "已加载环境变量"

        # 同步 .env 到 DEPLOY_DIR（Docker Compose 需要）
        if [ -d "$DEPLOY_DIR" ] && [ "$env_file" != "$DEPLOY_DIR/.env" ]; then
            cp "$env_file" "$DEPLOY_DIR/.env"
        fi
    else
        log_error ".env 文件不存在: $env_file"
        log_error "请先复制 .env.example 并配置"
        exit 1
    fi
}

# 交互式配置
interactive_config() {
    log_step "配置部署参数..."

    # 主域名
    read -p "请输入主域名 (如 chat.example.com): " DOMAIN
    if [ -z "$DOMAIN" ]; then
        log_error "域名不能为空"
        exit 1
    fi

    # 管理后台域名
    read -p "请输入管理后台域名 (如 admin.example.com): " ADMIN_DOMAIN
    if [ -z "$ADMIN_DOMAIN" ]; then
        log_error "管理后台域名不能为空"
        exit 1
    fi

    # Git 仓库（可选，用于后续更新）
    if [ -d "$CHAT_APP_DIR" ]; then
        log_info "检测到项目已上传到 $CHAT_APP_DIR"
        read -p "请输入 Git 仓库地址（用于后续更新，可留空跳过）: " GIT_REPO
    else
        read -p "请输入 Git 仓库地址: " GIT_REPO
        if [ -z "$GIT_REPO" ]; then
            log_error "Git 仓库地址不能为空（项目目录不存在）"
            exit 1
        fi
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

    # 管理员 JWT 密钥
    ADMIN_JWT_SECRET=$(openssl rand -base64 32)
    log_info "已自动生成管理员 JWT 密钥"

    # 保存配置到 single-deploy 目录
    cat > "$SCRIPT_DIR/.env" << EOF
# 域名配置
DOMAIN=$DOMAIN
ADMIN_DOMAIN=$ADMIN_DOMAIN

# 数据库配置
DB_ROOT_PASSWORD=$DB_ROOT_PASSWORD
DB_USER=chat_user
DB_PASSWORD=$DB_ROOT_PASSWORD
DB_NAME=chat_app

# JWT 密钥
JWT_SECRET=$JWT_SECRET

# 管理员 JWT 密钥
ADMIN_JWT_SECRET=$ADMIN_JWT_SECRET

# CORS 允许的源
ALLOWED_ORIGINS=https://$DOMAIN,https://$ADMIN_DOMAIN

# Node.js 环境
NODE_ENV=production
EOF

    log_info "配置已保存到 $SCRIPT_DIR/.env"

    # 同时生成前端配置
    local frontend_env="$CHAT_APP_DIR/client/.env"
    if [ -d "$CHAT_APP_DIR/client" ]; then
        cat > "$frontend_env" << EOF
# 前端环境配置（由 deploy.sh 自动生成）
VITE_API_URL=https://$DOMAIN
VITE_SOCKET_URL=https://$DOMAIN
VITE_CDN_URL=https://$DOMAIN
EOF
        log_info "前端配置已保存到 $frontend_env"
    fi
}

# 克隆代码（如果项目不存在且提供了 Git 仓库地址）
clone_code() {
    log_step "检查项目代码..."

    if [ -d "$CHAT_APP_DIR" ]; then
        log_info "项目目录已存在: $CHAT_APP_DIR"
        return
    fi

    if [ -z "$GIT_REPO" ]; then
        log_error "项目目录不存在且未提供 Git 仓库地址"
        log_info "请先上传项目到 $CHAT_APP_DIR 或提供 Git 仓库地址"
        exit 1
    fi

    log_step "克隆项目代码..."
    git clone "$GIT_REPO" "$CHAT_APP_DIR"
    log_info "代码克隆完成"
}

# 拉取最新代码
pull_code() {
    log_step "拉取最新代码..."

    cd "$CHAT_APP_DIR"

    # 检查是否是 Git 仓库
    if [ ! -d ".git" ]; then
        log_warn "当前目录不是 Git 仓库，跳过代码拉取"
        log_info "如需更新代码，请手动上传或初始化 Git 仓库"
        return
    fi

    git fetch origin
    git pull origin main || git pull origin master

    log_info "代码更新完成"
}

# 检查并生成前端环境配置
check_frontend_env() {
    log_step "检查前端环境配置..."

    local env_file="$CHAT_APP_DIR/client/.env"

    # 如果不存在，自动从 DOMAIN 生成
    if [ ! -f "$env_file" ]; then
        log_info "自动生成前端环境配置..."
        cat > "$env_file" << EOF
# 前端环境配置（由 deploy.sh 自动生成）
VITE_API_URL=https://$DOMAIN
VITE_SOCKET_URL=https://$DOMAIN
VITE_CDN_URL=https://$DOMAIN
EOF
        log_info "前端环境配置已生成: $env_file"
    else
        # 文件存在，检查域名是否正确
        local current_url=$(grep "VITE_API_URL" "$env_file" | cut -d'=' -f2)
        if [[ "$current_url" != "https://$DOMAIN" ]]; then
            log_warn "前端配置的域名与当前 DOMAIN 不一致"
            log_warn "  当前配置: $current_url"
            log_warn "  期望配置: https://$DOMAIN"
            read -p "是否更新前端配置？(y/n) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                cat > "$env_file" << EOF
# 前端环境配置（由 deploy.sh 自动生成）
VITE_API_URL=https://$DOMAIN
VITE_SOCKET_URL=https://$DOMAIN
VITE_CDN_URL=https://$DOMAIN
EOF
                log_info "前端环境配置已更新"
            fi
        fi
    fi

    log_info "前端环境配置检查通过"
}

# 构建前端
build_frontend() {
    log_step "构建前端 H5..."

    cd "$CHAT_APP_DIR/client"

    # 使用 Docker 构建（避免在服务器安装 Node.js）
    # 使用淘宝 npm 镜像加速
    docker run --rm \
        -v "$CHAT_APP_DIR/client:/app" \
        -w /app \
        node:18-alpine \
        sh -c "npm config set registry https://registry.npmmirror.com && npm install && npm run build:h5"

    if [ $? -eq 0 ]; then
        log_info "前端构建完成"
        log_info "输出目录: $CHAT_APP_DIR/client/dist/build/h5"
    else
        log_error "前端构建失败"
        exit 1
    fi
}

# 构建管理后台前端
build_admin_frontend() {
    log_step "构建管理后台前端..."

    # 检查 admin 目录是否存在
    if [ ! -d "$CHAT_APP_DIR/admin" ]; then
        log_warn "管理后台目录不存在，跳过构建"
        return
    fi

    cd "$CHAT_APP_DIR/admin"

    # 生成管理后台环境配置
    local admin_env="$CHAT_APP_DIR/admin/.env"
    cat > "$admin_env" << EOF
# 管理后台环境配置（由 deploy.sh 自动生成）
VITE_API_BASE_URL=https://$ADMIN_DOMAIN
VITE_CLIENT_URL=https://$DOMAIN
EOF
    log_info "管理后台环境配置已生成: $admin_env"

    # 使用 Docker 构建
    docker run --rm \
        -v "$CHAT_APP_DIR/admin:/app" \
        -w /app \
        -e NODE_ENV=production \
        node:18-alpine \
        sh -c "npm config set registry https://registry.npmmirror.com && npm install && npm run build"

    if [ $? -eq 0 ]; then
        log_info "管理后台前端构建完成"
        log_info "输出目录: $CHAT_APP_DIR/admin/dist"
    else
        log_error "管理后台前端构建失败"
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

    # 复制 .env 文件（Docker Compose 需要在同目录读取）
    if [ -f "$SCRIPT_DIR/.env" ]; then
        cp "$SCRIPT_DIR/.env" "$DEPLOY_DIR/.env"
        log_info ".env 已复制到 $DEPLOY_DIR/"
    fi

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

# 运行数据库迁移
run_migrations() {
    log_step "检查数据库迁移..."

    cd "$DEPLOY_DIR"

    # 等待 MySQL 完全启动
    local max_retries=30
    local retry=0
    while [ $retry -lt $max_retries ]; do
        if docker exec chat-mysql mysqladmin ping -h localhost -u root -p"$DB_ROOT_PASSWORD" --silent 2>/dev/null; then
            break
        fi
        retry=$((retry + 1))
        log_info "等待 MySQL 启动... ($retry/$max_retries)"
        sleep 2
    done

    if [ $retry -eq $max_retries ]; then
        log_error "MySQL 启动超时"
        return 1
    fi

    # 执行迁移脚本（如果存在）
    local migrate_script="$CHAT_APP_DIR/server/sql/migrate.sh"
    if [ -f "$migrate_script" ]; then
        log_info "执行迁移脚本..."
        docker exec chat-server sh /app/sql/migrate.sh 2>/dev/null || true
    fi

    log_info "数据库迁移完成"
}

# 更新前备份
backup_before_update() {
    log_step "更新前备份..."

    local backup_script="$SCRIPT_DIR/backup.sh"
    if [ -f "$backup_script" ]; then
        bash "$backup_script" --all
    else
        log_warn "备份脚本不存在，跳过备份"
    fi
}

# 回滚部署
rollback_deploy() {
    echo "========================================"
    echo "  回滚部署"
    echo "========================================"
    echo ""

    check_root
    load_env

    local backup_dir="$DEPLOY_DIR/backups"

    # 查找最近的数据库备份
    local latest_db=$(ls -t "$backup_dir/mysql/"*.gz 2>/dev/null | head -1)
    local latest_uploads=$(ls -t "$backup_dir/uploads/"*.gz 2>/dev/null | head -1)

    if [ -z "$latest_db" ]; then
        log_error "未找到数据库备份"
        log_info "备份目录: $backup_dir/mysql/"
        exit 1
    fi

    log_info "找到数据库备份: $latest_db"
    if [ -n "$latest_uploads" ]; then
        log_info "找到文件备份: $latest_uploads"
    fi

    read -p "确认回滚到此备份？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "已取消回滚"
        exit 0
    fi

    # 恢复数据库
    log_step "恢复数据库..."
    gunzip -c "$latest_db" | docker exec -i chat-mysql mysql -uroot -p"$DB_ROOT_PASSWORD" "$DB_NAME"
    log_info "数据库恢复完成"

    # 恢复上传文件
    if [ -n "$latest_uploads" ]; then
        log_step "恢复上传文件..."
        local uploads_dir="$CHAT_APP_DIR/server/uploads"
        if [ -d "$uploads_dir" ]; then
            mv "$uploads_dir" "${uploads_dir}_rollback_$(date +%s)"
        fi
        tar -xzf "$latest_uploads" -C "$CHAT_APP_DIR/server/"
        log_info "上传文件恢复完成"
    fi

    # 重启服务
    log_step "重启服务..."
    cd "$DEPLOY_DIR"
    docker compose restart server

    log_info "回滚完成！"
}

# 配置 Nginx
configure_nginx() {
    log_step "配置 Nginx..."

    local domain=$DOMAIN
    local admin_domain=$ADMIN_DOMAIN

    # 替换 nginx.conf 中的域名
    sed -i "s/YOUR_DOMAIN/$domain/g" "$DEPLOY_DIR/nginx.conf"
    sed -i "s/ADMIN_DOMAIN/$admin_domain/g" "$DEPLOY_DIR/nginx.conf"

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

    # 检查前端环境配置
    check_frontend_env

    # 复制部署文件
    copy_deploy_files

    # 构建前端
    build_frontend

    # 构建管理后台前端
    build_admin_frontend

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
    echo "访问地址:"
    echo "  聊天应用: https://$DOMAIN"
    echo "  管理后台: https://$ADMIN_DOMAIN"
    echo "  管理员账号: admin / admin123"
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

    # 更新前备份
    backup_before_update

    # 拉取代码
    pull_code

    # 检查前端环境配置
    check_frontend_env

    # 构建前端
    build_frontend

    # 构建管理后台前端
    build_admin_frontend

    # 更新 Docker 服务
    update_docker_services

    # 运行数据库迁移
    run_migrations

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
    check_frontend_env
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
        --rollback)
            rollback_deploy
            ;;
        --frontend-only)
            update_frontend_only
            ;;
        --backend-only)
            update_backend_only
            ;;
        --restart)
            check_root
            load_env
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
