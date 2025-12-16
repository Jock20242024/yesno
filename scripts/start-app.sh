#!/bin/bash

# 启动 Next.js 应用脚本
# 使用方法: ./scripts/start-app.sh

set -e

echo "=== 启动 Next.js 应用 ==="
echo ""

# 检查 DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "设置 DATABASE_URL 环境变量..."
    export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/yesno_db?schema=public"
fi

echo "DATABASE_URL: $DATABASE_URL"
echo ""

# 检查 node_modules
if [ ! -d "node_modules" ]; then
    echo "⚠️  node_modules 不存在，正在安装依赖..."
    npm install
fi

# 启动开发服务器
echo "启动 Next.js 开发服务器..."
echo ""
npm run dev

