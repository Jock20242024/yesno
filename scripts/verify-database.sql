-- 数据库验证 SQL 查询脚本
-- 用于验证 E2E 测试后的数据一致性

-- ============================================
-- 1. 用户数据验证
-- ============================================

-- 查看所有用户
SELECT id, email, balance, "isAdmin", "createdAt" 
FROM users 
ORDER BY "createdAt" DESC;

-- 查看特定用户（替换 email）
-- SELECT id, email, balance, "isAdmin", "createdAt" 
-- FROM users 
-- WHERE email = 'usera@example.com';

-- ============================================
-- 2. 市场数据验证
-- ============================================

-- 查看所有市场
SELECT id, title, status, "totalVolume", "totalYes", "totalNo", "feeRate", "resolvedOutcome"
FROM markets 
ORDER BY "createdAt" DESC;

-- 查看特定市场（替换 title）
-- SELECT id, title, status, "totalVolume", "totalYes", "totalNo", "feeRate", "resolvedOutcome"
-- FROM markets 
-- WHERE title LIKE '%E2E测试%';

-- ============================================
-- 3. 订单数据验证
-- ============================================

-- 查看所有订单
SELECT id, "userId", "marketId", "outcomeSelection", amount, "feeDeducted", payout, "createdAt"
FROM orders 
ORDER BY "createdAt" DESC;

-- 查看特定用户的订单（替换 userId）
-- SELECT id, "marketId", "outcomeSelection", amount, "feeDeducted", payout, "createdAt"
-- FROM orders 
-- WHERE "userId" = (SELECT id FROM users WHERE email = 'usera@example.com');

-- ============================================
-- 4. 充值记录验证
-- ============================================

-- 查看所有充值记录
SELECT id, "userId", amount, status, "createdAt"
FROM deposits 
ORDER BY "createdAt" DESC;

-- ============================================
-- 5. 提现记录验证
-- ============================================

-- 查看所有提现记录
SELECT id, "userId", amount, status, "targetAddress", "createdAt"
FROM withdrawals 
ORDER BY "createdAt" DESC;

-- ============================================
-- 6. E2E 测试场景验证查询
-- ============================================

-- 场景 2: 用户充值后余额验证
-- SELECT email, balance FROM users WHERE email = 'usera@example.com';
-- 预期: balance = 1000.00

-- 场景 3: 用户下注后余额和市场更新验证
-- SELECT email, balance FROM users WHERE email = 'usera@example.com';
-- 预期: balance = 900.00
-- SELECT "totalVolume", "totalYes", "totalNo" FROM markets WHERE title = 'E2E测试市场M1';
-- 预期: totalVolume = 100.00, totalYes = 95.00, totalNo = 0.00

-- 场景 4: 提现请求后余额验证
-- SELECT email, balance FROM users WHERE email = 'usera@example.com';
-- 预期: balance = 400.00
-- SELECT amount, status FROM withdrawals WHERE "userId" = (SELECT id FROM users WHERE email = 'usera@example.com') ORDER BY "createdAt" DESC LIMIT 1;
-- 预期: amount = 500.00, status = 'PENDING'

-- 场景 5: 市场清算后余额验证
-- SELECT email, balance FROM users WHERE email = 'usera@example.com';
-- 预期: balance = 495.00 (400 + 95)
-- SELECT status, "resolvedOutcome" FROM markets WHERE title = 'E2E测试市场M1';
-- 预期: status = 'RESOLVED', resolvedOutcome = 'YES'
-- SELECT payout FROM orders WHERE "userId" = (SELECT id FROM users WHERE email = 'usera@example.com') AND "marketId" = (SELECT id FROM markets WHERE title = 'E2E测试市场M1' LIMIT 1);
-- 预期: payout = 95.00 (约等于)

-- 场景 6: 提现审批后状态验证
-- SELECT amount, status FROM withdrawals WHERE "userId" = (SELECT id FROM users WHERE email = 'usera@example.com') AND amount = 500.00 ORDER BY "createdAt" DESC LIMIT 1;
-- 预期: status = 'COMPLETED'
-- SELECT email, balance FROM users WHERE email = 'usera@example.com';
-- 预期: balance = 495.00 (保持不变)

