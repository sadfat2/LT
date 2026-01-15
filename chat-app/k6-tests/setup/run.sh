#!/bin/bash
# K6 性能测试 - 服务器端数据准备脚本
#
# 使用方法:
#   chmod +x run.sh
#   ./run.sh

set -e

echo "========================================"
echo "K6 性能测试 - 服务器端数据准备"
echo "========================================"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "错误: 未找到 Node.js，请先安装"
    echo "  Ubuntu: apt install nodejs npm"
    echo "  CentOS: yum install nodejs npm"
    exit 1
fi

echo "Node.js 版本: $(node -v)"

# 安装依赖
echo ""
echo "[1/2] 安装依赖..."
npm install --silent

# 运行创建用户脚本
echo ""
echo "[2/2] 创建测试用户..."
node create-users.js

echo ""
echo "========================================"
echo "完成! 现在可以运行 k6 测试了"
echo "========================================"
