#!/bin/bash

# 数据库设置脚本
# 此脚本帮助设置 PostgreSQL 数据库并运行 Prisma 迁移

echo "=== 预测市场应用 - 数据库设置 ==="
echo ""

# 检查 DATABASE_URL 环境变量
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL 环境变量未设置"
    echo "正在从 .env.local 读取..."
    
    if [ -f ".env.local" ]; then
        export $(cat .env.local | grep DATABASE_URL | xargs)
        echo "✅ 已从 .env.local 加载 DATABASE_URL"
    else
        echo "❌ .env.local 文件不存在"
        echo "请创建 .env.local 文件并添加："
        echo 'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/yesno_db?schema=public"'
        exit 1
    fi
fi

echo ""
echo "数据库连接字符串: $DATABASE_URL"
echo ""

# 检查 PostgreSQL 是否运行
echo "检查 PostgreSQL 服务状态..."
if command -v psql &> /dev/null; then
    if psql -h localhost -p 5432 -U postgres -d postgres -c "SELECT 1" &> /dev/null; then
        echo "✅ PostgreSQL 服务正在运行"
    else
        echo "❌ 无法连接到 PostgreSQL 服务器"
        echo ""
        echo "请执行以下操作之一："
        echo ""
        echo "1. 使用 Docker 启动 PostgreSQL:"
        echo "   docker run --name yesno-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=yesno_db -p 5432:5432 -d postgres:15"
        echo ""
        echo "2. 使用 Homebrew 启动本地 PostgreSQL:"
        echo "   brew services start postgresql@15"
        echo ""
        echo "3. 使用系统服务启动:"
        echo "   sudo service postgresql start"
        echo ""
        exit 1
    fi
else
    echo "⚠️  psql 命令未找到，跳过连接检查"
fi

echo ""
echo "=== 运行 Prisma 迁移 ==="
echo ""

# 运行 Prisma 迁移
npx prisma migrate dev --name init_base_schema

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 数据库迁移成功！"
    echo ""
    echo "=== 生成 Prisma 客户端 ==="
    npx prisma generate
    echo ""
    echo "✅ 所有数据库设置完成！"
else
    echo ""
    echo "❌ 数据库迁移失败"
    exit 1
fi

