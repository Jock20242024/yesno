-- ============================================
-- 🔥 万能修复脚本：校准 AMM 池余额
-- ============================================
-- 
-- 问题：AMM 池余额可能与实际订单流入不匹配
-- 解决方案：根据所有已成交订单重新计算 AMM 池余额
--
-- 逻辑说明：
-- 1. 用户买入（BUY）：资金从用户账户流入 AMM 池 = amount - feeDeducted（净投入金额）
-- 2. 用户卖出（SELL）：资金从 AMM 池流出给用户 = grossValue（用户收到的总金额）
--    注意：卖出订单的 amount 字段存储的是 grossValue（总金额），feeDeducted 是手续费
--    所以 AMM 池减少 = amount（因为 amount 已经是总金额）
-- 3. AMM 池余额 = 所有买入订单的净流入 - 所有卖出订单的流出
--
-- 注意：
-- - 系统账户存储在 users 表中，通过 email 字段区分
-- - AMM 账户的 email 是 'system.amm@yesno.com'
-- - 只统计 status = 'FILLED' 的订单（已成交订单）
-- ============================================

-- 🔥 第一步：计算 AMM 池应该有的余额
-- 买入订单：AMM 池增加 (amount - feeDeducted) = 净投入金额
-- 卖出订单：AMM 池减少 amount（因为 amount 字段存储的是 grossValue，即用户收到的总金额）
WITH amm_balance_calculation AS (
  SELECT 
    COALESCE(SUM(
      CASE 
        WHEN "type" = 'BUY' THEN ("amount" - COALESCE("feeDeducted", 0))
        WHEN "type" = 'SELL' THEN -"amount"  -- 卖出时，amount 已经是 grossValue（总金额）
        ELSE 0 
      END
    ), 0) AS calculated_balance
  FROM "orders"
  WHERE "status" = 'FILLED'
)
-- 🔥 第二步：更新 AMM 账户余额
UPDATE "users" 
SET 
  "balance" = (
    SELECT calculated_balance 
    FROM amm_balance_calculation
  ),
  "updatedAt" = NOW()
WHERE "email" = 'system.amm@yesno.com';

-- 🔥 第三步：验证更新结果
SELECT 
  "email",
  "balance" AS current_balance,
  (
    SELECT COALESCE(SUM(
      CASE 
        WHEN "type" = 'BUY' THEN ("amount" - COALESCE("feeDeducted", 0))
        WHEN "type" = 'SELL' THEN -"amount"  -- 卖出时，amount 已经是 grossValue（总金额）
        ELSE 0 
      END
    ), 0)
    FROM "orders"
    WHERE "status" = 'FILLED'
  ) AS calculated_balance,
  (
    SELECT COUNT(*) 
    FROM "orders" 
    WHERE "status" = 'FILLED'
  ) AS total_filled_orders
FROM "users"
WHERE "email" = 'system.amm@yesno.com';

