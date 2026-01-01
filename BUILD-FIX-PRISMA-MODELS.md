# Prisma 模型名称修复说明

## 问题
Prisma schema 中的模型名称都是复数形式（`users`, `categories`, `markets`, `transactions`），但代码中大量使用了单数形式（`prisma.user`, `prisma.category`, `prisma.market`, `prisma.transaction`）。

## 已修复的文件
- ✅ `app/(public)/category/[slug]/page.tsx` - `prisma.category` → `prisma.categories`
- ✅ `app/actions/admin/get-asset-stats.ts` - `prisma.user` → `prisma.users`, `prisma.transaction` → `prisma.transactions`
- ✅ `app/api/admin/categories/[category_id]/route.ts` - `prisma.category` → `prisma.categories`, `parent` → `categories`
- ✅ `app/api/admin/categories/route.ts` - `prisma.category` → `prisma.categories`, `prisma.market` → `prisma.markets`, `parent` → `categories`

## 需要修复的文件（通过构建错误逐步修复）
根据之前的 grep 结果，还有很多文件需要修复：
- `app/api/**/*.ts` - 所有使用 `prisma.user` 的地方需要改为 `prisma.users`

## 修复策略
由于错误数量较多，建议：
1. 逐个修复构建错误中报告的文件
2. 或者创建一个脚本批量替换（但需要小心，确保不会破坏代码逻辑）

