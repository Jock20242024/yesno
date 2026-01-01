#!/bin/bash

# 数据库备份脚本
# 用途: 备份 PostgreSQL 数据库

set -e

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
    echo "请设置 DATABASE_URL 环境变量或在 .env 文件中配置"
    exit 1
fi

# 创建备份目录
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"

# 生成备份文件名
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/yesno_db_backup_${TIMESTAMP}.sql"

echo "=========================================="
echo "数据库备份脚本"
echo "=========================================="
echo ""
echo "数据库 URL: ${DATABASE_URL//:*/:***}"
echo "备份文件: $BACKUP_FILE"
echo ""

# 执行备份
echo "开始备份..."
if pg_dump "$DATABASE_URL" > "$BACKUP_FILE" 2>/dev/null; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✅ 备份成功!"
    echo "备份文件: $BACKUP_FILE"
    echo "备份大小: $BACKUP_SIZE"
    echo ""
    
    # 压缩备份（可选）
    echo "压缩备份文件..."
    gzip -f "$BACKUP_FILE"
    COMPRESSED_SIZE=$(du -h "${BACKUP_FILE}.gz" | cut -f1)
    echo "✅ 压缩完成!"
    echo "压缩后大小: $COMPRESSED_SIZE"
    echo "压缩文件: ${BACKUP_FILE}.gz"
    echo ""
    
    echo "=========================================="
    echo "备份完成"
    echo "=========================================="
    echo ""
    echo "备份文件: ${BACKUP_FILE}.gz"
    echo "备份大小: $COMPRESSED_SIZE"
    echo ""
    echo "⚠️  重要: 请将备份文件存储在安全位置"
    echo ""
else
    echo "❌ 备份失败!"
    echo "请检查:"
    echo "  1. DATABASE_URL 是否正确"
    echo "  2. 数据库是否可访问"
    echo "  3. pg_dump 是否已安装"
    exit 1
fi

