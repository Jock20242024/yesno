# 🎯 预测市场资金&持仓系统完整修复方案

## 一、问题根因分析

### 问题1：资产显示逻辑混乱

**真实工程级原因**：

1. **数值来源混乱，口径不一致**
   - ✅ **实时计算**：`availableBalance` 从 `User.balance` 读取（数据库实时值）
   - ❌ **硬编码/Mock**：`pnlData` 在 `app/wallet/page.tsx:238-243` 完全写死
   - ❌ **前端自行计算**：`positionsValue` 在 `app/wallet/page.tsx:161-230` 从 `apiPositions` 数组手动计算
   - ❌ **后端也在算**：`app/api/user/assets/route.ts` 也在计算 `positionsValue`
   - ❌ **StoreContext 也在算**：`app/context/StoreContext.tsx:181-227` 从 `storePositions` 计算
   - **结果**：4个不同数据源，4种不同计算逻辑，必然不一致

2. **缺少统一的资金四分账模型**
   - 当前只有 `User.balance` 一个字段
   - 没有区分 `availableBalance`、`lockedBalance`、`positionValue`
   - 前端只能"猜"资产构成

3. **历史收益计算完全错误**
   - `app/wallet/page.tsx:238-243` 硬编码所有用户的收益
   - `app/api/user/assets/route.ts` 的历史计算基于简化假设，不准确

### 问题2：事件详情页&资产估值有持仓，但「我的持仓」为空

**真实工程级原因**：

1. **使用了不同API，不同数据源**
   - **市场详情页**：`app/api/markets/[market_id]/route.ts:83-132` 从 `DBService.findOrdersByUserId()` 实时计算持仓
   - **资产估值**：`app/api/user/assets/route.ts:62-109` 从 `orders` 计算持仓价值
   - **我的持仓列表**：`app/wallet/page.tsx:45-98` 从 `/api/orders/user` 获取订单，然后手动计算
   - **结果**：3个不同API，3种不同计算逻辑，可能返回不一致结果

2. **没有Position聚合表/视图层**
   - ❌ **数据库没有Position表**：`prisma/schema.prisma` 只有 `Order` 表，没有 `Position` 表
   - ❌ **每次都是实时计算**：从 `Order` 数组聚合计算，性能差且容易出错
   - ❌ **没有缓存层**：每次查询都要遍历所有订单

3. **计算逻辑不一致**
   - `app/api/markets/[market_id]/route.ts:95-100` 使用 `currentPrice = market.totalYes / (market.totalYes + market.totalNo)`
   - `app/api/user/assets/route.ts:89-91` 使用相同逻辑但可能市场状态不同
   - `app/wallet/page.tsx:169-175` 使用 `order.amount - order.feeDeducted` 简化计算
   - **结果**：同一持仓在不同页面显示不同值

### 问题3：卖出成功后，持仓仍存在且可重复卖出（致命漏洞）

**真实工程级原因**：

1. **没有Position状态机**
   - ❌ **数据库没有Position表**：无法记录 `status: OPEN | CLOSED`
   - ❌ **没有状态转换逻辑**：卖出后不知道如何标记持仓为已关闭
   - ❌ **前端无法判断**：无法知道持仓是否已卖出

2. **卖出只记了trade，没有更新position**
   - ❌ **没有真正的SELL API**：`app/api/trade/route.ts:247-254` SELL被禁用
   - ❌ **`/api/orders` 只处理BUY**：`app/api/orders/route.ts` 没有SELL逻辑
   - ❌ **前端只是模拟**：`app/context/StoreContext.tsx:309-360` 的 `executeTrade` 只是前端状态更新，没有调用后端
   - **结果**：卖出操作只在前端模拟，后端数据库没有记录，持仓永远存在

3. **前端optimistic UI没回滚**
   - `app/context/StoreContext.tsx:321-338` 卖出后立即更新前端状态
   - 但如果后端API失败，没有回滚机制
   - 用户看到"卖出成功"，但实际没有执行

4. **后端没有幂等校验**
   - ❌ **没有订单ID去重**：可以重复提交相同卖出请求
   - ❌ **没有持仓检查**：不检查用户是否真的有足够持仓
   - ❌ **没有并发锁**：多个请求可以同时卖出同一持仓
   - **结果**：可以无限套现

---

## 二、正确的数据模型（资金+持仓）

### 1️⃣ 资金四分账模型（强制）

```typescript
interface UserBalance {
  // 可用余额（可下注、可提现）
  availableBalance: number;
  
  // 已下单但未结算（锁定资金）
  lockedBalance: number;
  
  // 当前持仓市值（浮动，基于市场价格）
  positionValue: number;
  
  // 总权益 = available + locked + positionValue
  totalEquity: number;
}
```

