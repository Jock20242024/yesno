# 修复实施指南

## 快速开始

### 步骤1：数据库迁移

```bash
# 1. 更新Prisma Schema
# 编辑 prisma/schema.prisma，添加Position表和PositionStatus枚举
# （见 SYSTEMATIC-FIX-REPORT.md 第二部分）

# 2. 创建迁移
npx prisma migrate dev --name add_position_table

# 3. 或者直接执行SQL
psql $DATABASE_URL < prisma/migrations/add_position_table.sql
```

### 步骤2：修复API

1. **修复买入API**：`app/api/orders/route.ts`
   - 已在代码中添加Position创建逻辑
   - 确保每次BUY后创建或更新Position

2. **创建卖出API**：`app/api/orders/sell/route.ts`
   - 已创建完整实现
   - 确保SELL后更新Position.status = CLOSED

3. **创建持仓查询API**：`app/api/positions/route.ts`
   - 已创建完整实现
   - 只返回OPEN状态的持仓

### 步骤3：修复前端

1. **修复WalletPage**：`app/wallet/page.tsx`
   - 移除硬编码pnlData
   - 从 `/api/user/assets` 获取资产数据
   - 从 `/api/positions` 获取持仓列表

2. **修复TradeSidebar**：`components/market-detail/TradeSidebar.tsx`
   - 添加status检查
   - 禁用已关闭持仓的卖出按钮

3. **修复市场详情页**：`app/api/markets/[market_id]/route.ts`
   - 从Position表查询持仓，不再从Order计算

### 步骤4：测试验证

```bash
# 1. 测试买入
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"marketId": "...", "outcomeSelection": "YES", "amount": 100}'

# 2. 测试卖出
curl -X POST http://localhost:3000/api/orders/sell \
  -H "Content-Type: application/json" \
  -d '{"marketId": "...", "outcome": "YES", "shares": 50}'

# 3. 测试持仓查询
curl http://localhost:3000/api/positions

# 4. 测试资产汇总
curl http://localhost:3000/api/user/assets
```

---

## 关键检查点

### ✅ 数据库检查

```sql
-- 检查Position表是否存在
SELECT * FROM positions LIMIT 1;

-- 检查是否有OPEN状态的持仓
SELECT COUNT(*) FROM positions WHERE status = 'OPEN';

-- 检查是否有CLOSED状态的持仓
SELECT COUNT(*) FROM positions WHERE status = 'CLOSED';
```

### ✅ API检查

- [ ] `/api/orders` (BUY) 创建Position记录
- [ ] `/api/orders/sell` (SELL) 更新Position.status = CLOSED
- [ ] `/api/positions` 只返回OPEN状态的持仓
- [ ] `/api/user/assets` 从Position表计算持仓价值

### ✅ 前端检查

- [ ] WalletPage不再有硬编码pnlData
- [ ] 持仓列表只显示OPEN状态的持仓
- [ ] 已关闭持仓不能卖出
- [ ] 资产显示一致（所有组件使用同一API）

---

## 回滚方案

如果修复出现问题，可以回滚：

```sql
-- 1. 删除Position表
DROP TABLE IF EXISTS positions;

-- 2. 删除枚举类型
DROP TYPE IF EXISTS "PositionStatus";

-- 3. 恢复Order表（如果需要）
ALTER TABLE orders DROP COLUMN IF EXISTS type;
```

---

## 注意事项

1. **数据迁移**：现有Order数据需要迁移到Position表（见迁移SQL）
2. **并发安全**：所有交易操作必须使用数据库事务和锁
3. **幂等性**：SELL API需要添加幂等校验（防止重复卖出）
4. **性能优化**：Position表已添加索引，查询性能应该良好
