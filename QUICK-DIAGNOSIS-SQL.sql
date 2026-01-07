-- ============================================
-- 🔍 快速诊断SQL查询脚本
-- ============================================
-- 使用方法：
-- 1. 登录 Supabase Dashboard 或 Vercel Postgres Dashboard
-- 2. 打开 SQL Editor
-- 3. 替换 [你的用户ID] 和 [市场ID] 为实际值
-- 4. 依次执行以下查询
-- ============================================

-- ============================================
-- 步骤1：查找你的用户ID（如果不知道）
-- ============================================
-- 替换 [你的邮箱] 为你的登录邮箱
SELECT id, email, "isAdmin", "createdAt"
FROM users
WHERE email = '[你的邮箱]'
LIMIT 1;

-- ============================================
-- 步骤2：查询订单表（验证订单数量）
-- ============================================
-- 替换 [你的用户ID] 和 [市场ID]
SELECT 
  id AS "订单ID",
  "userId" AS "用户ID",
  "marketId" AS "市场ID",
  "outcomeSelection" AS "方向",
  amount AS "金额",
  "feeDeducted" AS "手续费",
  "filledAmount" AS "已成交份额",
  status AS "状态",
  "orderType" AS "订单类型",
  "createdAt" AS "创建时间",
  "updatedAt" AS "更新时间"
FROM orders
WHERE "userId" = '[你的用户ID]'
  AND "marketId" = '[市场ID]'
ORDER BY "createdAt" ASC;

-- ============================================
-- 步骤3：查询持仓表（验证持仓数据）
-- ============================================
-- 替换 [你的用户ID] 和 [市场ID]
SELECT 
  id AS "持仓ID",
  "userId" AS "用户ID",
  "marketId" AS "市场ID",
  outcome AS "方向",
  shares AS "份额",
  "avgPrice" AS "平均价格",
  status AS "状态",
  "createdAt" AS "创建时间",
  "updatedAt" AS "更新时间",
  -- 🔥 计算验证：shares * avgPrice 应该接近实际投入金额
  (shares * "avgPrice") AS "持仓成本（计算值）"
FROM positions
WHERE "userId" = '[你的用户ID]'
  AND "marketId" = '[市场ID]'
  AND outcome = 'YES'
  AND status = 'OPEN'
ORDER BY "createdAt" ASC;

-- ============================================
-- 步骤4：查询交易记录（验证资金流水）
-- ============================================
-- 替换 [你的用户ID]
SELECT 
  id AS "交易ID",
  "userId" AS "用户ID",
  amount AS "金额",
  type AS "类型",
  reason AS "原因",
  status AS "状态",
  "createdAt" AS "创建时间"
FROM transactions
WHERE "userId" = '[你的用户ID]'
  AND type = 'BET'
  AND "createdAt" >= '2026-01-07 19:20:00'
  AND "createdAt" <= '2026-01-07 19:25:00'
ORDER BY "createdAt" ASC;

-- ============================================
-- 步骤5：计算订单总投入金额（用于对比）
-- ============================================
-- 替换 [你的用户ID] 和 [市场ID]
SELECT 
  COUNT(*) AS "订单数量",
  SUM(amount) AS "总金额",
  SUM("feeDeducted") AS "总手续费",
  SUM(amount - "feeDeducted") AS "净投入金额",
  SUM("filledAmount") AS "总成交份额"
FROM orders
WHERE "userId" = '[你的用户ID]'
  AND "marketId" = '[市场ID]'
  AND status = 'FILLED'
  AND "orderType" = 'MARKET';

