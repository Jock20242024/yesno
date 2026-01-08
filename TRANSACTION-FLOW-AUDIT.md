# 🔥 交易流程原子化操作审计报告

## 一、核心操作流程图（原子化操作）

```
用户下单 (POST /api/orders)
    ↓
[事务开始: executeTransaction]
    ↓
┌─────────────────────────────────────────┐
│ 1. Users 表：扣除用户余额                │
│    balance = balance - orderAmount       │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ 2. Users 表（Fee账户）：增加手续费        │
│    balance = balance + feeDeducted      │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ 3. Users 表（AMM账户）：增加净投资额      │
│    balance = balance + (amount - fee)   │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ 4. Orders 表：创建订单记录                │
│    status = 'FILLED' (MARKET)           │
│    或 'PENDING' (LIMIT)                 │
│    filledAmount = calculatedShares      │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ 5. Positions 表：创建或更新持仓          │
│    - 如果不存在：INSERT 新记录           │
│    - 如果存在：UPDATE shares 和 avgPrice │
│    avgPrice = (oldCost + newCost) /      │
│                (oldShares + newShares)   │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ 6. Transactions 表：记录流水              │
│    - 用户交易记录（扣除金额）            │
│    - 手续费账户收入记录                  │
│    - AMM 资金池存入记录                  │
└─────────────────────────────────────────┘
    ↓
[事务提交]
```

## 二、详细操作步骤与代码逻辑验证

### ✅ 步骤 1：Users 表 - 扣除用户余额

**代码位置**: `app/api/orders/route.ts:316-319`

```typescript
const updatedUser = await tx.users.update({
  where: { id: userId },
  data: { balance: newBalance },
});
```

**验证结果**: ✅ **正确**
- ✅ 在事务中执行
- ✅ 使用高精度计算（转换为分，避免浮点数误差）
- ✅ 余额检查：`if (newBalanceCents < 0) throw new Error('Insufficient balance')`

---

### ✅ 步骤 2：Users 表（Fee账户）- 增加手续费

**代码位置**: `app/api/orders/route.ts:326-329`

```typescript
await tx.users.update({
  where: { id: feeAccount.id },
  data: { balance: newFeeBalance },
});
```

**验证结果**: ✅ **正确**
- ✅ 在事务中执行
- ✅ 手续费计算：`feeDeducted = amount * effectiveFeeRate`
- ✅ 手续费账户余额增加：`newFeeBalance = feeAccount.balance + feeDeducted`

---

### ✅ 步骤 3：Users 表（AMM账户）- 增加净投资额

**代码位置**: `app/api/orders/route.ts:337-340`

```typescript
await tx.users.update({
  where: { id: ammAccount.id },
  data: { balance: newAmmBalance },
});
```

**验证结果**: ✅ **正确**
- ✅ 在事务中执行
- ✅ 净投资额计算：`netAmount = amount - feeDeducted`
- ✅ AMM 账户余额增加：`newAmmBalance = ammAccount.balance + netAmount`
- ✅ **关键修复**：对于 LIMIT 订单，资金也会先转入 AMM 池（但 Market 的 totalYes/totalNo 不更新）

---

### ✅ 步骤 4：Orders 表 - 创建订单记录

**代码位置**: `app/api/orders/route.ts:491-493`

```typescript
const newOrder = await tx.orders.create({
  data: orderData,
});
```

**验证结果**: ✅ **正确**
- ✅ 在事务中执行
- ✅ 订单状态：
  - MARKET 订单：`status = 'FILLED'`
  - LIMIT 订单：`status = 'PENDING'`
- ✅ 记录字段：
  - `amount`: 订单总金额
  - `feeDeducted`: 扣除的手续费
  - `filledAmount`: 实际成交的份额数（MARKET订单有值，LIMIT订单为0）
  - `type`: 'BUY' 或 'SELL'

---

### ✅ 步骤 5：Positions 表 - 创建或更新持仓

**代码位置**: `app/api/orders/route.ts:559-644`

#### 5.1 查询现有持仓
```typescript
const existingPosition = await tx.positions.findFirst({
  where: {
    userId,
    marketId,
    outcome: outcomeSelection,
    status: 'OPEN',
  },
});
```

#### 5.2 更新现有持仓
```typescript
if (existingPosition) {
  const existingNetAmount = existingPosition.shares * existingPosition.avgPrice;
  const newTotalNetAmount = existingNetAmount + netAmount;
  const newShares = existingPosition.shares + calculatedShares;
  const newAvgPrice = newShares > 0 ? newTotalNetAmount / newShares : executionPrice;
  
  updatedPosition = await tx.positions.update({
    where: { id: existingPosition.id },
    data: {
      shares: newShares,
      avgPrice: newAvgPrice,
    },
  });
}
```

#### 5.3 创建新持仓
```typescript
else {
  const correctAvgPrice = calculatedShares > 0 ? netAmount / calculatedShares : executionPrice;
  
  updatedPosition = await tx.positions.create({
    data: {
      id: positionId,
      userId,
      marketId,
      outcome: outcomeSelection,
      shares: calculatedShares,
      avgPrice: correctAvgPrice,
      status: 'OPEN',
    },
  });
}
```

**验证结果**: ✅ **正确**
- ✅ 在事务中执行
- ✅ 平均价格计算正确：`avgPrice = 总净投入金额 / 总份额`
- ✅ 只有 MARKET 订单才创建/更新 Position（LIMIT 订单不创建）

---

### ✅ 步骤 6：Transactions 表 - 记录流水

**代码位置**: `app/api/orders/route.ts:510-543`

