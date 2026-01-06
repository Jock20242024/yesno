-- 修复 TransactionType 枚举：确保所有值都存在
-- 这个迁移是安全的，可以在生产环境执行

-- 首先检查并创建 TransactionType 枚举（如果不存在）
DO $$ 
BEGIN
    -- 检查枚举是否存在
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TransactionType') THEN
        -- 如果不存在，创建枚举（包含所有值）
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
    ELSE
        -- 如果存在，逐个添加缺失的值（使用 IF NOT EXISTS 避免重复）
        -- 注意：PostgreSQL 的 ALTER TYPE ADD VALUE 不支持 IF NOT EXISTS，所以需要先检查
        
        -- 添加 LIQUIDITY_INJECTION（如果不存在）
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'LIQUIDITY_INJECTION' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'TransactionType')
        ) THEN
            ALTER TYPE "TransactionType" ADD VALUE 'LIQUIDITY_INJECTION';
        END IF;
        
        -- 添加 LIQUIDITY_RECOVERY（如果不存在）
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'LIQUIDITY_RECOVERY' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'TransactionType')
        ) THEN
            ALTER TYPE "TransactionType" ADD VALUE 'LIQUIDITY_RECOVERY';
        END IF;
        
        -- 添加 MARKET_PROFIT_LOSS（如果不存在）
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'MARKET_PROFIT_LOSS' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'TransactionType')
        ) THEN
            ALTER TYPE "TransactionType" ADD VALUE 'MARKET_PROFIT_LOSS';
        END IF;
    END IF;
END $$;

