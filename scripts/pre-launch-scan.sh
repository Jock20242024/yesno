#!/bin/bash

echo "🔍 上线前代码扫描工具"
echo "=========================="

echo ""
echo "1. TypeScript 类型检查..."
npx tsc --noEmit 2>&1 | head -50

echo ""
echo "2. 查找敏感信息（password, secret, key, token）..."
grep -r -i "password\|secret\|api.*key\|token" app/ lib/ components/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v ".env" | grep -v "node_modules" | head -20

echo ""
echo "3. 查找硬编码的 URL..."
grep -r "http://\|https://" app/ lib/ components/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "node_modules" | head -20

echo ""
echo "4. 统计 TODO/FIXME 数量..."
TODO_COUNT=$(grep -r "TODO\|FIXME\|XXX\|HACK" app/ components/ lib/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
echo "发现 $TODO_COUNT 个 TODO/FIXME"

echo ""
echo "5. 统计 console.log 数量..."
LOG_COUNT=$(grep -r "console\.log" app/ components/ lib/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
echo "发现 $LOG_COUNT 个 console.log"

echo ""
echo "6. 检查未使用的导入..."
# 需要 ESLint 配置，这里只是提示
echo "提示：使用 'npx eslint --ext .ts,.tsx app/ components/ lib/ --format=compact' 检查未使用的导入"

echo ""
echo "✅ 扫描完成！"
