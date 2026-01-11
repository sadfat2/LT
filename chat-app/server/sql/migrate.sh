#!/bin/bash
#======================================
# 数据库迁移脚本
# 自动检测并执行未应用的迁移
#======================================

# 数据库配置（从环境变量读取）
DB_HOST="${DB_HOST:-mysql}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-root123456}"
DB_NAME="${DB_NAME:-chat_app}"

MIGRATIONS_DIR="/app/sql/migrations"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
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

# MySQL 命令封装
mysql_cmd() {
    mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" "$@" 2>/dev/null
}

# 确保版本表存在
ensure_migrations_table() {
    log_info "检查迁移版本表..."

    local schema_file="$MIGRATIONS_DIR/000_schema_migrations.sql"
    if [ -f "$schema_file" ]; then
        mysql_cmd < "$schema_file"
    else
        mysql_cmd -e "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );"
    fi
}

# 检查迁移是否已应用
is_migration_applied() {
    local version=$1
    local result=$(mysql_cmd -N -e "SELECT 1 FROM schema_migrations WHERE version=$version" 2>/dev/null)
    [ -n "$result" ]
}

# 应用单个迁移
apply_migration() {
    local migration_file=$1
    local filename=$(basename "$migration_file")
    local version=$(echo "$filename" | cut -d'_' -f1)

    # 跳过版本表创建脚本
    if [ "$version" = "000" ]; then
        return 0
    fi

    # 检查是否已应用
    if is_migration_applied "$version"; then
        log_info "跳过已应用的迁移: $filename"
        return 0
    fi

    log_info "应用迁移: $filename"

    # 执行迁移
    if mysql_cmd < "$migration_file"; then
        # 记录迁移版本
        mysql_cmd -e "INSERT INTO schema_migrations (version, name) VALUES ($version, '$filename')"
        log_info "迁移成功: $filename"
    else
        log_error "迁移失败: $filename"
        return 1
    fi
}

# 主函数
main() {
    log_info "开始数据库迁移..."

    # 检查迁移目录
    if [ ! -d "$MIGRATIONS_DIR" ]; then
        log_warn "迁移目录不存在: $MIGRATIONS_DIR"
        exit 0
    fi

    # 确保版本表存在
    ensure_migrations_table

    # 获取所有迁移文件（按版本号排序）
    local migrations=$(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort)

    if [ -z "$migrations" ]; then
        log_info "没有找到迁移文件"
        exit 0
    fi

    # 应用每个迁移
    local applied=0
    for migration in $migrations; do
        if apply_migration "$migration"; then
            applied=$((applied + 1))
        fi
    done

    log_info "数据库迁移完成，共处理 $applied 个迁移文件"
}

main "$@"
