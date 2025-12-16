#!/bin/bash

# 完整的功能验证脚本
# 使用方法: ./scripts/verify-all.sh

set -e

echo "=== 预测市场应用 - 完整功能验证 ==="
echo ""

# 检查 DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/yesno_db?schema=public"
fi

echo "DATABASE_URL: $DATABASE_URL"
echo ""

# 步骤 1: 检查数据库连接
echo "=== 步骤 1: 检查数据库连接 ==="
if command -v psql &> /dev/null; then
    if psql "$DATABASE_URL" -c "SELECT 1" &> /dev/null; then
        echo "✅ 数据库连接正常"
    else
        echo "❌ 数据库连接失败"
        echo "请先启动 PostgreSQL 数据库"
        exit 1
    fi
else
    echo "⚠️  psql 未安装，跳过数据库连接检查"
fi

echo ""

# 步骤 2: 检查 Prisma Schema
echo "=== 步骤 2: 检查 Prisma Schema ==="
if [ -f "prisma/schema.prisma" ]; then
    echo "✅ Prisma Schema 文件存在"
else
    echo "❌ Prisma Schema 文件不存在"
    exit 1
fi

echo ""

# 步骤 3: 检查数据库表
echo "=== 步骤 3: 检查数据库表 ==="
if command -v psql &> /dev/null; then
    TABLES=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'markets', 'orders', 'deposits', 'withdrawals');" 2>/dev/null | xargs)
    if [ "$TABLES" = "5" ]; then
        echo "✅ 所有必需的表已创建（users, markets, orders, deposits, withdrawals）"
    else
        echo "⚠️  部分表可能未创建（找到 $TABLES/5 个表）"
        echo "请运行: npx prisma migrate dev --name init_base_schema"
    fi
else
    echo "⚠️  psql 未安装，跳过表检查"
fi

echo ""

# 步骤 4: 检查 API 路由文件
echo "=== 步骤 4: 检查 API 路由文件 ==="
API_FILES=(
    "app/api/admin/auth/login/route.ts"
    "app/api/auth/register/route.ts"
    "app/api/deposit/route.ts"
    "app/api/orders/route.ts"
    "app/api/withdraw/route.ts"
    "app/api/admin/markets/[market_id]/settle/route.ts"
    "app/api/admin/withdrawals/route.ts"
)

ALL_EXIST=true
for file in "${API_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file 不存在"
        ALL_EXIST=false
    fi
done

if [ "$ALL_EXIST" = true ]; then
    echo ""
    echo "✅ 所有必需的 API 路由文件都存在"
else
    echo ""
    echo "❌ 部分 API 路由文件缺失"
    exit 1
fi

echo ""

# 步骤 5: 检查关键组件
echo "=== 步骤 5: 检查关键组件 ==="
COMPONENTS=(
    "app/admin/login/page.tsx"
    "app/admin/dashboard/page.tsx"
    "middleware.ts"
    "lib/dbService.ts"
)

ALL_EXIST=true
for file in "${COMPONENTS[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file 不存在"
        ALL_EXIST=false
    fi
done

if [ "$ALL_EXIST" = true ]; then
    echo ""
    echo "✅ 所有关键组件都存在"
else
    echo ""
    echo "❌ 部分关键组件缺失"
    exit 1
fi

echo ""
echo "=== 验证完成 ==="
echo ""
echo "下一步："
echo "1. 确保 PostgreSQL 数据库正在运行"
echo "2. 运行数据库迁移: ./scripts/run-migration.sh"
echo "3. 启动应用: ./scripts/start-app.sh"
echo "4. 在浏览器中访问 http://localhost:3000 进行功能测试"
echo ""
echo "详细的测试步骤请参考: scripts/verify-features.md"

