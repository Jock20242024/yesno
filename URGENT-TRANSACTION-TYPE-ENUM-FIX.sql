-- ============================================
-- 🔥 紧急修复：TransactionType 枚举值缺失
-- ============================================
-- 执行时间：立即执行
-- 执行位置：Vercel 数据库控制台或 Supabase SQL Editor
-- 
-- 问题：数据库中的 TransactionType 枚举缺少以下值：
-- - LIQUIDITY_INJECTION
-- - LIQUIDITY_RECOVERY
-- - MARKET_PROFIT_LOSS
--
-- 这会导致以下错误：
-- "invalid input value for enum \"TransactionType\": \"MARKET_PROFIT_LOSS\""
-- ============================================

-- 步骤 1：检查枚举是否存在
DO $$ 
BEGIN
    -- 如果枚举不存在，创建它
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TransactionType') THEN
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
        RAISE NOTICE '✅ TransactionType 枚举已创建';
    ELSE
        RAISE NOTICE '✅ TransactionType 枚举已存在';
    END IF;
END $$;

-- 步骤 2：添加缺失的枚举值（如果枚举已存在）
DO $$ 
BEGIN
    -- 添加 LIQUIDITY_INJECTION
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'LIQUIDITY_INJECTION' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'TransactionType')
    ) THEN
        ALTER TYPE "TransactionType" ADD VALUE 'LIQUIDITY_INJECTION';
        RAISE NOTICE '✅ 已添加 LIQUIDITY_INJECTION';
    ELSE
        RAISE NOTICE '✅ LIQUIDITY_INJECTION 已存在';
    END IF;
    
    -- 添加 LIQUIDITY_RECOVERY
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'LIQUIDITY_RECOVERY' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'TransactionType')
    ) THEN
        ALTER TYPE "TransactionType" ADD VALUE 'LIQUIDITY_RECOVERY';
        RAISE NOTICE '✅ 已添加 LIQUIDITY_RECOVERY';
    ELSE
        RAISE NOTICE '✅ LIQUIDITY_RECOVERY 已存在';
    END IF;
    
    -- 添加 MARKET_PROFIT_LOSS
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'MARKET_PROFIT_LOSS' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'TransactionType')
    ) THEN
        ALTER TYPE "TransactionType" ADD VALUE 'MARKET_PROFIT_LOSS';
        RAISE NOTICE '✅ 已添加 MARKET_PROFIT_LOSS';
    ELSE
        RAISE NOTICE '✅ MARKET_PROFIT_LOSS 已存在';
    END IF;
END $$;

-- 步骤 3：验证修复结果
SELECT 
    'TransactionType 枚举值列表：' as info,
    enumlabel as value,
    enumsortorder as sort_order
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'TransactionType')
ORDER BY enumsortorder;

-- ============================================
-- 执行说明：
-- 1. 复制整个 SQL 脚本
-- 2. 在 Vercel 数据库控制台或 Supabase SQL Editor 中执行
-- 3. 检查输出，确保所有值都已添加
-- 4. 如果看到 "已存在" 的消息，说明值已经存在，可以忽略
-- ============================================

