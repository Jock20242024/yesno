#!/bin/bash
echo "=== 系统环境检查 ==="
echo ""
echo "1. Docker 状态:"
if command -v docker &> /dev/null; then
    docker --version
    docker ps -a | grep yesno-postgres && echo "✅ PostgreSQL 容器存在" || echo "❌ PostgreSQL 容器不存在"
else
    echo "❌ Docker 未安装或不在 PATH 中"
fi

echo ""
echo "2. Node.js 状态:"
if command -v node &> /dev/null; then
    node --version
else
    echo "❌ Node.js 未安装或不在 PATH 中"
fi

echo ""
echo "3. npm 状态:"
if command -v npm &> /dev/null; then
    npm --version
else
    echo "❌ npm 未安装或不在 PATH 中"
fi

echo ""
echo "4. 数据库连接:"
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/yesno_db?schema=public"
if command -v psql &> /dev/null; then
    if psql "$DATABASE_URL" -c "SELECT 1" &> /dev/null; then
        echo "✅ 数据库连接成功"
    else
        echo "❌ 数据库连接失败"
    fi
else
    echo "⚠️  psql 未安装，跳过连接检查"
fi

echo ""
echo "5. 应用状态:"
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Next.js 应用正在运行 (端口 3000)"
else
    echo "❌ Next.js 应用未运行"
fi

echo ""
echo "6. Prisma 文件:"
if [ -f "prisma/schema.prisma" ]; then
    echo "✅ Prisma Schema 存在"
else
    echo "❌ Prisma Schema 不存在"
fi

if [ -d "node_modules/.prisma" ]; then
    echo "✅ Prisma Client 已生成"
else
    echo "⚠️  Prisma Client 未生成（需要运行 npx prisma generate）"
fi
