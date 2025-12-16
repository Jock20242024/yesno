# E2E 功能验证测试指南

## 测试环境

- **前端地址:** http://localhost:3000
- **Admin 登录:** http://localhost:3000/admin/login
- **用户注册:** http://localhost:3000/register
- **用户登录:** http://localhost:3000/login

## Admin 凭证

- **Email:** `yesno@yesno.com`
- **Password:** `yesno2025`

---

## 场景 2: 注册与充值

### 步骤 2.1: 注册新用户 A

1. 访问: http://localhost:3000/register
2. 填写表单:
   - Email: `testuser@verify.com`
   - Password: `testpass123`
3. 点击"注册"
4. **预期结果:** 注册成功，跳转到登录或首页

### 步骤 2.2: 用户 A 充值 $1000

1. 登录用户 A 账户
2. 访问: http://localhost:3000/profile
3. 在"充值"区域:
   - 金额: `1000`
   - 交易哈希: `TEST_TX_E2E_001`
4. 点击"提交"
5. **预期结果:** 
   - ✅ 充值成功提示
   - ✅ 用户余额显示为 `$1000.00`

### 验证点 2

**数据库验证:**
```sql
SELECT id, email, balance FROM users WHERE email = 'testuser@verify.com';
```

**预期结果:**
- `balance = 1000.00`

---

## 场景 3-4: 交易与锁定

### 步骤 3.1: Admin 创建市场 M1

1. Admin 登录后台
2. 访问: http://localhost:3000/admin/markets/create
3. 填写表单:
   - 市场名称: `E2E测试市场M1`
   - 描述: `这是一个端到端测试市场`
   - 截止日期: 选择未来日期（例如：明天）
   - 费率: 5% (默认)
4. 点击"创建市场"
5. **预期结果:** 市场创建成功

**数据库验证:**
```sql
SELECT id, title, "feeRate", status FROM markets WHERE title LIKE '%E2E测试市场M1%';
```

### 步骤 3.2: 用户 A 下注 YES $100

1. 切换到用户 A 账户
2. 访问刚创建的市场详情页
3. 在交易区域:
   - 选择: `YES`
   - 金额: `100`
4. 点击"下注"
5. **预期结果:**
   - ✅ 下注成功
   - ✅ 用户余额变为 `$900.00` (1000 - 100)

**数据库验证:**
```sql
-- 检查用户余额
SELECT id, email, balance FROM users WHERE email = 'testuser@verify.com';

-- 检查订单
SELECT id, "userId", "marketId", "outcomeSelection", amount, "feeDeducted" 
FROM orders 
WHERE "userId" = (SELECT id FROM users WHERE email = 'testuser@verify.com')
ORDER BY "createdAt" DESC LIMIT 1;

-- 检查市场更新
SELECT id, title, "totalVolume", "totalYes", "totalNo" 
FROM markets 
WHERE title LIKE '%E2E测试市场M1%';
```

**预期结果:**
- 用户余额: `balance = 900.00`
- 订单金额: `amount = 100.00`
- 手续费: `feeDeducted = 5.00` (100 * 0.05)
- 市场总量: `totalVolume = 100.00`
- 市场 YES 池: `totalYes = 95.00` (100 - 5)

### 步骤 4.1: 用户 A 提交提现请求 $500

1. 访问: http://localhost:3000/profile
2. 在"提现"区域:
   - 金额: `500`
   - 提现地址: `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb`
3. 点击"提交提现"
4. **预期结果:**
   - ✅ 提现请求提交成功
   - ✅ 用户余额变为 `$400.00` (900 - 500，资金锁定)

**数据库验证:**
```sql
-- 检查用户余额
SELECT id, email, balance FROM users WHERE email = 'testuser@verify.com';

-- 检查提现记录
SELECT id, "userId", amount, status FROM withdrawals 
WHERE "userId" = (SELECT id FROM users WHERE email = 'testuser@verify.com')
ORDER BY "createdAt" DESC LIMIT 1;
```

**预期结果:**
- 用户余额: `balance = 400.00`
- 提现金额: `amount = 500.00`
- 提现状态: `status = 'PENDING'`

### 验证点 3-4

**用户 A 最终余额应为: `$400.00`**

---

## 场景 5: 核心清算

### 步骤 5.1: Admin 将市场 M1 状态改为 CLOSED

1. Admin 登录后台
2. 访问: http://localhost:3000/admin/markets/list
3. 找到市场 M1，点击"编辑"
4. 将市场状态改为 `CLOSED`
5. 保存更改

### 步骤 5.2: Admin 清算市场 M1，选择结果 YES

1. 访问: http://localhost:3000/admin/dashboard
2. 在"待清算市场"区域，找到市场 M1
3. 点击"清算市场"
4. 选择最终结果: `YES`
5. 确认清算

**预期结果:**
- ✅ 清算成功
- ✅ 用户 A 余额增加（收益）

