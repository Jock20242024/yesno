-- ============================================
-- 🔧 合并重复持仓的清理脚本
-- ============================================
-- 用途：如果发现同一个市场、同一方向有多条持仓记录，此脚本可以合并它们
-- 使用方法：
-- 1. 先备份数据库
-- 2. 替换 [你的用户ID] 和 [市场ID] 为实际值
-- 3. 先执行 SELECT 查询查看结果
-- 4. 确认无误后，执行 UPDATE 和 DELETE 语句
-- ============================================

-- ============================================
-- 步骤1：查看重复持仓（先查看，不要直接删除）
-- ============================================
SELECT 
  "userId",
  "marketId",
  outcome,
  COUNT(*) AS "持仓记录数",
  STRING_AGG(id::text, ', ') AS "持仓ID列表",
  SUM(shares) AS "总份额",
  SUM(shares * "avgPrice") / SUM(shares) AS "加权平均价格"
FROM positions
WHERE "userId" = '6b7922f0-3328-4dd1-9b58-abe0b909d1f1'  -- 替换为你的用户ID
  AND "marketId" = 'b7c46788-1aec-4b79-93eb-b08eb185c0ea'  -- 替换为市场ID
  AND outcome = 'YES'
  AND status = 'OPEN'
GROUP BY "userId", "marketId", outcome
HAVING COUNT(*) > 1;  -- 🔥 只显示有重复的记录

-- ============================================
-- 步骤2：合并重复持仓（谨慎执行！）
-- ============================================
-- 注意：这个操作会删除除第一条外的所有重复持仓，并将它们的份额合并到第一条
-- 执行前请确认步骤1的查询结果

DO $$
DECLARE
  v_user_id TEXT := '6b7922f0-3328-4dd1-9b58-abe0b909d1f1';  -- 替换为你的用户ID
  v_market_id TEXT := 'b7c46788-1aec-4b79-93eb-b08eb185c0ea';  -- 替换为市场ID
  v_outcome TEXT := 'YES';
  v_keep_position_id UUID;  -- 保留的持仓ID（第一条）
  v_total_shares NUMERIC := 0;
  v_weighted_avg_price NUMERIC := 0;
  v_deleted_count INT := 0;
BEGIN
  -- 1. 找到要保留的持仓（创建时间最早的）
  SELECT id INTO v_keep_position_id
  FROM positions
  WHERE "userId" = v_user_id
    AND "marketId" = v_market_id
    AND outcome = v_outcome
    AND status = 'OPEN'
  ORDER BY "createdAt" ASC
  LIMIT 1;
  
  -- 2. 如果没有找到，退出
  IF v_keep_position_id IS NULL THEN
    RAISE NOTICE '未找到持仓记录';
    RETURN;
  END IF;
  
  -- 3. 计算总份额和加权平均价格
  SELECT 
    SUM(shares),
    SUM(shares * "avgPrice") / SUM(shares)
  INTO v_total_shares, v_weighted_avg_price
  FROM positions
  WHERE "userId" = v_user_id
    AND "marketId" = v_market_id
    AND outcome = v_outcome
    AND status = 'OPEN';
  
  -- 4. 更新保留的持仓记录
  UPDATE positions
  SET 
    shares = v_total_shares,
    "avgPrice" = v_weighted_avg_price,
    "updatedAt" = NOW()
  WHERE id = v_keep_position_id;
  
  RAISE NOTICE '已更新持仓: id=%, shares=%, avgPrice=%', 
    v_keep_position_id, v_total_shares, v_weighted_avg_price;
  
  -- 5. 删除其他重复的持仓记录
  DELETE FROM positions
  WHERE "userId" = v_user_id
    AND "marketId" = v_market_id
    AND outcome = v_outcome
    AND status = 'OPEN'
    AND id != v_keep_position_id;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RAISE NOTICE '已删除 % 条重复持仓记录', v_deleted_count;
END $$;

-- ============================================
-- 步骤3：验证合并结果
-- ============================================
SELECT 
  id,
  shares,
  "avgPrice",
  status,
  "createdAt",
  "updatedAt"
FROM positions
WHERE "userId" = '6b7922f0-3328-4dd1-9b58-abe0b909d1f1'  -- 替换为你的用户ID
  AND "marketId" = 'b7c46788-1aec-4b79-93eb-b08eb185c0ea'  -- 替换为市场ID
  AND outcome = 'YES'
  AND status = 'OPEN'
ORDER BY "createdAt" ASC;

-- ============================================
-- 预期结果：
-- - 应该只有1条持仓记录
-- - shares 应该是两次订单的份额总和
-- - avgPrice 应该是加权平均价格
-- ============================================

