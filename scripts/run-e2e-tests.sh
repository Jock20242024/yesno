#!/bin/bash

# E2E 功能验证测试脚本
# 此脚本用于验证数据库连接和基本功能

echo "=== 预测市场应用 - E2E 功能验证 ==="
echo ""

# 设置环境变量
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/yesno_db?schema=public"

# 检查数据库连接
echo "1. 检查数据库连接..."
if npx prisma db pull --schema=prisma/schema.prisma 2>&1 | grep -q "Introspecting"; then
    echo "   ✅ 数据库连接成功"
else
    echo "   ❌ 数据库连接失败"
    exit 1
fi

echo ""
echo "2. 检查数据库表结构..."
TABLES=$(psql "$DATABASE_URL" -t -c "SELECT tablename FROM pg_tables WHERE schemaname='public';" 2>/dev/null | tr -d ' ' | grep -v '^$')
if [ -z "$TABLES" ]; then
    echo "   ⚠️  无法读取表结构（可能需要安装 psql）"
else
    echo "   已创建的表："
    echo "$TABLES" | while read table; do
        echo "   - $table"
    done
fi

echo ""
echo "3. 检查 Prisma 客户端..."
if [ -d "node_modules/.prisma/client" ]; then
    echo "   ✅ Prisma 客户端已生成"
else
    echo "   ⚠️  Prisma 客户端未找到，运行生成命令..."
    npx prisma generate
fi

echo ""
echo "=== 验证完成 ==="
echo ""
echo "下一步："
echo "1. 启动 Next.js 开发服务器：npm run dev"
echo "2. 在浏览器中访问：http://localhost:3000"
echo "3. 按照 scripts/verify-features.md 执行功能测试"
echo ""
echo "测试场景："
echo "- Admin 登录：http://localhost:3000/admin/login"
echo "- 用户注册：http://localhost:3000/register"
echo "- 用户充值：http://localhost:3000/profile"
echo "- Admin 创建市场：http://localhost:3000/admin/markets/create"
echo "- Admin 清算市场：http://localhost:3000/admin/dashboard"