**资金变化规则**：

| 行为 | availableBalance | lockedBalance | positionValue | totalEquity |
|------|------------------|---------------|---------------|-------------|
| **充值** | +amount | 不变 | 不变 | +amount |
| **提现** | -amount | 不变 | 不变 | -amount |
| **下注（BUY）** | -amount | +amount | 不变 | 不变 |
| **订单成交** | 不变 | -amount | +shares * currentPrice | +shares * currentPrice |
| **卖出（SELL）** | +netReturn | 不变 | -shares * currentPrice | +netReturn - shares * currentPrice |
| **市场结算** | +payout | 不变 | 0（已结算） | +payout |

**禁止规则**：
- ❌ 禁止直接修改 `totalEquity`（必须通过其他三个字段计算）
- ❌ 禁止 `availableBalance` 和 `lockedBalance` 同时变化（必须分两步）
- ❌ 禁止 `positionValue` 为负数

### 2️⃣ 持仓Position必须是"状态机"，不是数组

**数据库Schema**：

```prisma
enum PositionStatus {
  OPEN    // 持仓中
  CLOSED  // 已关闭（卖出或结算）
}

model Position {
  id              String         @id @default(uuid())
  userId          String
  marketId        String
  outcome         Outcome        // YES | NO
  shares          Float          @default(0.0)
  avgPrice        Float          @default(0.0)
  status          PositionStatus @default(OPEN)  // OPEN | CLOSED
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  // 外键关联
  user            User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  market          Market         @relation(fields: [marketId], references: [id], onDelete: Cascade)

  @@unique([userId, marketId, outcome, status])  // 同一用户同一市场同一方向只能有一个OPEN持仓
  @@index([userId])
  @@index([marketId])
  @@index([status])
  @@map("positions")
}
```

**状态机规则**：

```
初始状态：不存在Position记录

BUY操作：
  - 如果不存在OPEN Position → 创建新Position (status=OPEN, shares>0)
  - 如果已存在OPEN Position → 更新shares和avgPrice（加权平均）

SELL操作：
  - 检查是否存在OPEN Position且shares >= sellShares
  - 更新shares = shares - sellShares
  - 如果shares <= 0 → status = CLOSED
  - 如果shares > 0 → 保持status = OPEN

市场结算：
  - 所有OPEN Position → status = CLOSED
  - 计算payout并更新User.balance
```

**强制规则**：
- ✅ `shares = 0` 的Position必须 `status = CLOSED`
- ✅ `status = CLOSED` 的Position前端绝不能显示可操作按钮
- ✅ 同一用户同一市场同一方向只能有一个 `status = OPEN` 的Position

### 3️⃣ Trade只是流水，不是状态

```typescript
interface Trade {
  id: string;
  userId: string;
  marketId: string;
  type: 'BUY' | 'SELL';
  shares: number;
  price: number;
  amount: number;  // 交易金额
  feeDeducted: number;
  timestamp: string;
}
```

**Trade与Position的关系**：
- ✅ Trade是**历史流水**，记录每笔交易
- ✅ Position是**当前状态**，记录当前持仓
- ✅ UI的"我的持仓"**100%只能来自Position表**，不允许从Trade计算
- ✅ Trade用于**审计和查询历史**，不用于显示当前持仓

---

## 三、完整资金路径因果链

### 场景A：用户充值1000U

**后端API调用**：
1. `POST /api/deposit` → `app/api/deposit/route.ts`

**数据库操作**：
```sql
BEGIN TRANSACTION;
  -- 1. 锁定用户记录
  SELECT * FROM users WHERE id = :userId FOR UPDATE;
  
  -- 2. 更新可用余额
  UPDATE users SET balance = balance + 1000.00 WHERE id = :userId;
  
  -- 3. 创建Deposit记录
  INSERT INTO deposits (id, userId, amount, status, createdAt)
  VALUES ('D-xxx', :userId, 1000.00, 'COMPLETED', NOW());
COMMIT;
```

**字段变化**：
- `User.balance`: `0.00` → `1000.00`
- `Deposit` 表新增一条记录

**前端状态刷新**：
1. `AuthProvider.updateBalance("$1000.00")` → 更新 `currentUser.balance`
2. `StoreContext` 从 `localStorage` 恢复或等待API同步
3. `WalletPage` 调用 `/api/user/assets` 获取最新资产

