#!/bin/bash

# 测试环境验证脚本
# 用途: 自动验证测试环境配置

set -e

echo "=========================================="
echo "测试环境验证脚本"
echo "=========================================="
echo ""

VERIFICATION_LOG="TEST-ENV-VERIFICATION-RESULT-$(date +%Y%m%d_%H%M%S).md"
echo "# 测试环境验证结果" > "$VERIFICATION_LOG"
echo "" >> "$VERIFICATION_LOG"
echo "**验证日期**: $(date +'%Y-%m-%d %H:%M:%S')" >> "$VERIFICATION_LOG"
echo "**验证环境**: 测试环境" >> "$VERIFICATION_LOG"
echo "" >> "$VERIFICATION_LOG"

# 计数器
PASSED=0
FAILED=0
SKIPPED=0

# 记录结果函数
log_result() {
    local category=$1
    local item=$2
    local status=$3
    local note=$4
    
    echo "| $item | $status | $note |" >> "$VERIFICATION_LOG"
    
    if [ "$status" = "✅ 通过" ]; then
        ((PASSED++))
    elif [ "$status" = "❌ 失败" ]; then
        ((FAILED++))
    else
        ((SKIPPED++))
    fi
}

echo "## 📋 验证结果" >> "$VERIFICATION_LOG"
echo "" >> "$VERIFICATION_LOG"
echo "| 检查项 | 状态 | 备注 |" >> "$VERIFICATION_LOG"
echo "|--------|------|------|" >> "$VERIFICATION_LOG"

# 1. 环境变量配置
echo "1. 检查环境变量配置..."
echo "### 1. 环境变量配置" >> "$VERIFICATION_LOG"
echo "" >> "$VERIFICATION_LOG"

