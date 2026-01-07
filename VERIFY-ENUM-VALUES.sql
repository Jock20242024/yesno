-- ============================================
-- 🔍 验证 TransactionType 枚举值
-- ============================================
-- 执行此查询来确认所有 8 个枚举值是否存在
-- ============================================

SELECT 
    enumlabel as "枚举值",
    enumsortorder as "排序顺序"
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'TransactionType')
ORDER BY enumsortorder;

-- ============================================
-- 预期结果：应该看到 8 个值
-- ============================================
-- 1. DEPOSIT
-- 2. WITHDRAW
-- 3. BET
-- 4. WIN
-- 5. ADMIN_ADJUSTMENT
-- 6. LIQUIDITY_INJECTION  ← 必须存在
-- 7. LIQUIDITY_RECOVERY   ← 必须存在
-- 8. MARKET_PROFIT_LOSS   ← 必须存在
-- ============================================