**UI立即更新**：
- ✅ 顶部导航栏余额：`$0.00` → `$1000.00`
- ✅ 钱包页可用余额：`$0.00` → `$1000.00`
- ✅ 钱包页总资产：`$0.00` → `$1000.00`
- ✅ 交易侧边栏可用余额：`$0.00` → `$1000.00`

### 场景B：用户下注100U（BUY YES）

**后端API调用**：
1. `POST /api/orders` → `app/api/orders/route.ts`

**数据库操作**：
```sql
BEGIN TRANSACTION;
  -- 1. 锁定用户记录
  SELECT * FROM users WHERE id = :userId FOR UPDATE;
  
  -- 2. 检查余额
  IF user.balance < 100.00 THEN ROLLBACK; END IF;
  
  -- 3. 扣除可用余额
  UPDATE users SET balance = balance - 100.00 WHERE id = :userId;
  
  -- 4. 更新市场池
  UPDATE markets SET 
    totalVolume = totalVolume + 100.00,
    totalYes = totalYes + 98.00  -- 扣除2%手续费
  WHERE id = :marketId;
  
  -- 5. 创建Order记录
  INSERT INTO orders (id, userId, marketId, outcomeSelection, amount, feeDeducted, type)
  VALUES ('O-xxx', :userId, :marketId, 'YES', 100.00, 2.00, 'BUY');
  
  -- 6. 创建或更新Position
  INSERT INTO positions (id, userId, marketId, outcome, shares, avgPrice, status)
  VALUES (
    'P-xxx',
    :userId,
    :marketId,
    'YES',
    -- 计算份额：98.00 / currentPrice
    (98.00 / (SELECT totalYes / (totalYes + totalNo) FROM markets WHERE id = :marketId)),
    -- 平均价格：当前市场价格
    (SELECT totalYes / (totalYes + totalNo) FROM markets WHERE id = :marketId),
    'OPEN'
  )
  ON CONFLICT (userId, marketId, outcome, status) WHERE status = 'OPEN'
  DO UPDATE SET
    shares = positions.shares + EXCLUDED.shares,
    avgPrice = (positions.shares * positions.avgPrice + EXCLUDED.shares * EXCLUDED.avgPrice) / (positions.shares + EXCLUDED.shares);
COMMIT;
```

**字段变化**：
- `User.balance`: `1000.00` → `900.00` (availableBalance)
- `Market.totalVolume`: `+100.00`
- `Market.totalYes`: `+98.00`
- `Order` 表新增一条记录（type='BUY'）
- `Position` 表创建或更新（shares增加，avgPrice更新，status='OPEN'）

**是否产生lockedBalance**：
- ❌ **当前实现**：没有lockedBalance概念，直接扣除availableBalance（即时成交）
- ✅ **正确实现**：如果系统支持挂单，应该先锁定，订单成交后再扣除

**市场价格变化**：
- `yesPercent` 增加（因为 `totalYes` 增加）
- `noPercent` 减少（因为 `totalNo` 不变，但 `totalVolume` 增加）

**接口返回**：
```json
{
  "success": true,
  "data": {
    "order": { "id": "O-xxx", "type": "BUY", ... },
    "updatedBalance": 900.00,
    "updatedMarket": {
      "totalVolume": 1100.00,
      "totalYes": 598.00,
      "totalNo": 500.00
    },
    "position": {
      "shares": 196.00,
      "avgPrice": 0.51,
      "status": "OPEN"
    }
  }
}
```

### 场景C：用户卖出全部仓位

**后端API调用**：
1. `POST /api/orders/sell` → `app/api/orders/sell/route.ts`（新建）

**数据库操作**：
```sql
BEGIN TRANSACTION;
  -- 1. 锁定用户记录和Position记录
  SELECT * FROM users WHERE id = :userId FOR UPDATE;
  SELECT * FROM positions 
  WHERE userId = :userId AND marketId = :marketId AND outcome = :outcome AND status = 'OPEN'
  FOR UPDATE;
  
  -- 2. 检查持仓
  IF position.shares < sellShares THEN ROLLBACK; END IF;
  
  -- 3. 计算卖出金额（扣除手续费）
  SET sellAmount = sellShares * currentPrice * (1 - 0.02);
  
  -- 4. 增加可用余额
  UPDATE users SET balance = balance + sellAmount WHERE id = :userId;
  
  -- 5. 更新市场池（反向操作）
  UPDATE markets SET 
    totalVolume = totalVolume - sellAmount,
    totalYes = totalYes - (sellShares * currentPrice)  -- 如果是YES
  WHERE id = :marketId;
  
  -- 6. 创建Order记录（SELL类型）
  INSERT INTO orders (id, userId, marketId, outcomeSelection, amount, feeDeducted, type)
  VALUES ('O-xxx', :userId, :marketId, :outcome, sellAmount, sellAmount * 0.02, 'SELL');
  
  -- 7. 更新Position
  UPDATE positions SET
    shares = shares - sellShares,
    status = CASE 
      WHEN shares - sellShares <= 0.001 THEN 'CLOSED'
      ELSE 'OPEN'
    END,
    updatedAt = NOW()
  WHERE id = :positionId;
COMMIT;
```