-- ============================================
-- 步骤6：对比持仓成本 vs 实际投入（关键验证）
-- ============================================
-- 替换 [你的用户ID] 和 [市场ID]
WITH order_summary AS (
  SELECT 
    SUM(amount - "feeDeducted") AS "实际投入金额",
    SUM("filledAmount") AS "订单总份额"
  FROM orders
  WHERE "userId" = '[你的用户ID]'
    AND "marketId" = '[市场ID]'
    AND status = 'FILLED'
    AND "orderType" = 'MARKET'
),
position_summary AS (
  SELECT 
    SUM(shares) AS "持仓总份额",
    SUM(shares * "avgPrice") AS "持仓成本（shares * avgPrice）"
  FROM positions
  WHERE "userId" = '[你的用户ID]'
    AND "marketId" = '[市场ID]'
    AND outcome = 'YES'
    AND status = 'OPEN'
)
SELECT 
  o."实际投入金额",
  o."订单总份额",
  p."持仓总份额",
  p."持仓成本（shares * avgPrice）",
  (o."实际投入金额" - p."持仓成本（shares * avgPrice）") AS "差异金额",
  (o."订单总份额" - p."持仓总份额") AS "差异份额"
FROM order_summary o, position_summary p;

-- ============================================
-- 步骤7：查询个人中心统计使用的订单（验证预测次数）
-- ============================================
-- 替换 [你的用户ID]
-- 这个查询模拟个人中心API的查询逻辑
SELECT 
  COUNT(*) AS "预测次数（所有订单）",
  COUNT(CASE WHEN status = 'FILLED' THEN 1 END) AS "预测次数（仅FILLED）",
  COUNT(CASE WHEN status = 'PENDING' THEN 1 END) AS "预测次数（仅PENDING）",
  COUNT(CASE WHEN "orderType" = 'MARKET' THEN 1 END) AS "预测次数（仅MARKET）"
FROM orders
WHERE "userId" = '[你的用户ID]'
  AND status IN ('FILLED', 'PENDING', 'COMPLETED');

-- ============================================
-- 步骤8：详细订单列表（用于手动验证）
-- ============================================
-- 替换 [你的用户ID] 和 [市场ID]
SELECT 
  o.id AS "订单ID",
  o."createdAt" AS "订单时间",
  o.amount AS "订单金额",
  o."feeDeducted" AS "手续费",
  (o.amount - o."feeDeducted") AS "净投入",
  o."filledAmount" AS "成交份额",
  o.status AS "订单状态",
  o."orderType" AS "订单类型",
  -- 🔥 计算：如果成交份额和成交价格已知，可以反推成交价格
  CASE 
    WHEN o."filledAmount" > 0 THEN (o.amount - o."feeDeducted") / o."filledAmount"
    ELSE NULL
  END AS "反推成交价格"
FROM orders o
WHERE o."userId" = '[你的用户ID]'
  AND o."marketId" = '[市场ID]'
ORDER BY o."createdAt" ASC;

-- ============================================
-- 步骤9：检查是否有重复持仓（不应该有）
-- ============================================
-- 替换 [你的用户ID] 和 [市场ID]
SELECT 
  outcome,
  COUNT(*) AS "持仓记录数",
  SUM(shares) AS "总份额",
  AVG("avgPrice") AS "平均价格（简单平均）",
  -- 🔥 加权平均价格计算
  SUM(shares * "avgPrice") / SUM(shares) AS "加权平均价格"
FROM positions
WHERE "userId" = '[你的用户ID]'
  AND "marketId" = '[市场ID]'
  AND outcome = 'YES'
  AND status = 'OPEN'
GROUP BY outcome;

-- ============================================
-- 步骤10：检查市场当前状态（验证市场数据）
-- ============================================
-- 替换 [市场ID]
SELECT 
  id,
  title,
  status,
  "totalYes",
  "totalNo",
  ("totalYes" + "totalNo") AS "总流动性",
  CASE 
    WHEN ("totalYes" + "totalNo") > 0 THEN "totalYes" / ("totalYes" + "totalNo")
    ELSE 0.5
  END AS "当前YES价格",
  "updatedAt"
FROM markets
WHERE id = '[市场ID]';

