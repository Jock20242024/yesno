-- 🔥 修复历史持仓的avgPrice数据
-- 根据订单记录计算实际投入金额，然后更新avgPrice = 净投入金额 / 份额

-- 步骤1：创建一个临时表存储每个持仓的正确avgPrice
WITH position_investments AS (
  SELECT 
    p.id AS position_id,
    p."userId",
    p."marketId",
    p.outcome,
    p.shares,
    p."avgPrice",
    -- 计算该持仓的实际投入金额（从订单记录）
    COALESCE(
      SUM(o.amount - COALESCE(o."feeDeducted", 0)), 
      0
    ) AS actual_invested_amount
  FROM positions p
  LEFT JOIN orders o ON 
    o."userId" = p."userId" AND
    o."marketId" = p."marketId" AND
    o."outcomeSelection" = p.outcome AND
    o.status = 'FILLED'
  WHERE p.status = 'OPEN'
  GROUP BY p.id, p."userId", p."marketId", p.outcome, p.shares, p."avgPrice"
)
-- 步骤2：更新avgPrice（只有当实际投入金额>0且shares>0时）
UPDATE positions
SET "avgPrice" = CASE
  WHEN pi.shares > 0 AND pi.actual_invested_amount > 0 
    THEN pi.actual_invested_amount / pi.shares
  ELSE "avgPrice" -- 如果没有订单记录，保持原值
END,
"updatedAt" = NOW()
FROM position_investments pi
WHERE positions.id = pi.position_id
  AND (
    -- 只更新明显错误的avgPrice（如0.99，或者avgPrice * shares与实际投入金额差异>0.01）
    positions."avgPrice" = 0.99 
    OR ABS(positions."avgPrice" * positions.shares - pi.actual_invested_amount) > 0.01
  );

-- 验证：查看修复后的数据
SELECT 
  p.id,
  p."userId",
  p."marketId",
  p.outcome,
  p.shares,
  p."avgPrice" AS corrected_avg_price,
  p.shares * p."avgPrice" AS calculated_cost,
  COALESCE(SUM(o.amount - COALESCE(o."feeDeducted", 0)), 0) AS actual_invested,
  ABS(p.shares * p."avgPrice" - COALESCE(SUM(o.amount - COALESCE(o."feeDeducted", 0)), 0)) AS difference
FROM positions p
LEFT JOIN orders o ON 
  o."userId" = p."userId" AND
  o."marketId" = p."marketId" AND
  o."outcomeSelection" = p.outcome AND
  o.status = 'FILLED'
WHERE p.status = 'OPEN'
GROUP BY p.id, p."userId", p."marketId", p.outcome, p.shares, p."avgPrice"
HAVING ABS(p.shares * p."avgPrice" - COALESCE(SUM(o.amount - COALESCE(o."feeDeducted", 0)), 0)) > 0.01;

