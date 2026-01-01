#!/bin/bash

# 使用 Docker 执行数据库备份
# 用途: 当本地未安装 pg_dump 时使用

set -e

echo "=========================================="
echo "使用 Docker 执行数据库备份"
echo "=========================================="
echo ""

# 检查 Docker 是否安装
if ! command -v docker >/dev/null 2>&1; then
    echo "❌ 错误: Docker 未安装"
    echo ""
    echo "请安装 Docker 或使用其他备份方案:"
    echo "  1. 安装 Docker Desktop: https://www.docker.com/products/docker-desktop"
    echo "  2. 或安装 PostgreSQL 客户端工具"
    echo "  3. 或使用数据库托管服务的备份功能"
    exit 1
fi

# 从环境变量或参数获取数据库 URL
if [ -z "$DATABASE_URL" ]; then
    if [ -f ".env.production" ]; then
        export $(grep -v '^#' .env.production | grep DATABASE_URL | xargs)
    elif [ -f ".env.local" ]; then
        export $(grep -v '^#' .env.local | grep DATABASE_URL | xargs)
    elif [ -f ".env" ]; then
        export $(grep -v '^#' .env | grep DATABASE_URL | xargs)
    fi
fi

if [ -z "$DATABASE_URL" ]; then
    echo "❌ 错误: DATABASE_URL 未设置"
    echo "请设置 DATABASE_URL 环境变量或在 .env.production 文件中配置"
    exit 1
fi

# 创建备份目录
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"

# 生成备份文件名
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/yesno_db_backup_${TIMESTAMP}.sql.gz"

echo "数据库: ${DATABASE_URL//:*/:***}"
echo "备份文件: $BACKUP_FILE"
echo ""

# 使用 Docker 执行备份
echo "开始备份（使用 Docker）..."
if docker run --rm postgres:15-alpine pg_dump "$DATABASE_URL" 2>/dev/null | gzip > "$BACKUP_FILE"; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✅ 备份成功!"
    echo "备份文件: $BACKUP_FILE"
    echo "备份大小: $BACKUP_SIZE"
    echo ""
    
    echo "=========================================="
    echo "备份完成"
    echo "=========================================="
    echo ""
    echo "备份文件: $BACKUP_FILE"
    echo "备份大小: $BACKUP_SIZE"
    echo ""
    echo "⚠️  重要: 请将备份文件存储在安全位置"
    echo ""
else
    echo "❌ 备份失败!"
    echo "请检查:"
    echo "  1. DATABASE_URL 是否正确"
    echo "  2. 数据库是否可访问"
    echo "  3. Docker 是否正常运行"
    exit 1
fi