**Position状态转换**：
- `status`: `OPEN` → `CLOSED` (如果shares <= 0)
- `shares`: `196.00` → `0.00`

**availableBalance变化**：
- `900.00` → `900.00 + (196.00 * 0.51 * 0.98) = 900.00 + 98.04 = 998.04`

**positionValue变化**：
- `196.00 * 0.51 = 99.96` → `0.00` (因为status=CLOSED)

**UI禁止二次卖出**：
```typescript
// 前端检查
const canSell = position.status === 'OPEN' && position.shares > 0;

// 按钮禁用
<button disabled={!canSell} onClick={handleSell}>
  卖出
</button>
```

**幂等校验**：
```typescript
// 后端API添加幂等校验
const existingSellOrder = await prisma.order.findFirst({
  where: {
    userId,
    marketId,
    outcomeSelection: outcome,
    type: 'SELL',
    createdAt: {
      gte: new Date(Date.now() - 5000) // 5秒内的重复请求
    }
  }
});

if (existingSellOrder) {
  return NextResponse.json({
    success: false,
    error: 'Duplicate sell request detected',
  }, { status: 409 });
}
```

---

## 四、精确到文件级的修复清单

### ✅ 必须修改的文件列表

#### 1. 数据库Schema修复

**文件**：`prisma/schema.prisma`

**现在错在哪里**：
- ❌ 没有 `Position` 表
- ❌ 没有 `PositionStatus` 枚举
- ❌ `Order` 表没有 `type` 字段区分BUY/SELL

**如何改**：
- ✅ 添加 `PositionStatus` 枚举
- ✅ 添加 `Position` 模型
- ✅ 在 `Order` 模型中添加 `type` 字段
- ✅ 在 `User` 和 `Market` 模型中添加 `positions` 关联

**改完后数据从哪里来**：
- Position表：从数据库查询 `SELECT * FROM positions WHERE userId = :userId AND status = 'OPEN'`
- 不再从Order数组实时计算

#### 2. 创建卖出API

**文件**：`app/api/orders/sell/route.ts`（新建）

**现在错在哪里**：
- ❌ 没有真正的SELL API
- ❌ `/api/trade` 的SELL被禁用
- ❌ `/api/orders` 只处理BUY

**如何改**：
- ✅ 创建完整的SELL API实现
- ✅ 查询OPEN Position
- ✅ 检查持仓是否足够
- ✅ 更新Position.status = CLOSED（如果shares <= 0）
- ✅ 创建SELL类型的Order记录
- ✅ 更新User.balance和Market池

**改完后数据从哪里来**：
- Position表：查询当前持仓
- 卖出后更新Position.status = CLOSED

#### 3. 修复买入API，创建Position

**文件**：`app/api/orders/route.ts`

**现在错在哪里**：
- ❌ 只创建Order，不创建/更新Position
- ❌ 没有Position状态机逻辑

**如何改**：
- ✅ 在事务中添加Position创建/更新逻辑
- ✅ 如果存在OPEN Position，更新shares和avgPrice（加权平均）
- ✅ 如果不存在，创建新Position

**改完后数据从哪里来**：
- Position表：每次BUY后自动创建或更新

#### 4. 创建持仓查询API

**文件**：`app/api/positions/route.ts`（新建）

**现在错在哪里**：
- ❌ 没有专门的持仓查询API
- ❌ 前端从Order数组计算持仓

**如何改**：
- ✅ 从Position表查询OPEN状态的持仓
- ✅ 计算当前市场价格和价值
- ✅ 返回完整的持仓信息（包括status）

**改完后数据从哪里来**：
- Position表：直接查询，不需要计算

#### 5. 修复资产汇总API，使用Position表

**文件**：`app/api/user/assets/route.ts`

**现在错在哪里**：
- ❌ 从Order数组计算持仓价值（应该从Position表）
- ❌ 历史收益计算不准确

**如何改**：
- ✅ 从Position表查询OPEN状态的持仓
- ✅ 计算持仓价值（基于当前市场价格）
- ✅ 计算可用余额（从User.balance）
- ✅ 计算锁定资金（待成交订单，如果有）
- ✅ 总权益 = availableBalance + lockedBalance + positionsValue

