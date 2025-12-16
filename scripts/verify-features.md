# 预测市场应用 - 功能验证清单

## 数据库设置状态

- [ ] PostgreSQL 数据库已启动
- [ ] `.env.local` 文件已配置 `DATABASE_URL`
- [ ] Prisma 迁移已成功运行（`npx prisma migrate dev --name init_base_schema`）
- [ ] Prisma 客户端已生成（`npx prisma generate`）

---

## 功能验证清单

### ✅ 1. 用户注册与登录

**测试步骤：**
1. 访问 `http://localhost:3000/register`
2. 注册新用户：`testuser@example.com` / `password123`
3. 登录后访问 `http://localhost:3000/profile`
4. 检查用户余额是否为 `$0.00`

**验证点：**
- [ ] 注册成功，无错误提示
- [ ] 登录成功，跳转到首页
- [ ] 用户余额显示为 `$0.00`
- [ ] 数据库中 `users` 表有新记录

**数据库验证：**
```sql
SELECT id, email, balance, "isAdmin", "createdAt" FROM users WHERE email = 'testuser@example.com';
```

---

### ✅ 2. 核心交易闭环测试

#### 2.1 管理员创建市场

**测试步骤：**
1. 访问 `http://localhost:3000/admin/login`
2. 使用 Admin 凭证登录：
   - Email: `admin@example.com`
   - Password: `admin123`
3. 访问 `http://localhost:3000/admin/markets/create`
4. 创建市场：
   - 市场名称：`E2E测试市场：明天会下雨吗？`
   - 描述：`这是一个端到端测试市场`
   - 截止日期：选择未来日期（例如：明天）
5. 提交创建

**验证点：**
- [ ] Admin 登录成功
- [ ] 市场创建表单提交成功
- [ ] 市场出现在 `http://localhost:3000/admin/markets/list`
- [ ] 数据库中 `markets` 表有新记录

**数据库验证：**
```sql
SELECT id, title, status, "totalVolume", "createdAt" FROM markets ORDER BY "createdAt" DESC LIMIT 1;
```

#### 2.2 用户下注

**测试步骤：**
1. 退出 Admin，使用普通用户登录（`testuser@example.com`）
2. 访问新创建的市场详情页
3. 执行 YES 下注：金额 `$100`
4. 执行 NO 下注：金额 `$50`

**验证点：**
- [ ] YES 下注成功，显示成功提示
- [ ] 用户余额减少 `$100`（从 `$0.00` 变为 `-$100.00` 或显示错误）
- [ ] NO 下注成功
- [ ] 用户余额再次减少 `$50`
- [ ] 市场总交易量显示为 `$150`
- [ ] 市场 YES/NO 百分比更新
- [ ] 数据库中 `orders` 表有两条记录

**数据库验证：**
```sql
-- 检查订单
SELECT id, "userId", "marketId", "outcomeSelection", amount, "feeDeducted", "createdAt" 
FROM orders 
ORDER BY "createdAt" DESC 
LIMIT 2;

-- 检查市场更新
SELECT id, "totalVolume", "totalYes", "totalNo" FROM markets WHERE title LIKE '%E2E测试%';
```

---

### ✅ 3. 资金管理测试

#### 3.1 充值

**测试步骤：**
1. 访问 `http://localhost:3000/profile`
2. 在"充值"区域，输入金额：`$500`
3. 输入交易哈希：`MOCK_TX_E2E_TEST_001`
4. 提交充值

**验证点：**
- [ ] 充值成功，显示成功提示
- [ ] 用户余额立即增加 `$500`
- [ ] 资金记录中显示充值记录，状态为"已完成"
- [ ] 数据库中 `deposits` 表有新记录
- [ ] 数据库中用户余额已更新

**数据库验证：**
```sql
-- 检查充值记录
SELECT id, "userId", amount, status, "createdAt" FROM deposits ORDER BY "createdAt" DESC LIMIT 1;

-- 检查用户余额
SELECT id, email, balance FROM users WHERE email = 'testuser@example.com';
```

#### 3.2 提现请求

**测试步骤：**
1. 在"提现"区域，输入金额：`$200`
2. 输入提现地址：`0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb`
3. 提交提现请求

**验证点：**
- [ ] 提现请求提交成功
- [ ] 用户余额立即减少 `$200`（资金锁定）
- [ ] 资金记录中显示提现记录，状态为"待处理"
- [ ] 数据库中 `withdrawals` 表有新记录，状态为 `PENDING`
- [ ] 数据库中用户余额已更新（减少 `$200`）

**数据库验证：**
```sql
-- 检查提现记录
SELECT id, "userId", amount, status, "targetAddress", "createdAt" 
FROM withdrawals 
ORDER BY "createdAt" DESC 
LIMIT 1;

-- 检查用户余额（应该已减少）
SELECT id, email, balance FROM users WHERE email = 'testuser@example.com';
```

---

### ✅ 4. 清算与财务结算测试

#### 4.1 市场清算

