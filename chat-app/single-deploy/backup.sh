#!/bin/bash

#======================================
# 备份脚本
# MySQL 数据库 + 上传文件备份
#======================================

set -e

# 配置
DEPLOY_DIR="/opt/LT"
CHAT_APP_DIR="$DEPLOY_DIR/chat-app"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$DEPLOY_DIR/backups"
RETENTION_DAYS=7

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

# 显示帮助
show_help() {
    echo "用法: bash backup.sh [选项]"
    echo ""
    echo "选项:"
    echo "  --all           备份所有（数据库 + 上传文件）"
    echo "  --mysql         仅备份 MySQL 数据库"
    echo "  --uploads       仅备份上传文件"
    echo "  --list          列出现有备份"
    echo "  --restore       恢复备份（交互式）"
    echo "  --clean         清理旧备份"
    echo "  -h, --help      显示帮助"
    echo ""
    echo "示例:"
    echo "  bash backup.sh --all          # 完整备份"
    echo "  bash backup.sh --mysql        # 仅备份数据库"
    echo ""
    echo "定时备份（每天凌晨 3 点）:"
    echo "  crontab -e"
    echo "  0 3 * * * /opt/LT/chat-app/single-deploy/backup.sh --all >> /var/log/chat-backup.log 2>&1"
}

# 加载环境变量
load_env() {
    local env_file="$SCRIPT_DIR/.env"
    if [ -f "$env_file" ]; then
        export $(grep -v '^#' "$env_file" | xargs)
    else
        log_error ".env 文件不存在: $env_file"
        exit 1
    fi
}

# 创建备份目录
ensure_backup_dirs() {
    mkdir -p "$BACKUP_DIR/mysql"
    mkdir -p "$BACKUP_DIR/uploads"
}

# 备份 MySQL
backup_mysql() {
    log_info "开始备份 MySQL 数据库..."

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/mysql/chat_app_$timestamp.sql"

    # 使用 docker exec 执行 mysqldump
    docker exec chat-mysql mysqldump \
        -u"$DB_USER" \
        -p"$DB_PASSWORD" \
        --single-transaction \
        --routines \
        --triggers \
        chat_app > "$backup_file"

    if [ $? -eq 0 ]; then
        # 压缩备份文件
        gzip "$backup_file"
        local size=$(du -h "$backup_file.gz" | cut -f1)
        log_info "MySQL 备份完成: $backup_file.gz ($size)"
    else
        log_error "MySQL 备份失败"
        rm -f "$backup_file"
        return 1
    fi
}

# 备份上传文件
backup_uploads() {
    log_info "开始备份上传文件..."

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/uploads/uploads_$timestamp.tar.gz"
    local uploads_dir="$CHAT_APP_DIR/server/uploads"

    if [ ! -d "$uploads_dir" ]; then
        log_warn "上传目录不存在: $uploads_dir"
        return 0
    fi

    # 检查是否有文件需要备份
    if [ -z "$(ls -A $uploads_dir 2>/dev/null)" ]; then
        log_warn "上传目录为空，跳过备份"
        return 0
    fi

    # 创建压缩包
    tar -czf "$backup_file" -C "$CHAT_APP_DIR/server" uploads/

    if [ $? -eq 0 ]; then
        local size=$(du -h "$backup_file" | cut -f1)
        log_info "上传文件备份完成: $backup_file ($size)"
    else
        log_error "上传文件备份失败"
        rm -f "$backup_file"
        return 1
    fi
}

# 清理旧备份
clean_old_backups() {
    log_info "清理 $RETENTION_DAYS 天前的旧备份..."

    local mysql_count=$(find "$BACKUP_DIR/mysql" -name "*.gz" -mtime +$RETENTION_DAYS 2>/dev/null | wc -l)
    local uploads_count=$(find "$BACKUP_DIR/uploads" -name "*.tar.gz" -mtime +$RETENTION_DAYS 2>/dev/null | wc -l)

    # 清理 MySQL 备份
    find "$BACKUP_DIR/mysql" -name "*.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null

    # 清理上传文件备份
    find "$BACKUP_DIR/uploads" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null

    log_info "已清理 MySQL 备份: $mysql_count 个"
    log_info "已清理上传文件备份: $uploads_count 个"
}

