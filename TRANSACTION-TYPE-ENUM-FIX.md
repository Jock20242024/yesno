# TransactionType 枚举修复说明

## 问题描述

错误信息：
```
invalid input value for enum "TransactionType": "MARKET_PROFIT_LOSS"
```

**原因：** 数据库中的 `TransactionType` 枚举类型缺少 `MARKET_PROFIT_LOSS`、`LIQUIDITY_INJECTION` 和 `LIQUIDITY_RECOVERY` 值。

## 解决方案

### 方法 1：在 Vercel 上运行迁移（推荐）

1. 登录 Vercel Dashboard
2. 进入项目设置
3. 在 "Deployments" 标签页，找到最新的部署
4. 点击 "Redeploy" 或等待自动部署
5. 迁移会在部署时自动运行

### 方法 2：手动执行 SQL（如果方法1不起作用）

如果自动迁移没有运行，可以在 Vercel 的数据库控制台或通过 Prisma Studio 手动执行以下 SQL：

```sql
-- 检查枚举是否存在
SELECT typname FROM pg_type WHERE typname = 'TransactionType';

-- 如果不存在，创建枚举
CREATE TYPE "TransactionType" AS ENUM (
    'DEPOSIT',
    'WITHDRAW',
    'BET',
    'WIN',
    'ADMIN_ADJUSTMENT',
    'LIQUIDITY_INJECTION',
    'LIQUIDITY_RECOVERY',
    'MARKET_PROFIT_LOSS'
);

-- 如果已存在，添加缺失的值
DO $$ 
BEGIN
    -- 添加 LIQUIDITY_INJECTION
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'LIQUIDITY_INJECTION' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'TransactionType')
    ) THEN
        ALTER TYPE "TransactionType" ADD VALUE 'LIQUIDITY_INJECTION';
    END IF;
    
    -- 添加 LIQUIDITY_RECOVERY
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'LIQUIDITY_RECOVERY' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'TransactionType')
    ) THEN
        ALTER TYPE "TransactionType" ADD VALUE 'LIQUIDITY_RECOVERY';
    END IF;
    
    -- 添加 MARKET_PROFIT_LOSS
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'MARKET_PROFIT_LOSS' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'TransactionType')
    ) THEN
        ALTER TYPE "TransactionType" ADD VALUE 'MARKET_PROFIT_LOSS';
    END IF;
END $$;
```

### 方法 3：使用 Prisma Migrate（本地开发环境）

```bash
# 运行迁移
npx prisma migrate deploy

# 或者如果是开发环境
npx prisma migrate dev
```

## 验证修复

迁移执行后，可以通过以下 SQL 验证：

```sql
-- 查看所有 TransactionType 枚举值
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'TransactionType')
ORDER BY enumsortorder;
```

应该看到以下值：
- DEPOSIT
- WITHDRAW
- BET
- WIN
- ADMIN_ADJUSTMENT
- LIQUIDITY_INJECTION
- LIQUIDITY_RECOVERY
- MARKET_PROFIT_LOSS

## 迁移文件位置

迁移文件已创建在：
`prisma/migrations/20250106180000_fix_transaction_type_enum_complete/migration.sql`

这个迁移是安全的，可以在生产环境执行，它会：
1. 检查枚举是否存在，不存在则创建
2. 如果存在，逐个检查并添加缺失的值
3. 使用条件判断避免重复添加

