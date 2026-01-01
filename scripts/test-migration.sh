#!/bin/bash

# 测试数据库迁移脚本
# 用途: 在测试环境测试数据库迁移

set -e

echo "=========================================="
echo "测试数据库迁移脚本"
echo "=========================================="
echo ""

# 检查环境变量
if [ -z "$DATABASE_URL" ]; then
    if [ -f ".env.local" ]; then
        export $(grep -v '^#' .env.local | grep DATABASE_URL | xargs)
    elif [ -f ".env" ]; then
        export $(grep -v '^#' .env | grep DATABASE_URL | xargs)
    fi
fi

if [ -z "$DATABASE_URL" ]; then
    echo "❌ 错误: DATABASE_URL 未设置"
    echo "请设置 DATABASE_URL 环境变量或在 .env 文件中配置"
    exit 1
fi

echo "数据库 URL: ${DATABASE_URL//:*/:***}"
echo ""

# 步骤 1: 检查当前迁移状态
echo "步骤 1: 检查当前迁移状态..."
if npx prisma migrate status; then
    echo "✅ 迁移状态检查完成"
else
    echo "⚠️  警告: 无法检查迁移状态"
fi
echo ""

# 步骤 2: 运行迁移（开发模式，允许修改）
echo "步骤 2: 运行迁移（测试模式）..."
read -p "是否运行迁移? (yes/no): " -n 3 -r
echo
if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    if npx prisma migrate dev; then
        echo "✅ 迁移完成"
    else
        echo "❌ 迁移失败"
        exit 1
    fi
else
    echo "⏭️  跳过迁移"
fi
echo ""

# 步骤 3: 生成 Prisma Client
echo "步骤 3: 生成 Prisma Client..."
if npx prisma generate; then
    echo "✅ Prisma Client 生成完成"
else
    echo "❌ Prisma Client 生成失败"
    exit 1
fi
echo ""

# 步骤 4: 验证数据库连接
echo "步骤 4: 验证数据库连接..."
if npx prisma db execute --stdin <<< "SELECT version();" 2>/dev/null; then
    echo "✅ 数据库连接正常"
else
    echo "⚠️  警告: 无法验证数据库连接"
fi
echo ""

echo "=========================================="
echo "测试完成"
echo "=========================================="
echo ""
echo "如果所有步骤都成功，可以在生产环境执行相同的迁移"
echo ""

