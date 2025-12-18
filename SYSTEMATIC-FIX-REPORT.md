# 🎯 预测市场资金&持仓系统修复报告

## 一、问题根因分析

### 问题1：资产显示逻辑混乱

**现象**：
- 顶部总资产/可用余额/总资产估值/持仓价值数值互相对不上
- 所有账户都固定显示：`(+$150.00 6.52% 过去 1D)`

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

**现象**：
- 市场详情页能看到持仓价值
- 总资产估值包含持仓
- 但「我的持仓（Your Position）」列表为空

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

**现象**：
- 卖出成功toast出现
- P&L已结算
- 但持仓仍显示
- 可以重复点击卖出（可无限套现）

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

**数据库Schema（必须添加）**：

```prisma
model Position {
  id              String   @id @default(uuid())
  userId          String
  marketId        String
  outcome         Outcome  // YES | NO
  shares          Float    @default(0.0)
  avgPrice        Float    @default(0.0)
  status          PositionStatus @default(OPEN)  // OPEN | CLOSED
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // 外键关联
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  market          Market   @relation(fields: [marketId], references: [id], onDelete: Cascade)

  @@unique([userId, marketId, outcome, status])  // 同一用户同一市场同一方向只能有一个OPEN持仓
  @@index([userId])
  @@index([marketId])
  @@index([status])
  @@map("positions")
}

enum PositionStatus {
  OPEN    // 持仓中
  CLOSED  // 已关闭（卖出或结算）
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
  INSERT INTO orders (id, userId, marketId, outcomeSelection, amount, feeDeducted)
  VALUES ('O-xxx', :userId, :marketId, 'YES', 100.00, 2.00);
  
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
- `Order` 表新增一条记录
- `Position` 表创建或更新（shares增加，avgPrice更新）

**是否产生lockedBalance**：
- ❌ **当前实现**：没有lockedBalance概念，直接扣除availableBalance
- ✅ **正确实现**：应该先锁定，订单成交后再扣除（但当前系统是即时成交，所以不需要）

**市场价格变化**：
- `yesPercent` 增加（因为 `totalYes` 增加）
- `noPercent` 减少（因为 `totalNo` 不变，但 `totalVolume` 增加）

**接口返回**：
```json
{
  "success": true,
  "data": {
    "order": { "id": "O-xxx", ... },
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
1. `POST /api/orders/sell` → **需要新建** `app/api/orders/sell/route.ts`

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
```prisma
enum PositionStatus {
  OPEN
  CLOSED
}

model Position {
  id              String         @id @default(uuid())
  userId          String
  marketId        String
  outcome         Outcome
  shares          Float          @default(0.0)
  avgPrice        Float          @default(0.0)
  status          PositionStatus @default(OPEN)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  user            User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  market          Market         @relation(fields: [marketId], references: [id], onDelete: Cascade)

  @@unique([userId, marketId, outcome, status])
  @@index([userId])
  @@index([marketId])
  @@index([status])
  @@map("positions")
}

// 在Order表中添加type字段
model Order {
  // ... 现有字段
  type            String?        @default("BUY")  // BUY | SELL
  // ...
}
```

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
```typescript
export async function POST(request: Request) {
  // 1. 身份验证
  const authResult = await extractUserIdFromToken();
  const userId = authResult.userId;

  // 2. 解析请求体
  const { marketId, outcome, shares } = await request.json();

  // 3. 查询OPEN Position
  const position = await prisma.position.findFirst({
    where: {
      userId,
      marketId,
      outcome: outcome as Outcome,
      status: 'OPEN',
    },
  });

  if (!position || position.shares < shares) {
    return NextResponse.json({ error: 'Insufficient shares' }, { status: 400 });
  }

  // 4. 事务：更新余额、更新市场、更新Position、创建Order
  await prisma.$transaction(async (tx) => {
    // ... 完整实现见上面场景C
  });
}
```

**改完后数据从哪里来**：
- 从Position表查询当前持仓
- 卖出后更新Position.status = CLOSED

#### 3. 修复买入API，创建Position

**文件**：`app/api/orders/route.ts`

**现在错在哪里**：
- ❌ 只创建Order，不创建/更新Position
- ❌ 没有Position状态机逻辑

**如何改**：
在事务中添加：
```typescript
// 创建或更新Position
const existingPosition = await tx.position.findFirst({
  where: {
    userId,
    marketId,
    outcome: outcomeSelection,
    status: 'OPEN',
  },
});

if (existingPosition) {
  // 更新现有Position
  const newShares = existingPosition.shares + calculatedShares;
  const newAvgPrice = (existingPosition.shares * existingPosition.avgPrice + calculatedShares * currentPrice) / newShares;
  
  await tx.position.update({
    where: { id: existingPosition.id },
    data: {
      shares: newShares,
      avgPrice: newAvgPrice,
    },
  });
} else {
  // 创建新Position
  await tx.position.create({
    data: {
      userId,
      marketId,
      outcome: outcomeSelection,
      shares: calculatedShares,
      avgPrice: currentPrice,
      status: 'OPEN',
    },
  });
}
```

**改完后数据从哪里来**：
- Position表：每次BUY后自动创建或更新

#### 4. 创建统一的资产汇总API

**文件**：`app/api/user/assets/route.ts`（已存在，需修复）

**现在错在哪里**：
- ❌ 从Order数组计算持仓价值（应该从Position表）
- ❌ 历史收益计算不准确

**如何改**：
```typescript
// 从Position表查询持仓
const positions = await prisma.position.findMany({
  where: {
    userId,
    status: 'OPEN',
  },
  include: {
    market: true,
  },
});

// 计算持仓价值
let positionsValue = 0;
for (const position of positions) {
  const currentPrice = position.outcome === 'YES' 
    ? position.market.totalYes / (position.market.totalYes + position.market.totalNo)
    : position.market.totalNo / (position.market.totalYes + position.market.totalNo);
  positionsValue += position.shares * currentPrice;
}

// 计算可用余额（从User.balance）
const availableBalance = user.balance;

// 计算锁定资金（待成交订单）
const lockedBalance = await prisma.order.findMany({
  where: {
    userId,
    status: 'PENDING', // 需要添加status字段
  },
}).then(orders => orders.reduce((sum, o) => sum + o.amount, 0));

// 总权益
const totalEquity = availableBalance + lockedBalance + positionsValue;
```

**改完后数据从哪里来**：
- Position表：查询OPEN状态的持仓
- User表：查询balance
- Order表：查询PENDING状态的订单

#### 5. 修复WalletPage，移除硬编码

**文件**：`app/wallet/page.tsx`

**现在错在哪里**：
- ❌ 硬编码 `pnlData`（第238-243行）
- ❌ 从多个数据源计算资产（不一致）

**如何改**：
```typescript
// 删除硬编码
// const pnlData = { ... }; // 删除

// 只从API获取
const [assetsData, setAssetsData] = useState(null);

useEffect(() => {
  fetch('/api/user/assets').then(res => res.json()).then(data => {
    setAssetsData(data.data);
  });
}, [currentUser?.id]);

// 使用API返回的数据
const totalBalance = assetsData?.totalEquity ?? 0;
const currentPnl = assetsData?.historical[timeRange]?.profit ?? { value: 0, percent: 0 };
```

**改完后数据从哪里来**：
- 100%从 `/api/user/assets` 获取
- 不再前端计算

#### 6. 修复市场详情页，从Position表查询

**文件**：`app/api/markets/[market_id]/route.ts`

**现在错在哪里**：
- ❌ 从Order数组实时计算持仓（第83-132行）
- ❌ 计算逻辑复杂且容易出错

**如何改**：
```typescript
// 从Position表查询
const position = await prisma.position.findFirst({
  where: {
    userId,
    marketId: market_id,
    status: 'OPEN',
  },
});

if (position) {
  userPosition = {
    yesShares: position.outcome === 'YES' ? position.shares : 0,
    noShares: position.outcome === 'NO' ? position.shares : 0,
    yesAvgPrice: position.outcome === 'YES' ? position.avgPrice : 0,
    noAvgPrice: position.outcome === 'NO' ? position.avgPrice : 0,
  };
}
```

**改完后数据从哪里来**：
- Position表：直接查询，不需要计算

#### 7. 修复前端持仓列表组件

**文件**：`app/wallet/page.tsx`（持仓列表部分）

**现在错在哪里**：
- ❌ 从 `storePositions` 或 `apiPositions` 数组显示
- ❌ 没有检查 `status`

**如何改**：
```typescript
// 从API获取持仓
const [positions, setPositions] = useState([]);

useEffect(() => {
  fetch('/api/positions').then(res => res.json()).then(data => {
    // 只显示OPEN状态的持仓
    setPositions(data.data.filter(p => p.status === 'OPEN'));
  });
}, [currentUser?.id]);
```

**改完后数据从哪里来**：
- `/api/positions` API（需要新建）
- 只返回 `status = 'OPEN'` 的持仓

#### 8. 创建持仓查询API

**文件**：`app/api/positions/route.ts`（新建）

**如何改**：
```typescript
export async function GET() {
  const authResult = await extractUserIdFromToken();
  const userId = authResult.userId;

  const positions = await prisma.position.findMany({
    where: {
      userId,
      status: 'OPEN',
    },
    include: {
      market: true,
    },
  });

  return NextResponse.json({
    success: true,
    data: positions.map(p => ({
      id: p.id,
      marketId: p.marketId,
      marketTitle: p.market.title,
      outcome: p.outcome,
      shares: p.shares,
      avgPrice: p.avgPrice,
      currentPrice: p.outcome === 'YES'
        ? p.market.totalYes / (p.market.totalYes + p.market.totalNo)
        : p.market.totalNo / (p.market.totalYes + p.market.totalNo),
      status: p.status,
    })),
  });
}
```

**改完后数据从哪里来**：
- Position表：直接查询

#### 9. 修复TradeSidebar，禁用已关闭持仓

**文件**：`components/market-detail/TradeSidebar.tsx`

**现在错在哪里**：
- ❌ 不检查Position.status
- ❌ 可以卖出已关闭的持仓

**如何改**：
```typescript
// 检查持仓状态
const canSell = userPosition && 
  userPosition.status === 'OPEN' && 
  userPosition.shares > 0;

// 按钮禁用
<button 
  disabled={!canSell || activeTab !== 'sell'}
  onClick={handleSell}
>
  卖出
</button>
```

**改完后数据从哪里来**：
- Position表：`status` 字段

#### 10. 修复StoreContext，移除前端模拟交易

**文件**：`app/context/StoreContext.tsx`

**现在错在哪里**：
- ❌ `executeTrade` 只是前端模拟，没有调用后端
- ❌ 卖出后只更新前端状态，后端不知道

**如何改**：
```typescript
const executeTrade = async (type, marketId, outcome, inputVal, price) => {
  // 调用后端API
  const response = await fetch(`/api/orders${type === 'sell' ? '/sell' : ''}`, {
    method: 'POST',
    body: JSON.stringify({ marketId, outcome, amount: inputVal }),
  });

  const result = await response.json();
  
  if (result.success) {
    // 刷新数据
    await fetchPositions();
    await fetchBalance();
  } else {
    // 回滚前端状态（如果有optimistic update）
    throw new Error(result.error);
  }
};
```

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

## 六、实施优先级

### P0（致命，必须立即修复）
1. 创建Position表和迁移脚本
2. 创建SELL API
3. 修复BUY API创建Position
4. 修复前端禁止卖出已关闭持仓

### P1（重要，本周内修复）
5. 修复资产汇总API使用Position表
6. 修复WalletPage移除硬编码
7. 修复市场详情页使用Position表

### P2（优化，下周修复）
8. 添加幂等校验
9. 添加并发锁
10. 优化历史收益计算

---

## 七、测试验证清单

### 功能测试
- [ ] 用户充值后，availableBalance正确增加
- [ ] 用户下注后，Position正确创建，shares和avgPrice正确
- [ ] 用户卖出后，Position.status变为CLOSED，shares归零
- [ ] 已关闭的持仓不能再次卖出
- [ ] 资产汇总API返回正确的totalEquity

### 安全测试
- [ ] 不能卖出其他用户的持仓
- [ ] 不能卖出超过持有的份额
- [ ] 重复卖出请求被拒绝（幂等）
- [ ] 并发卖出请求被正确处理（锁）

### 数据一致性测试
- [ ] 市场详情页和钱包页显示的持仓一致
- [ ] 资产估值和实际持仓价值一致
- [ ] 历史收益计算准确
