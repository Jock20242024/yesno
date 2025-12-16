#!/bin/bash
echo "检查数据库连接..."
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/yesno_db?schema=public"
if npx prisma db pull --schema=prisma/schema.prisma 2>&1 | grep -q "Introspecting"; then
    echo "✅ 数据库连接成功"
    exit 0
else
    echo "❌ 数据库连接失败"
    echo "请确保："
    echo "1. PostgreSQL 服务正在运行"
    echo "2. DATABASE_URL 配置正确"
    echo "3. 数据库 'yesno_db' 已创建"
    exit 1
fi
