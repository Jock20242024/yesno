# 预测市场应用 - End-to-End 功能验证指南

## 前置条件

1. ✅ 数据库已成功迁移（`npx prisma migrate dev --name init_base_schema`）
2. ✅ Next.js 开发服务器正在运行（`npm run dev`）
3. ✅ 浏览器可以访问 `http://localhost:3000`

---

## 测试步骤

### 1. 用户注册与登录

**步骤：**
1. 访问 `http://localhost:3000/register`
2. 注册一个新用户（例如：`test@example.com` / `password123`）
3. 登录后，访问 `http://localhost:3000/profile`
4. 验证用户余额是否为初始值 `$0.00`

**预期结果：**
- ✅ 注册成功
- ✅ 登录成功
- ✅ 用户余额显示为 `$0.00`

---

### 2. 核心交易闭环测试

#### 2.1 管理员创建市场

**步骤：**
1. 访问 `http://localhost:3000/admin/login`
2. 使用 Admin 凭证登录：
   - Email: `admin@example.com`
   - Password: `admin123`
3. 访问 `http://localhost:3000/admin/markets/create`
4. 创建一个新市场：
   - 市场名称：`测试市场：明天会下雨吗？`
   - 描述：`这是一个测试市场`
   - 截止日期：选择未来日期
5. 提交创建

**预期结果：**
- ✅ 市场创建成功
- ✅ 市场出现在市场列表中

#### 2.2 用户下注

**步骤：**
1. 切换到用户账户（退出 Admin，使用普通用户登录）
2. 访问新创建的市场详情页
3. 执行一笔 YES 下注：金额 `$100`
4. 执行一笔 NO 下注：金额 `$50`

**预期结果：**
- ✅ YES 下注成功，用户余额减少 `$100`
- ✅ NO 下注成功，用户余额减少 `$50`
- ✅ 市场总交易量增加 `$150`
- ✅ 市场 YES/NO 百分比更新

---

### 3. 资金管理测试

#### 3.1 充值

**步骤：**
1. 访问 `http://localhost:3000/profile`
2. 在"充值"区域，输入金额：`$500`
3. 输入交易哈希（可选）：`MOCK_TX_123456`
4. 提交充值

**预期结果：**
- ✅ 充值成功
- ✅ 用户余额立即增加 `$500`
- ✅ 资金记录中显示充值记录

#### 3.2 提现请求

**步骤：**
1. 在"提现"区域，输入金额：`$200`
2. 输入提现地址：`0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb`
3. 提交提现请求

**预期结果：**
- ✅ 提现请求提交成功
- ✅ 用户余额立即减少 `$200`（资金锁定）
- ✅ 资金记录中显示提现记录，状态为"待处理"

---

### 4. 清算与财务结算测试

#### 4.1 市场清算

**步骤：**
1. 切换到 Admin 账户
2. 访问 `http://localhost:3000/admin/markets/list`
3. 找到测试市场，点击"编辑"
4. 将市场状态改为 `CLOSED`（如果还没有关闭）
5. 访问 `http://localhost:3000/admin/dashboard`
6. 在"待清算市场"区域，找到测试市场
7. 点击"清算市场"
8. 选择最终结果：`YES`
9. 确认清算

**预期结果：**
- ✅ 市场状态变为 `RESOLVED`
- ✅ 下注 YES 的用户余额增加（本金 + 收益）
- ✅ 下注 NO 的用户余额不变（已扣除）
- ✅ 订单记录中显示结算后的 payout

#### 4.2 提现审批

**步骤：**
1. 在 Admin Dashboard 的"待审批提现"区域
2. 找到之前提交的提现请求
3. 点击"拒绝"

**预期结果：**
- ✅ 提现请求状态变为"已拒绝"
- ✅ 用户余额增加 `$200`（退还金额）
- ✅ 资金记录中显示提现记录，状态为"已拒绝"

---

## 数据库验证

在测试过程中，可以使用以下命令验证数据是否持久化：

```bash
# 连接到数据库
psql postgresql://postgres:postgres@localhost:5432/yesno_db

# 查看用户表
SELECT id, email, balance, "isAdmin", "createdAt" FROM users;

# 查看市场表
SELECT id, title, status, "totalVolume", "totalYes", "totalNo" FROM markets;

# 查看订单表
SELECT id, "userId", "marketId", "outcomeSelection", amount, payout, "feeDeducted" FROM orders;

# 查看充值记录
SELECT id, "userId", amount, status, "createdAt" FROM deposits;

# 查看提现记录
SELECT id, "userId", amount, status, "createdAt" FROM withdrawals;
```

---

## 测试结果记录

请在完成测试后，记录以下信息：

- [ ] 用户注册与登录：✅ / ❌
- [ ] 市场创建：✅ / ❌
- [ ] 用户下注：✅ / ❌
- [ ] 充值功能：✅ / ❌
- [ ] 提现请求：✅ / ❌
- [ ] 市场清算：✅ / ❌
- [ ] 提现审批：✅ / ❌
- [ ] 数据持久化：✅ / ❌

---

## 常见问题

**Q: 数据库连接失败**
A: 确保 PostgreSQL 服务正在运行，检查 `.env.local` 中的 `DATABASE_URL` 是否正确。

**Q: 迁移失败**
A: 确保数据库已创建，运行 `createdb yesno_db`（如果使用 PostgreSQL）。

**Q: 测试数据不一致**
A: 检查 Prisma 客户端是否已重新生成（`npx prisma generate`），重启 Next.js 开发服务器。