**余额计算:**
- 初始余额: `$400.00` (充值 $1000 - 下注 $100 - 提现 $500)
- 下注净投资: `$95.00` ($100 - $5手续费)
- 市场总池: `$95.00` (totalYes，扣除手续费后)
- 获胜池: `$95.00` (totalYes)
- 回报率: `$95 / $95 = 1.0`
- 回报金额: `$95.00` (包含本金)
- **最终余额: `$400 + $95 = $495.00`**

**数据库验证:**
```sql
-- 检查用户余额
SELECT id, email, balance FROM users WHERE email = 'testuser@verify.com';

-- 检查订单结算
SELECT id, "userId", "outcomeSelection", amount, payout, "feeDeducted" 
FROM orders 
WHERE "userId" = (SELECT id FROM users WHERE email = 'testuser@verify.com')
AND "marketId" = (SELECT id FROM markets WHERE title LIKE '%E2E测试市场M1%' LIMIT 1);

-- 检查市场状态
SELECT id, title, status, "resolvedOutcome" FROM markets 
WHERE title LIKE '%E2E测试市场M1%';
```

**预期结果:**
- 用户余额: `balance = 495.00`
- 订单 payout: `payout = 95.00` (约等于)
- 市场状态: `status = 'RESOLVED'`
- 市场结果: `resolvedOutcome = 'YES'`

### 验证点 5

**用户 A 最终余额应为: `$495.00`**

---

## 场景 6: 提现审批

### 步骤 6.1: Admin 审批提现请求

1. Admin 登录后台
2. 访问: http://localhost:3000/admin/dashboard
3. 在"待审批提现"区域，找到用户 A 的 $500 提现请求
4. 点击"批准"

**预期结果:**
- ✅ 审批成功
- ✅ 用户 A 余额保持不变（因为钱已在提交时扣除）

**数据库验证:**
```sql
-- 检查用户余额
SELECT id, email, balance FROM users WHERE email = 'testuser@verify.com';

-- 检查提现记录状态
SELECT id, "userId", amount, status FROM withdrawals 
WHERE "userId" = (SELECT id FROM users WHERE email = 'testuser@verify.com')
ORDER BY "createdAt" DESC LIMIT 1;
```

**预期结果:**
- 用户余额: `balance = 495.00` (保持不变)
- 提现状态: `status = 'COMPLETED'`

### 验证点 6

**用户 A 余额应保持: `$495.00` 不变**

---

## 测试结果记录

完成所有场景后，记录以下信息：

### 场景 2: 注册与充值
- [ ] 用户 A 注册成功
- [ ] 用户 A 充值 $1000 成功
- [ ] 用户 A 余额 = `$1000.00` ✅ / ❌

### 场景 3-4: 交易与锁定
- [ ] 市场 M1 创建成功
- [ ] 用户 A 下注 YES $100 成功
- [ ] 用户 A 提交提现 $500 成功
- [ ] 用户 A 余额 = `$400.00` ✅ / ❌

### 场景 5: 核心清算
- [ ] 市场 M1 清算成功（结果 YES）
- [ ] 用户 A 余额 = `$495.00` ✅ / ❌

### 场景 6: 提现审批
- [ ] 提现审批成功
- [ ] 用户 A 余额保持 `$495.00` 不变 ✅ / ❌

---

## 快速 SQL 验证脚本

在数据库执行以下 SQL 查看所有关键数据：

```sql
-- 查看用户 A 的完整信息
SELECT 
    id, 
    email, 
    balance, 
    "isAdmin",
    "createdAt"
FROM users 
WHERE email = 'testuser@verify.com';

-- 查看用户 A 的所有订单
SELECT 
    id,
    "marketId",
    "outcomeSelection",
    amount,
    "feeDeducted",
    payout,
    "createdAt"
FROM orders 
WHERE "userId" = (SELECT id FROM users WHERE email = 'testuser@verify.com')
ORDER BY "createdAt";

-- 查看用户 A 的所有充值记录
SELECT 
    id,
    amount,
    status,
    "createdAt"
FROM deposits 
WHERE "userId" = (SELECT id FROM users WHERE email = 'testuser@verify.com')
ORDER BY "createdAt";

-- 查看用户 A 的所有提现记录
SELECT 
    id,
    amount,
    status,
    "createdAt"
FROM withdrawals 
WHERE "userId" = (SELECT id FROM users WHERE email = 'testuser@verify.com')
ORDER BY "createdAt";

-- 查看市场 M1 信息
SELECT 
    id,
    title,
    status,
    "resolvedOutcome",
    "totalVolume",
    "totalYes",
    "totalNo"
FROM markets 
WHERE title LIKE '%E2E测试市场M1%';
```

---

## 问题排查

如果测试失败，检查：

1. **数据库连接:** 确保 PostgreSQL 容器运行
2. **应用状态:** 确保 Next.js 应用运行在端口 3000
3. **认证 Token:** 确保登录后 Cookie 正确设置
4. **日志输出:** 查看服务器日志和浏览器控制台

