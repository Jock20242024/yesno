#!/bin/bash

# 生产环境部署脚本
# 用途: 执行生产环境部署流程

set -e

echo "=========================================="
echo "生产环境部署脚本"
echo "=========================================="
echo ""

# 检查是否在生产环境
if [ "$NODE_ENV" != "production" ]; then
    echo "⚠️  警告: NODE_ENV 不是 'production'"
    read -p "是否继续? (yes/no): " -n 3 -r
    echo
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        exit 1
    fi
fi

# 检查 .env.production 文件
if [ ! -f ".env.production" ]; then
    echo "❌ 错误: .env.production 文件不存在"
    echo "请先创建 .env.production 文件（参考 .env.production.template）"
    exit 1
fi

echo "步骤 1: 加载环境变量..."
export $(grep -v '^#' .env.production | xargs)
echo "✅ 环境变量已加载"
echo ""

# 步骤 2: 备份数据库
echo "步骤 2: 备份数据库..."
if [ -f "scripts/backup-database-docker.sh" ]; then
    bash scripts/backup-database-docker.sh || echo "⚠️  备份失败，但继续部署（已手动备份）"
elif [ -f "scripts/backup-database.sh" ]; then
    bash scripts/backup-database.sh || echo "⚠️  备份失败，但继续部署（已手动备份）"
else
    echo "⚠️  警告: 备份脚本不存在，跳过备份"
    echo "建议手动备份数据库"
fi
echo ""

# 步骤 3: 安装依赖
echo "步骤 3: 安装依赖..."
# 注意：使用 npm install（不添加 --production）以确保 devDependencies（如 TypeScript、ESLint 等）也被安装
# 这些在构建过程中是必需的
npm install
echo "✅ 依赖安装完成"
echo ""

# 步骤 4: 运行数据库迁移
echo "步骤 4: 运行数据库迁移..."
if npx prisma migrate deploy; then
    echo "✅ 数据库迁移完成"
else
    echo "❌ 数据库迁移失败"
    exit 1
fi
echo ""

# 步骤 5: 生成 Prisma Client
echo "步骤 5: 生成 Prisma Client..."
if npx prisma generate; then
    echo "✅ Prisma Client 生成完成"
else
    echo "❌ Prisma Client 生成失败"
    exit 1
fi
echo ""

# 步骤 6: 构建应用
echo "步骤 6: 构建应用..."
if npm run build; then
    echo "✅ 应用构建完成"
else
    echo "❌ 应用构建失败"
    exit 1
fi
echo ""

# 步骤 7: 健康检查（可选）
echo "步骤 7: 健康检查..."
echo "⚠️  注意: 应用已构建完成"
echo "请手动执行以下检查:"
echo "  1. 启动应用: npm start"
echo "  2. 访问首页，验证正常"
echo "  3. 访问 API，验证正常"
echo "  4. 检查日志，无错误"
echo ""

echo "=========================================="
echo "部署准备完成"
echo "=========================================="
echo ""
echo "下一步:"
echo "  1. 启动应用: npm start"
echo "  2. 执行健康检查"
echo "  3. 配置监控和日志"
echo ""