#### 6.1 用户交易记录
```typescript
await tx.transactions.create({
  data: {
    userId: userId,
    amount: -amountNum, // 负数表示扣除
    type: TransactionType.BET,
    reason: `Buy ${outcomeSelection} on ${market.title}`,
    status: TransactionStatus.COMPLETED,
  },
});
```

#### 6.2 手续费账户收入记录
```typescript
await tx.transactions.create({
  data: {
    userId: feeAccount.id,
    amount: feeDeducted, // 正数表示收入
    type: TransactionType.ADMIN_ADJUSTMENT,
    reason: `Fee income from Order ${orderId}`,
    status: TransactionStatus.COMPLETED,
  },
});
```

#### 6.3 AMM 资金池存入记录
```typescript
await tx.transactions.create({
  data: {
    userId: ammAccount.id,
    amount: netAmount, // 正数表示存入
    type: TransactionType.ADMIN_ADJUSTMENT,
    reason: `Pool deposit from Order ${orderId}`,
    status: TransactionStatus.COMPLETED,
  },
});
```

**验证结果**: ✅ **正确**
- ✅ 在事务中执行
- ✅ 三条流水记录完整
- ✅ 金额符号正确（用户扣除为负，系统账户收入为正）

---

## 三、卖出订单流程验证

### ✅ 卖出订单（SELL）流程

**代码位置**: `app/api/orders/sell/route.ts`

#### 关键步骤：

1. **用户余额增加**（净收益）
   ```typescript
   await tx.users.update({
     where: { id: userId },
     data: { balance: newUserBalance }, // 增加 netReturn
   });
   ```

2. **手续费账户增加**
   ```typescript
   await tx.users.update({
     where: { id: feeAccount.id },
     data: { balance: newFeeBalance }, // 增加 feeDeducted
   });
   ```

3. **AMM 账户减少**（支付给用户的总金额）
   ```typescript
   await tx.users.update({
     where: { id: ammAccount.id },
     data: { balance: newAmmBalance }, // 减少 grossValue
   });
   ```

4. **创建订单记录**
   ```typescript
   await tx.orders.create({
     data: {
       amount: grossValue, // 用户收到的总金额
       feeDeducted,
       type: 'SELL',
       status: 'FILLED',
     },
   });
   ```

**验证结果**: ✅ **正确**
- ✅ 所有操作都在事务中执行
- ✅ AMM 池减少的是 `grossValue`（用户收到的总金额）
- ✅ 订单表中的 `amount` 字段存储的是 `grossValue`

---

## 四、对账逻辑验证

### ✅ 对账公式

**代码位置**: `app/api/admin/system-accounts/reconcile/route.ts`

#### AMM 账户对账公式：

```
AMM 账户余额 = 初始流动性 + 所有买入订单(amount - feeDeducted) - 所有卖出订单(amount)
```

**验证**：
- ✅ 买入订单：AMM 池增加 `amount - feeDeducted`（净投资额）
- ✅ 卖出订单：AMM 池减少 `amount`（因为 `amount` 字段存储的是 `grossValue`）
- ✅ 对账逻辑：统计所有 `transactions` 记录的总和，与 `users` 表中的余额对比

#### 对账代码：

```typescript
const transactions = await prisma.transactions.findMany({
  where: { userId: account.id },
});

const transactionSum = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
const currentBalance = Number(account.balance);
const difference = Math.abs(currentBalance - transactionSum);
const isBalanced = difference <= 0.01; // 允许 0.01 的误差
```

**验证结果**: ✅ **正确**
- ✅ 对账逻辑正确
- ✅ 允许 0.01 的误差（浮点数精度问题）
- ✅ 如果差异 > 0.01，标记为异常

---

## 五、潜在问题与修复建议

### ⚠️ 问题 1：LIMIT 订单的资金处理

**当前逻辑**：
- LIMIT 订单：资金先转入 AMM 池，但 Market 的 totalYes/totalNo 不更新
- 只有当订单被撮合成交时，才创建 Position 和更新 Market

**验证结果**: ✅ **正确**
- ✅ 这是合理的，因为 LIMIT 订单还未成交
- ✅ 资金已冻结在 AMM 池中，等待撮合

---

### ⚠️ 问题 2：卖出订单的 amount 字段

**当前逻辑**：
- 卖出订单的 `amount` 字段存储的是 `grossValue`（用户收到的总金额）
- AMM 池减少的是 `grossValue`

**验证结果**: ✅ **正确**
- ✅ 这与买入订单的逻辑一致
- ✅ 对账公式已修正：卖出订单减少 `amount`（不是 `amount + feeDeducted`）

---

### ⚠️ 问题 3：初始流动性处理

**当前逻辑**：
- 市场创建时，初始流动性从 `system.liquidity@yesno.com` 扣除
- 同时增加到 `system.amm@yesno.com`

**验证结果**: ✅ **正确**
- ✅ 初始流动性已记录在 `transactions` 表中
- ✅ 对账时会包含初始流动性

---

## 六、总结

### ✅ 所有步骤都已正确实现

1. ✅ **原子化操作**：所有步骤都在 `executeTransaction` 事务中执行
2. ✅ **用户余额扣除**：正确扣除订单总金额
3. ✅ **手续费账户**：正确增加手续费
4. ✅ **AMM 账户**：正确增加净投资额（买入）或减少总金额（卖出）
5. ✅ **订单记录**：正确创建订单记录，状态和字段完整
6. ✅ **持仓管理**：正确创建或更新持仓，平均价格计算正确
7. ✅ **流水记录**：正确记录三条流水（用户、手续费、AMM）
8. ✅ **对账逻辑**：对账公式正确，能够检测异常

### 🎯 结论

**所有交易流程都已按照原子化操作的要求正确实现，对账逻辑通顺成立！**