**改完后数据从哪里来**：
- Position表：查询OPEN状态的持仓
- User表：查询balance
- Order表：查询PENDING状态的订单（如果有）

#### 6. 修复WalletPage，移除硬编码

**文件**：`app/wallet/page.tsx`

**现在错在哪里**：
- ❌ 硬编码 `pnlData`（第238-243行）
- ❌ 从多个数据源计算资产（不一致）

**如何改**：
- ✅ 删除硬编码 `pnlData`
- ✅ 只从 `/api/user/assets` 获取资产数据
- ✅ 只从 `/api/positions` 获取持仓列表
- ✅ 使用API返回的收益数据

**改完后数据从哪里来**：
- 100%从 `/api/user/assets` 获取资产
- 100%从 `/api/positions` 获取持仓

#### 7. 修复市场详情页，从Position表查询

**文件**：`app/api/markets/[market_id]/route.ts`

**现在错在哪里**：
- ❌ 从Order数组实时计算持仓（第83-132行）
- ❌ 计算逻辑复杂且容易出错

**如何改**：
- ✅ 从Position表查询OPEN状态的持仓
- ✅ 直接返回Position数据，不需要计算

**改完后数据从哪里来**：
- Position表：直接查询，不需要计算

#### 8. 修复TradeSidebar，禁用已关闭持仓

**文件**：`components/market-detail/TradeSidebar.tsx`

**现在错在哪里**：
- ❌ 不检查Position.status
- ❌ 可以卖出已关闭的持仓

**如何改**：
- ✅ 检查 `userPosition.status === 'OPEN'`
- ✅ 检查 `userPosition.shares > 0`
- ✅ 按钮禁用条件：`disabled={!canSell}`

**改完后数据从哪里来**：
- Position表：`status` 字段

#### 9. 修复StoreContext，移除前端模拟交易

**文件**：`app/context/StoreContext.tsx`

**现在错在哪里**：
- ❌ `executeTrade` 只是前端模拟，没有调用后端
- ❌ 卖出后只更新前端状态，后端不知道

**如何改**：
- ✅ `executeTrade` 调用后端API
- ✅ BUY调用 `/api/orders`
- ✅ SELL调用 `/api/orders/sell`
- ✅ 成功后刷新数据，失败时回滚

**改完后数据从哪里来**：
- 后端API：所有交易都通过后端
- 前端只负责显示

---

## 五、强制要求（不满足视为失败）

- ✅ **不允许使用mockData**：所有数据从数据库获取
- ✅ **不允许前端自行"猜"资产**：所有资产计算在后端完成
- ✅ **不允许一个UI用多个口径**：所有UI组件使用同一个API
- ✅ **不允许SELL不改变position**：SELL必须更新Position.status = CLOSED
- ✅ **不允许CLOSED position可操作**：前端必须检查status字段

---

## 六、实施步骤

### 步骤1：数据库迁移（P0）

```bash
# 1. 更新Prisma Schema
# 编辑 prisma/schema.prisma，添加Position表和PositionStatus枚举

# 2. 创建迁移
npx prisma migrate dev --name add_position_table

# 3. 或者直接执行SQL
psql $DATABASE_URL < prisma/migrations/add_position_table.sql
```

### 步骤2：修复API（P0）

1. **修复买入API**：`app/api/orders/route.ts` ✅ 已完成
2. **创建卖出API**：`app/api/orders/sell/route.ts` ✅ 已完成
3. **创建持仓查询API**：`app/api/positions/route.ts` ✅ 已完成
4. **修复资产汇总API**：`app/api/user/assets/route.ts` ✅ 需要更新使用Position表

### 步骤3：修复前端（P1）

1. **修复WalletPage**：移除硬编码，使用API数据
2. **修复TradeSidebar**：添加status检查
3. **修复市场详情页**：从Position表查询

### 步骤4：测试验证（P0）

- [ ] 测试买入创建Position
- [ ] 测试卖出更新Position.status = CLOSED
- [ ] 测试已关闭持仓不能卖出
- [ ] 测试资产显示一致

---

## 七、关键检查点

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

## 八、回滚方案

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

## 九、注意事项

1. **数据迁移**：现有Order数据需要迁移到Position表（见迁移SQL）
2. **并发安全**：所有交易操作必须使用数据库事务和锁
3. **幂等性**：SELL API需要添加幂等校验（防止重复卖出）
4. **性能优化**：Position表已添加索引，查询性能应该良好
