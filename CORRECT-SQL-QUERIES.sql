-- ============================================
-- ✅ 正确的SQL查询（修复JSON数组格式问题）
-- ============================================
-- 重要：userId 和 marketId 必须使用纯字符串，不要用JSON数组格式
-- 错误示例：'["6b7922f0-3328-4dd1-9b58-abe0b909d1f1"]'
-- 正确示例：'6b7922f0-3328-4dd1-9b58-abe0b909d1f1'
-- ============================================

-- ============================================
-- 步骤1：查询订单表（验证订单数量）
-- ============================================
-- 替换 [你的用户ID] 和 [市场ID] 为纯字符串（不要JSON数组格式！）
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
WHERE "userId" = '6b7922f0-3328-4dd1-9b58-abe0b909d1f1'  -- ✅ 正确：纯字符串
  AND "marketId" = 'b7c46788-1aec-4b79-93eb-b08eb185c0ea'  -- ✅ 正确：纯字符串
ORDER BY "createdAt" ASC;

-- ============================================
-- 步骤2：查询持仓表（验证持仓数据）
-- ============================================
-- 替换 [你的用户ID] 和 [市场ID] 为纯字符串
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
WHERE "userId" = '6b7922f0-3328-4dd1-9b58-abe0b909d1f1'  -- ✅ 正确：纯字符串
  AND "marketId" = 'b7c46788-1aec-4b79-93eb-b08eb185c0ea'  -- ✅ 正确：纯字符串
  AND outcome = 'YES'
  AND status = 'OPEN'
ORDER BY "createdAt" ASC;

-- ============================================
-- 步骤3：关键验证 - 对比持仓成本 vs 实际投入
-- ============================================
-- 这个查询最关键：验证持仓是否正确合并
WITH order_summary AS (
  SELECT 
    SUM(amount - "feeDeducted") AS "实际投入金额",
    SUM("filledAmount") AS "订单总份额"
  FROM orders
  WHERE "userId" = '6b7922f0-3328-4dd1-9b58-abe0b909d1f1'  -- ✅ 纯字符串
    AND "marketId" = 'b7c46788-1aec-4b79-93eb-b08eb185c0ea'  -- ✅ 纯字符串
    AND status = 'FILLED'
    AND "orderType" = 'MARKET'
),
position_summary AS (
  SELECT 
    COUNT(*) AS "持仓记录数",  -- 🔥 关键：应该是1，如果是2说明没合并
    SUM(shares) AS "持仓总份额",
    SUM(shares * "avgPrice") AS "持仓成本（shares * avgPrice）"
  FROM positions
  WHERE "userId" = '6b7922f0-3328-4dd1-9b58-abe0b909d1f1'  -- ✅ 纯字符串
    AND "marketId" = 'b7c46788-1aec-4b79-93eb-b08eb185c0ea'  -- ✅ 纯字符串
    AND outcome = 'YES'
    AND status = 'OPEN'
)
SELECT 
  o."实际投入金额",
  o."订单总份额",
  p."持仓记录数",  -- 🔥 关键指标：应该是1
  p."持仓总份额",
  p."持仓成本（shares * avgPrice）",
  (o."实际投入金额" - p."持仓成本（shares * avgPrice）") AS "差异金额",
  (o."订单总份额" - p."持仓总份额") AS "差异份额"
FROM order_summary o, position_summary p;

-- ============================================
-- 步骤4：查询个人中心统计（验证预测次数）
-- ============================================
-- 替换 [你的用户ID] 为纯字符串
SELECT 
  COUNT(*) AS "预测次数（所有订单）",
  COUNT(CASE WHEN status = 'FILLED' THEN 1 END) AS "预测次数（仅FILLED）",
  COUNT(CASE WHEN status = 'PENDING' THEN 1 END) AS "预测次数（仅PENDING）",
  COUNT(CASE WHEN "orderType" = 'MARKET' THEN 1 END) AS "预测次数（仅MARKET）"
FROM orders
WHERE "userId" = '6b7922f0-3328-4dd1-9b58-abe0b909d1f1'  -- ✅ 纯字符串
  AND status IN ('FILLED', 'PENDING', 'COMPLETED');

-- ============================================
-- 步骤5：检查是否有重复持仓（不应该有）
-- ============================================
-- 替换 [你的用户ID] 和 [市场ID] 为纯字符串
SELECT 
  outcome,
  COUNT(*) AS "持仓记录数",  -- 🔥 应该是1，如果是2说明有重复
  SUM(shares) AS "总份额",
  AVG("avgPrice") AS "平均价格（简单平均）",
  -- 🔥 加权平均价格计算
  SUM(shares * "avgPrice") / SUM(shares) AS "加权平均价格"
FROM positions
WHERE "userId" = '6b7922f0-3328-4dd1-9b58-abe0b909d1f1'  -- ✅ 纯字符串
  AND "marketId" = 'b7c46788-1aec-4b79-93eb-b08eb185c0ea'  -- ✅ 纯字符串
  AND outcome = 'YES'
  AND status = 'OPEN'
GROUP BY outcome;

