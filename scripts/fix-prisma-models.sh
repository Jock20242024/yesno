#!/bin/bash

# 批量修复 Prisma 模型名称（单数 -> 复数）
# 注意：需要手动检查每个文件以确保替换正确

echo "开始批量修复 Prisma 模型名称..."

# 定义替换映射
declare -A replacements=(
    ["prisma.user"]="prisma.users"
    ["prisma.market"]="prisma.markets"
    ["prisma.category"]="prisma.categories"
    ["prisma.deposit"]="prisma.deposits"
    ["prisma.withdrawal"]="prisma.withdrawals"
    ["prisma.order"]="prisma.orders"
    ["prisma.transaction"]="prisma.transactions"
    ["prisma.marketTemplate"]="prisma.market_templates"
    ["prisma.scraperTask"]="prisma.scraper_tasks"
)

# 要搜索的目录
DIRS=("app" "lib")

for dir in "${DIRS[@]}"; do
    for key in "${!replacements[@]}"; do
        value="${replacements[$key]}"
        echo "查找 $dir 中的 $key ..."
        find "$dir" -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "$key\." {} \; | while read file; do
            echo "  修复: $file"
            # 使用 sed 进行替换（macOS 兼容）
            sed -i '' "s/$key\./$value./g" "$file"
        done
    done
done

echo "批量修复完成！"