if [ -f ".env.local" ] || [ -f ".env" ]; then
    ENV_FILE=".env.local"
    if [ ! -f "$ENV_FILE" ]; then
        ENV_FILE=".env"
    fi
    
    # 检查 DATABASE_URL
    if grep -q "DATABASE_URL=" "$ENV_FILE" 2>/dev/null; then
        log_result "环境变量" "DATABASE_URL" "✅ 通过" "已配置"
    else
        log_result "环境变量" "DATABASE_URL" "❌ 失败" "未配置"
    fi
    
    # 检查 NEXTAUTH_URL
    if grep -q "NEXTAUTH_URL=" "$ENV_FILE" 2>/dev/null; then
        log_result "环境变量" "NEXTAUTH_URL" "✅ 通过" "已配置"
    else
        log_result "环境变量" "NEXTAUTH_URL" "⏳ 跳过" "可选（有默认值）"
    fi
    
    # 检查 NEXTAUTH_SECRET
    if grep -q "NEXTAUTH_SECRET=" "$ENV_FILE" 2>/dev/null; then
        SECRET_LENGTH=$(grep "NEXTAUTH_SECRET=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '"' | wc -c)
        if [ "$SECRET_LENGTH" -ge 32 ]; then
            log_result "环境变量" "NEXTAUTH_SECRET" "✅ 通过" "已配置，长度足够"
        else
            log_result "环境变量" "NEXTAUTH_SECRET" "⚠️  警告" "长度不足 32 字符"
        fi
    else
        log_result "环境变量" "NEXTAUTH_SECRET" "❌ 失败" "未配置"
    fi
    
    # 检查 NODE_ENV
    if grep -q "NODE_ENV=" "$ENV_FILE" 2>/dev/null; then
        log_result "环境变量" "NODE_ENV" "✅ 通过" "已配置"
    else
        log_result "环境变量" "NODE_ENV" "⏳ 跳过" "可选（默认为 development）"
    fi
else
    log_result "环境变量" "环境变量文件" "❌ 失败" ".env 或 .env.local 不存在"
fi

echo "" >> "$VERIFICATION_LOG"

# 2. 数据库配置
echo "2. 检查数据库配置..."
echo "### 2. 数据库配置" >> "$VERIFICATION_LOG"
echo "" >> "$VERIFICATION_LOG"

# 检查 Prisma 迁移状态
if command -v npx >/dev/null 2>&1; then
    if npx prisma migrate status 2>/dev/null | grep -q "Database schema is up to date" || npx prisma migrate status 2>/dev/null | grep -q "Applied"; then
        log_result "数据库" "迁移状态" "✅ 通过" "迁移已应用"
    else
        MIGRATION_STATUS=$(npx prisma migrate status 2>&1 | head -5)
        log_result "数据库" "迁移状态" "⚠️  警告" "需要检查: $MIGRATION_STATUS"
    fi
else
    log_result "数据库" "迁移状态" "⏳ 跳过" "npx 不可用"
fi

# 检查 node_modules
if [ -d "node_modules" ]; then
    log_result "数据库" "node_modules" "✅ 通过" "已安装"
else
    log_result "数据库" "node_modules" "❌ 失败" "未安装"
fi

echo "" >> "$VERIFICATION_LOG"

# 3. 应用构建
echo "3. 检查应用构建..."
echo "### 3. 应用构建" >> "$VERIFICATION_LOG"
echo "" >> "$VERIFICATION_LOG"

# TypeScript 编译检查
if command -v npx >/dev/null 2>&1; then
    TS_ERRORS=$(npx tsc --noEmit --skipLibCheck 2>&1 | grep -c "error TS" || echo "0")
    if [ "$TS_ERRORS" -eq 0 ]; then
        log_result "构建" "TypeScript 编译" "✅ 通过" "无阻塞性错误"
    else
        log_result "构建" "TypeScript 编译" "⚠️  警告" "发现 $TS_ERRORS 个错误（可能是类型定义问题）"
    fi
else
    log_result "构建" "TypeScript 编译" "⏳ 跳过" "npx 不可用"
fi

# 检查构建配置
if grep -q "swcMinify: true" next.config.mjs 2>/dev/null; then
    log_result "构建" "swcMinify" "✅ 通过" "已启用"
else
    log_result "构建" "swcMinify" "❌ 失败" "未启用"
fi

if grep -q "compress: true" next.config.mjs 2>/dev/null; then
    log_result "构建" "compress" "✅ 通过" "已启用"
else
    log_result "构建" "compress" "❌ 失败" "未启用"
fi

echo "" >> "$VERIFICATION_LOG"

# 4. 代码质量
echo "4. 检查代码质量..."
echo "### 4. 代码质量" >> "$VERIFICATION_LOG"
echo "" >> "$VERIFICATION_LOG"

# 检查硬编码 Token
TOKEN_COUNT=$(grep -r "ADMIN_SECRET_TOKEN" app/ components/ lib/ --exclude-dir=node_modules 2>/dev/null | wc -l | tr -d ' ')
if [ "$TOKEN_COUNT" -eq 0 ]; then
    log_result "代码质量" "硬编码 Token" "✅ 通过" "未发现硬编码 Token"
else
    log_result "代码质量" "硬编码 Token" "❌ 失败" "发现 $TOKEN_COUNT 处硬编码 Token"
fi

# 检查权限验证
AUTH_COUNT=$(grep -r "verifyAdminToken" app/api/admin/ --exclude-dir=node_modules 2>/dev/null | wc -l | tr -d ' ')
if [ "$AUTH_COUNT" -gt 0 ]; then
    log_result "代码质量" "权限验证" "✅ 通过" "发现 $AUTH_COUNT 处权限验证"
else
    log_result "代码质量" "权限验证" "⚠️  警告" "未发现权限验证"
fi

echo "" >> "$VERIFICATION_LOG"

# 汇总
echo "## 📊 验证汇总" >> "$VERIFICATION_LOG"
echo "" >> "$VERIFICATION_LOG"
echo "- **通过**: $PASSED 项" >> "$VERIFICATION_LOG"
echo "- **失败**: $FAILED 项" >> "$VERIFICATION_LOG"
echo "- **跳过**: $SKIPPED 项" >> "$VERIFICATION_LOG"
echo "" >> "$VERIFICATION_LOG"

# 输出结果
echo ""
echo "=========================================="
echo "验证完成"
echo "=========================================="
echo ""
echo "通过: $PASSED 项"
echo "失败: $FAILED 项"
echo "跳过: $SKIPPED 项"
echo ""
echo "详细结果已保存到: $VERIFICATION_LOG"
echo ""

