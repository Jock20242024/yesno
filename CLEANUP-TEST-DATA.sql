-- ============================================
-- 🔥 测试数据清理脚本
-- ============================================
-- 
-- 功能：清理所有测试交易数据，重置系统到初始状态
-- 
-- 注意：
-- - 表名使用小写（PostgreSQL 默认）
-- - 系统账户存储在 users 表中，通过 email 识别
-- - 只清理产生过订单的市场
-- ============================================

DO $$
BEGIN
    -- 🔥 1. 清理特定市场的持仓
    -- 找出所有产生过订单的市场，并清理这些市场的持仓
    DELETE FROM "positions" 
    WHERE "marketId" IN (
        SELECT DISTINCT "marketId" 
        FROM "orders"
    );
    
    RAISE NOTICE '已清理持仓数据';
    
    -- 🔥 2. 清理特定市场的订单
    DELETE FROM "orders" 
    WHERE "marketId" IN (
        SELECT DISTINCT "marketId" 
        FROM "orders"
    );
    
    RAISE NOTICE '已清理订单数据';
    
    -- 🔥 3. 清理与这些市场相关的交易流水
    -- 注意：transactions 表没有 marketId 字段，需要通过 orders 表关联
    -- 先找出所有相关订单的用户ID，然后清理这些用户的交易记录
    DELETE FROM "transactions" 
    WHERE "userId" IN (
        SELECT DISTINCT "userId" 
        FROM "orders"
    )
    AND "type" IN ('BET', 'WIN', 'ADMIN_ADJUSTMENT', 'LIQUIDITY_INJECTION', 'LIQUIDITY_RECOVERY', 'MARKET_PROFIT_LOSS');
    
    RAISE NOTICE '已清理交易流水数据';
    
    -- 🔥 4. 将这些产生过交易的市场状态重置
    UPDATE "markets" 
    SET 
        "status" = 'CLOSED', 
        "totalYes" = 0, 
        "totalNo" = 0,
        "totalVolume" = 0,
        "internalVolume" = 0,
        "ammK" = 0,
        "initialLiquidity" = 0,
        "updatedAt" = NOW()
    WHERE "id" IN (
        SELECT DISTINCT "marketId" 
        FROM "orders"
    );
    
    RAISE NOTICE '已重置市场状态';
END $$;

-- 🔥 5. 财务账户重置（系统账户）
-- 注意：系统账户存储在 users 表中，通过 email 识别
UPDATE "users" 
SET 
    "balance" = 0,
    "updatedAt" = NOW()
WHERE "email" IN (
    'system.fee@yesno.com',
    'system.amm@yesno.com',
    'system.liquidity@yesno.com'
);

-- 🔥 6. 清理测试用户的余额
-- 清零管理员账户和指定测试账户
UPDATE "users" 
SET 
    "balance" = 0,
    "updatedAt" = NOW()
WHERE "isAdmin" = true 
   OR "email" = 'jacktom20201001@gmail.com';

-- 🔥 7. 验证清理结果
SELECT 
    '清理完成' AS status,
    (SELECT COUNT(*) FROM "orders") AS remaining_orders,
    (SELECT COUNT(*) FROM "positions") AS remaining_positions,
    (SELECT COUNT(*) FROM "transactions" WHERE "type" IN ('BET', 'WIN', 'ADMIN_ADJUSTMENT', 'LIQUIDITY_INJECTION', 'LIQUIDITY_RECOVERY', 'MARKET_PROFIT_LOSS')) AS remaining_transactions,
    (SELECT SUM("balance") FROM "users" WHERE "email" IN ('system.fee@yesno.com', 'system.amm@yesno.com', 'system.liquidity@yesno.com')) AS system_accounts_balance,
    (SELECT SUM("balance") FROM "users" WHERE "isAdmin" = true OR "email" = 'jacktom20201001@gmail.com') AS test_users_balance;