**测试步骤：**
1. 切换到 Admin 账户（`admin@example.com`）
2. 访问 `http://localhost:3000/admin/dashboard`
3. 在"待清算市场"区域，找到测试市场
4. 如果市场状态不是 `CLOSED`，先访问市场编辑页面将其改为 `CLOSED`
5. 点击"清算市场"按钮
6. 选择最终结果：`YES`
7. 确认清算

**验证点：**
- [ ] 清算成功，显示成功提示
- [ ] 市场状态变为 `RESOLVED`
- [ ] 下注 YES 的用户余额增加（本金 + 收益）
- [ ] 下注 NO 的用户余额不变（已扣除）
- [ ] 数据库中市场状态已更新为 `RESOLVED`
- [ ] 数据库中订单的 `payout` 字段已更新
- [ ] 数据库中用户余额已更新（获胜用户）

**数据库验证：**
```sql
-- 检查市场状态
SELECT id, title, status, "resolvedOutcome", "totalVolume" 
FROM markets 
WHERE title LIKE '%E2E测试%';

-- 检查订单结算
SELECT id, "userId", "outcomeSelection", amount, payout, "feeDeducted" 
FROM orders 
WHERE "marketId" = (SELECT id FROM markets WHERE title LIKE '%E2E测试%' LIMIT 1);

-- 检查用户余额（获胜用户应该增加）
SELECT id, email, balance FROM users WHERE email = 'testuser@example.com';
```

#### 4.2 提现审批（拒绝）

**测试步骤：**
1. 在 Admin Dashboard 的"待审批提现"区域
2. 找到之前提交的提现请求（金额 `$200`）
3. 点击"拒绝"按钮

**验证点：**
- [ ] 拒绝操作成功，显示成功提示
- [ ] 提现请求状态变为"已拒绝"
- [ ] 用户余额增加 `$200`（退还金额）
- [ ] 资金记录中显示提现记录，状态为"已拒绝"
- [ ] 数据库中 `withdrawals` 表状态已更新为 `FAILED`
- [ ] 数据库中用户余额已更新（增加 `$200`）

**数据库验证：**
```sql
-- 检查提现记录状态
SELECT id, "userId", amount, status, "createdAt" 
FROM withdrawals 
ORDER BY "createdAt" DESC 
LIMIT 1;

-- 检查用户余额（应该已退还）
SELECT id, email, balance FROM users WHERE email = 'testuser@example.com';
```

---

## 数据一致性验证

### 最终余额检查

执行完所有测试后，验证用户最终余额：

**预期余额计算：**
- 初始余额：`$0.00`
- YES 下注：`-$100.00`
- NO 下注：`-$50.00`
- 充值：`+$500.00`
- 提现请求：`-$200.00`（锁定）
- YES 下注获胜收益：`+本金 + 收益`（根据市场池计算）
- 提现拒绝退还：`+$200.00`

**数据库验证：**
```sql
-- 查看所有交易记录
SELECT 'deposit' as type, amount, status, "createdAt" FROM deposits WHERE "userId" = (SELECT id FROM users WHERE email = 'testuser@example.com')
UNION ALL
SELECT 'withdrawal' as type, -amount as amount, status, "createdAt" FROM withdrawals WHERE "userId" = (SELECT id FROM users WHERE email = 'testuser@example.com')
ORDER BY "createdAt";

-- 查看所有订单
SELECT "outcomeSelection", amount, payout, "feeDeducted", "createdAt" 
FROM orders 
WHERE "userId" = (SELECT id FROM users WHERE email = 'testuser@example.com')
ORDER BY "createdAt";
```

---

## 测试结果记录

完成所有测试后，请记录：

- **测试日期：** ___________
- **测试人员：** ___________
- **数据库状态：** ✅ 已连接 / ❌ 未连接

### 功能测试结果

- [ ] 用户注册与登录：✅ / ❌
- [ ] 市场创建：✅ / ❌
- [ ] 用户下注（YES）：✅ / ❌
- [ ] 用户下注（NO）：✅ / ❌
- [ ] 充值功能：✅ / ❌
- [ ] 提现请求：✅ / ❌
- [ ] 市场清算：✅ / ❌
- [ ] 提现审批（拒绝）：✅ / ❌

### 数据持久化验证

- [ ] 用户数据已保存到数据库：✅ / ❌
- [ ] 市场数据已保存到数据库：✅ / ❌
- [ ] 订单数据已保存到数据库：✅ / ❌
- [ ] 充值记录已保存到数据库：✅ / ❌
- [ ] 提现记录已保存到数据库：✅ / ❌
- [ ] 数据一致性验证通过：✅ / ❌

### 问题记录

如有任何问题，请在此记录：

1. _________________________________
2. _________________________________
3. _________________________________

---

## 下一步

如果所有测试通过：
- ✅ 应用已准备好进行生产部署
- ✅ 数据库结构已正确创建
- ✅ 所有核心功能正常工作

如果测试失败：
- 检查数据库连接
- 检查 Prisma 客户端是否已生成
- 查看浏览器控制台和服务器日志
- 参考 `README-DATABASE.md` 进行故障排除