# 列出备份
list_backups() {
    echo "========================================"
    echo "  现有备份列表"
    echo "========================================"
    echo ""

    echo "=== MySQL 备份 ==="
    if [ -d "$BACKUP_DIR/mysql" ]; then
        ls -lh "$BACKUP_DIR/mysql"/*.gz 2>/dev/null || echo "  (无备份)"
    fi

    echo ""
    echo "=== 上传文件备份 ==="
    if [ -d "$BACKUP_DIR/uploads" ]; then
        ls -lh "$BACKUP_DIR/uploads"/*.tar.gz 2>/dev/null || echo "  (无备份)"
    fi

    echo ""
    echo "=== 磁盘使用 ==="
    du -sh "$BACKUP_DIR"/* 2>/dev/null || echo "  (无数据)"
}

# 恢复备份
restore_backup() {
    echo "========================================"
    echo "  恢复备份"
    echo "========================================"
    echo ""

    log_warn "恢复操作将覆盖现有数据！"
    read -p "是否继续？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 0
    fi

    echo ""
    echo "选择恢复类型:"
    echo "  1) MySQL 数据库"
    echo "  2) 上传文件"
    read -p "请输入选项 (1/2): " choice

    case $choice in
        1)
            restore_mysql
            ;;
        2)
            restore_uploads
            ;;
        *)
            log_error "无效选项"
            exit 1
            ;;
    esac
}

# 恢复 MySQL
restore_mysql() {
    echo ""
    echo "可用的 MySQL 备份:"
    ls -1 "$BACKUP_DIR/mysql"/*.gz 2>/dev/null | nl
    echo ""

    read -p "请输入要恢复的备份序号: " num
    local backup_file=$(ls -1 "$BACKUP_DIR/mysql"/*.gz 2>/dev/null | sed -n "${num}p")

    if [ -z "$backup_file" ] || [ ! -f "$backup_file" ]; then
        log_error "无效的备份文件"
        exit 1
    fi

    log_info "恢复备份: $backup_file"

    # 解压并恢复
    gunzip -c "$backup_file" | docker exec -i chat-mysql mysql \
        -u"$DB_USER" \
        -p"$DB_PASSWORD" \
        chat_app

    if [ $? -eq 0 ]; then
        log_info "MySQL 恢复完成"
    else
        log_error "MySQL 恢复失败"
        exit 1
    fi
}

# 恢复上传文件
restore_uploads() {
    echo ""
    echo "可用的上传文件备份:"
    ls -1 "$BACKUP_DIR/uploads"/*.tar.gz 2>/dev/null | nl
    echo ""

    read -p "请输入要恢复的备份序号: " num
    local backup_file=$(ls -1 "$BACKUP_DIR/uploads"/*.tar.gz 2>/dev/null | sed -n "${num}p")

    if [ -z "$backup_file" ] || [ ! -f "$backup_file" ]; then
        log_error "无效的备份文件"
        exit 1
    fi

    log_info "恢复备份: $backup_file"

    # 备份当前上传目录
    local uploads_dir="$CHAT_APP_DIR/server/uploads"
    if [ -d "$uploads_dir" ]; then
        mv "$uploads_dir" "${uploads_dir}_old_$(date +%Y%m%d_%H%M%S)"
    fi

    # 恢复
    tar -xzf "$backup_file" -C "$CHAT_APP_DIR/server/"

    if [ $? -eq 0 ]; then
        log_info "上传文件恢复完成"
    else
        log_error "上传文件恢复失败"
        exit 1
    fi
}

# 完整备份
backup_all() {
    log_info "开始完整备份..."

    ensure_backup_dirs
    backup_mysql
    backup_uploads
    clean_old_backups

    echo ""
    log_info "完整备份完成"
    list_backups
}

# 主函数
main() {
    case "$1" in
        --all)
            load_env
            backup_all
            ;;
        --mysql)
            load_env
            ensure_backup_dirs
            backup_mysql
            ;;
        --uploads)
            load_env
            ensure_backup_dirs
            backup_uploads
            ;;
        --list)
            list_backups
            ;;
        --restore)
            load_env
            restore_backup
            ;;
        --clean)
            clean_old_backups
            ;;
        -h|--help)
            show_help
            ;;
        *)
            # 默认执行完整备份（用于 cron）
            if [ -z "$1" ]; then
                load_env
                backup_all
            else
                log_error "未知选项: $1"
                show_help
                exit 1
            fi
            ;;
    esac
}

main "$@"
