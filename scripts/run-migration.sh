#!/bin/bash

# 数据库迁移脚本
# 使用方法: ./scripts/run-migration.sh

set -e

echo "=== 数据库迁移脚本 ==="
echo ""

# 检查 DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "设置 DATABASE_URL 环境变量..."
    export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/yesno_db?schema=public"
    echo "✅ DATABASE_URL=$DATABASE_URL"
else
    echo "使用现有的 DATABASE_URL"
fi

echo ""
echo "=== 检查 PostgreSQL 连接 ==="
echo ""

# 检查 PostgreSQL 是否可用
if command -v psql &> /dev/null; then
    echo "尝试连接数据库..."
    if psql "$DATABASE_URL" -c "SELECT 1" &> /dev/null; then
        echo "✅ 数据库连接成功"
    else
        echo "❌ 数据库连接失败"
        echo ""
        echo "请确保："
        echo "1. PostgreSQL 服务正在运行"
        echo "2. 数据库 'yesno_db' 已创建"
        echo "3. 用户名和密码正确"
        exit 1
    fi
else
    echo "⚠️  psql 命令未找到，跳过连接检查"
fi

echo ""
echo "=== 运行 Prisma 迁移 ==="
echo ""

# 运行迁移
if command -v npx &> /dev/null; then
    npx prisma migrate dev --name init_base_schema
    echo ""
    echo "✅ 迁移完成"
    
    echo ""
    echo "=== 生成 Prisma 客户端 ==="
    npx prisma generate
    echo "✅ Prisma 客户端已生成"
else
    echo "❌ npx 命令未找到"
    echo "请确保 Node.js 和 npm 已正确安装"
    exit 1
fi

echo ""
echo "=== 迁移完成 ==="

