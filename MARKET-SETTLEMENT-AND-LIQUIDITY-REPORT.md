# 市场结算（Settlement）和流动性归属逻辑专项报告

**报告日期：** 2025-01-06  
**审计范围：** 市场结算流程、流动性归属、做市商机制、对账功能

---

## 执行摘要

本报告针对市场结算和流动性归属逻辑进行了全面审计，发现了**5个关键问题**：

1. ❌ **结算资金流向缺失**：结算时没有将AMM余额划转回system.liquidity@yesno.com
2. ❌ **盈亏记账缺失**：没有MARKET_PROFIT_LOSS类型的Transaction记录
3. ❌ **做市商角色定义不清**：初始流动性在结算后没有回收机制
4. ❌ **做市商机制不完整**：系统只是"死钱"记录，不是真正的"活水"做市商
5. ⚠️ **对账冲突风险**：对账功能无法捕捉结算后的资金划转

---

## 1. 结算资金流向分析

### 1.1 当前实现

**代码位置：** `lib/factory/settlement.ts` (executeSettlement函数)

**当前逻辑：**
```typescript
// 结算时只处理用户订单派奖
await prisma.$transaction(async (tx) => {
  // 1. 更新订单 payout
  // 2. 更新用户余额（发放奖金）
  // 3. 创建 WIN 类型的 Transaction 记录
  // 4. 更新市场状态为 RESOLVED
  // ❌ 缺失：没有处理 AMM 余额划转
  // ❌ 缺失：没有处理 totalYes/totalNo 的清算
});
```

### 1.2 问题分析

**❌ 关键问题：结算时没有将AMM余额划转回system.liquidity@yesno.com**

**证据：**
- 搜索 `lib/factory/settlement.ts` 中所有代码，**没有找到**任何关于 `system.amm` 或 `system.liquidity` 账户的操作
- 搜索 `totalYes` 和 `totalNo`，**没有找到**结算后的清零或转移逻辑
- 市场的 `totalYes` 和 `totalNo` 在结算后**仍然保留在数据库中**，成为"死钱"

**资金流向图（当前）：**
```
市场结算时：
用户订单 → 计算派奖 → 用户余额增加
❌ AMM余额 → （无操作）→ 资金滞留
❌ totalYes/totalNo → （无操作）→ 数据残留
```

**预期资金流向（应该）：**
```
市场结算时：
用户订单 → 计算派奖 → 用户余额增加
✅ AMM余额 → 计算盈亏 → 划转回system.liquidity
✅ totalYes/totalNo → 清零或转移 → 数据清理
```

### 1.3 代码片段

**当前结算代码（缺失AMM处理）：**
```typescript:286:351:lib/factory/settlement.ts
// 8. 🔥 使用事务确保所有操作的原子性
await prisma.$transaction(async (tx) => {
  // 批量更新订单 payout
  for (const order of orders) {
    const payout = orderPayouts.get(order.id) || 0;
    await tx.orders.update({
      where: { id: order.id },
      data: { payout },
    });
  }

  // 更新所有 Position 的状态
  const allPositions = await tx.positions.findMany({
    where: {
      marketId: marketId,
      status: 'OPEN',
    },
  });

  for (const position of allPositions) {
    await tx.positions.update({
      where: { id: position.id },
      data: {
        status: 'CLOSED',
      },
    });
  }

  // 批量更新用户余额并创建 Transaction 记录
  for (const [userId, payout] of userPayouts.entries()) {
    if (payout > 0) {
      await tx.users.update({
        where: { id: userId },
        data: {
          balance: {
            increment: payout,
          },
        },
      });

      await tx.transactions.create({
        data: {
          id: randomUUID(),
          userId: userId,
          amount: payout,
          type: 'WIN',
          reason: `市场 ${marketId} 结算奖金（${finalOutcome} 胜）`,
          status: 'COMPLETED',
        },
      });
    }
  }

  // 更新市场状态
  await tx.markets.update({
    where: { id: marketId },
    data: {
      status: MarketStatus.RESOLVED,
      resolvedOutcome: finalOutcome,
    },
  });
  
  // ❌ 缺失：AMM余额划转逻辑
  // ❌ 缺失：totalYes/totalNo 清算逻辑
});
```

---

## 2. 盈亏记账分析

### 2.1 当前Transaction类型

**代码位置：** `prisma/schema.prisma`

**TransactionType枚举：**
```prisma
enum TransactionType {
  DEPOSIT
  WITHDRAW
  BET
  WIN
  ADMIN_ADJUSTMENT
  // ❌ 缺失：MARKET_PROFIT_LOSS
  // ❌ 缺失：LIQUIDITY_RECOVERY
}
```

### 2.2 问题分析

**❌ 关键问题：没有MARKET_PROFIT_LOSS类型的Transaction记录**

**证据：**
- 结算时只创建了 `WIN` 类型的Transaction（用户奖金）
- **没有**创建任何记录做市盈亏的Transaction
- **没有**记录流动性回收的Transaction

**当前Transaction记录（结算时）：**
```typescript
// 只记录用户奖金
await tx.transactions.create({
  data: {
    userId: userId,
    amount: payout,
    type: 'WIN', // ✅ 用户奖金
    reason: `市场 ${marketId} 结算奖金（${finalOutcome} 胜）`,
    status: 'COMPLETED',
  },
});

// ❌ 缺失：做市盈亏记录
// ❌ 缺失：流动性回收记录
```

### 2.3 预期Transaction记录（应该）

```typescript
// 应该创建的Transaction记录：

// 1. 用户奖金（已有）
{
  type: 'WIN',
  amount: payout,
  userId: userId,
}

// 2. 做市盈亏（缺失）
{
  type: 'MARKET_PROFIT_LOSS', // ❌ 类型不存在
  amount: marketProfitLoss, // 正数=盈利，负数=亏损
  userId: ammAccountId,
  reason: `市场 ${marketId} 做市盈亏（${finalOutcome} 胜）`,
}

// 3. 流动性回收（缺失）
{
  type: 'LIQUIDITY_RECOVERY', // ❌ 类型不存在
  amount: recoveredLiquidity,
  userId: liquidityAccountId,
  reason: `市场 ${marketId} 结算后流动性回收`,
}
```

---

## 3. 做市商角色定义分析

### 3.1 初始流动性注入回顾

**代码位置：** `app/api/admin/markets/route.ts` (POST方法)

**注入逻辑：**
```typescript
// 创建市场时注入流动性
if (shouldInjectLiquidity) {
  // 1. 从 system.liquidity 扣减
  await tx.users.update({
    where: { id: liquidityAccount.id },
    data: { balance: { decrement: liquidityAmount } },
  });
  
  // 2. 给 system.amm 增加
  await tx.users.update({
    where: { id: ammAccount.id },
    data: { balance: { increment: liquidityAmount } },
  });
  
  // 3. 初始化市场 totalYes 和 totalNo
  marketData.totalYes = calculatedYes;
  marketData.totalNo = calculatedNo;
}
```

**资金流向：**
```
system.liquidity ($1000) → system.amm ($1000)
Market.totalYes = $500
Market.totalNo = $500
```

### 3.2 结算时流动性归属问题

**❌ 关键问题：初始流动性在结算后没有回收机制**

**当前状态：**
- 结算时：**没有任何**关于流动性回收的代码
- AMM账户余额：**保持不变**（资金滞留）
- Market.totalYes/totalNo：**保持不变**（数据残留）
- system.liquidity账户：**没有回收**（资金流失）

**预期逻辑（应该）：**
```
结算时应该：
1. 计算做市盈亏
   - 如果 YES 胜：AMM 盈利 = totalYes - 初始注入
   - 如果 NO 胜：AMM 盈利 = totalNo - 初始注入
   
2. 回收流动性
   - 从 system.amm 扣减（当前余额）
   - 给 system.liquidity 增加（回收金额）
   
3. 记录坏账（如果资金不足）
   - 如果 AMM 余额 < 初始注入，记录坏账
```

### 3.3 坏账处理缺失

**❌ 问题：如果资金不足以偿还本金，系统没有记录"坏账"**

**场景示例：**
```
初始注入：$1000 (totalYes=$500, totalNo=$500)
用户交易：买入 YES $2000，买入 NO $1000
结算结果：YES 胜

计算：
- 总池：$3000 (用户) + $1000 (初始) = $4000
- YES池：$2000 (用户) + $500 (初始) = $2500
- NO池：$1000 (用户) + $500 (初始) = $1500
- 派奖：$2500 (YES胜者获得全部)
- AMM剩余：$4000 - $2500 = $1500

问题：
- 初始注入：$1000
- AMM剩余：$1500
- 应该回收：$1000（本金）+ $500（盈利）= $1500 ✅

但如果：
- 初始注入：$1000
- AMM剩余：$800（亏损）
- 应该回收：$1000（本金）
- 实际可回收：$800
- 坏账：$200 ❌ 没有记录
```

---

## 4. 做市商机制分析

### 4.1 当前机制：是"活水"还是"死钱"？

**❌ 结论：当前是"死钱"机制，不是真正的做市商**

**证据：**

1. **totalYes/totalNo 只是记录，没有实际资金流转**
   - 用户下注时，资金从用户账户扣除，进入订单池
   - totalYes/totalNo 只是**统计数字**，不代表实际资金
   - 初始注入的流动性**没有参与**实际交易

2. **系统只赚手续费，不承担做市风险**
   - 用户下注时，系统收取5%手续费
   - 结算时，系统只派发用户奖金
   - **没有**计算做市盈亏
   - **没有**承担做市风险

3. **AMM账户余额是"死钱"**
   - 注入后，AMM账户余额增加
   - 但结算时，**没有使用**AMM余额
   - 资金**滞留**在AMM账户中

### 4.2 真正的做市商机制（应该）

**如果是"活水"做市商：**
```
1. 初始注入：system.liquidity → system.amm ($1000)
2. 用户交易：用户 ↔ AMM（按当前赔率交易）
3. 结算时：
   - 计算做市盈亏
   - 回收流动性（本金+盈亏）
   - 记录Transaction
4. 资金流转：system.amm → system.liquidity（回收）
```

**当前实现（"死钱"）：**
```
1. 初始注入：system.liquidity → system.amm ($1000) ✅
2. 用户交易：用户 ↔ 用户（撮合交易）❌ 不是与AMM交易
3. 结算时：
   - 只派发用户奖金 ✅
   - 不计算做市盈亏 ❌
   - 不回收流动性 ❌
4. 资金流转：无 ❌ 资金滞留
```

### 4.3 纯做市商机制 vs 撮合机制

**当前机制：撮合机制（只赚手续费）**
- ✅ 用户之间撮合交易
- ✅ 系统只收取手续费
- ✅ 不承担做市风险
- ❌ 但初始流动性变成了"死钱"

**纯做市商机制（LP逻辑）：**
- ✅ 用户与AMM交易
- ✅ 系统承担做市风险
- ✅ 赚取买卖价差
- ✅ 流动性可以回收

**建议：**
- 如果采用撮合机制，**不应该注入流动性**（浪费资金）
- 如果采用做市商机制，**必须实现流动性回收**（资金流转）

---

## 5. 对账冲突分析

### 5.1 当前对账逻辑

**代码位置：** `app/api/admin/system-accounts/reconcile/route.ts`

**对账逻辑：**
```typescript
// 1. 获取系统账户当前余额
const systemAccounts = await prisma.users.findMany({
  where: { email: { in: SYSTEM_ACCOUNT_EMAILS } },
});

// 2. 统计transactions总和
const transactions = await prisma.transactions.findMany({
  where: { userId: account.id },
});

const transactionSum = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);

// 3. 计算差异
const difference = Math.abs(currentBalance - transactionSum);
```

### 5.2 对账冲突风险

**❌ 问题：对账功能无法捕捉结算后的资金划转**

**原因：**
1. 结算时**没有创建**AMM账户的Transaction记录
2. 结算时**没有创建**流动性账户的Transaction记录
3. 对账逻辑**只统计**transactions表
4. 如果结算产生了资金划转，**对账功能无法捕捉**

**场景示例：**
```
场景：市场结算，需要回收流动性

应该发生：
1. system.amm 余额减少 $1000
2. system.liquidity 余额增加 $1000
3. 创建两条Transaction记录

实际发生：
1. system.amm 余额减少 $1000（如果实现了）
2. system.liquidity 余额增加 $1000（如果实现了）
3. ❌ 没有创建Transaction记录

对账结果：
- AMM账户：余额 $0，流水总和 $0，差异 $0 ✅（如果余额被清零）
- 流动性账户：余额 $1000，流水总和 $0，差异 $1000 ❌（对账失败）
```

### 5.3 对账精度问题

**问题：如果结算产生了 $0.01 的差额，对账功能是否能捕捉到？**

**答案：可以，但前提是创建了Transaction记录**

**当前状态：**
- ✅ 对账逻辑允许 0.01 的误差（`difference <= 0.01`）
- ❌ 但如果结算时没有创建Transaction，差异会很大
- ❌ 无法区分"正常误差"和"结算遗漏"

---

## 6. 自动结算并回收资金方案建议

### 6.1 方案概述

**目标：** 在结算时自动回收流动性，记录做市盈亏，确保资金流转闭环

### 6.2 实现方案

#### 步骤1：扩展TransactionType枚举

```prisma
enum TransactionType {
  DEPOSIT
  WITHDRAW
  BET
  WIN
  ADMIN_ADJUSTMENT
  LIQUIDITY_INJECTION  // ✅ 已有
  LIQUIDITY_RECOVERY   // 🔥 新增：流动性回收
  MARKET_PROFIT_LOSS   // 🔥 新增：做市盈亏
  MARKET_BAD_DEBT      // 🔥 新增：坏账记录
}
```

#### 步骤2：修改结算函数，添加流动性回收逻辑

```typescript
// 在 lib/factory/settlement.ts 的 executeSettlement 函数中

// 在事务中添加流动性回收逻辑
await prisma.$transaction(async (tx) => {
  // ... 现有的用户派奖逻辑 ...
  
  // 🔥 新增：流动性回收逻辑
  const marketWithLiquidity = await tx.markets.findUnique({
    where: { id: marketId },
    select: {
      totalYes: true,
      totalNo: true,
      // 需要记录初始注入金额（可以存储在market表或单独记录）
    },
  });
  
  if (marketWithLiquidity && (marketWithLiquidity.totalYes > 0 || marketWithLiquidity.totalNo > 0)) {
    // 1. 获取系统账户
    const ammAccount = await tx.users.findFirst({
      where: { email: 'system.amm@yesno.com' },
    });
    
    const liquidityAccount = await tx.users.findFirst({
      where: { email: 'system.liquidity@yesno.com' },
    });
    
    if (ammAccount && liquidityAccount) {
      // 2. 计算做市盈亏
      const initialLiquidity = marketWithLiquidity.totalYes + marketWithLiquidity.totalNo;
      const currentAmmBalance = ammAccount.balance;
      
      // 根据结算结果计算盈亏
      let marketProfitLoss = 0;
      if (finalOutcome === Outcome.YES) {
        // YES胜：AMM持有NO份额，亏损
        marketProfitLoss = marketWithLiquidity.totalNo - (initialLiquidity / 2);
      } else {
        // NO胜：AMM持有YES份额，亏损
        marketProfitLoss = marketWithLiquidity.totalYes - (initialLiquidity / 2);
      }
      
      // 3. 计算可回收金额
      const recoverableAmount = Math.min(currentAmmBalance, initialLiquidity);
      const badDebt = Math.max(0, initialLiquidity - currentAmmBalance);
      
      // 4. 执行资金划转
      if (recoverableAmount > 0) {
        // 从AMM账户扣减
        await tx.users.update({
          where: { id: ammAccount.id },
          data: {
            balance: { decrement: recoverableAmount },
          },
        });
        
        // 给流动性账户增加
        await tx.users.update({
          where: { id: liquidityAccount.id },
          data: {
            balance: { increment: recoverableAmount },
          },
        });
        
        // 5. 创建Transaction记录
        // AMM账户：支出
        await tx.transactions.create({
          data: {
            id: randomUUID(),
            userId: ammAccount.id,
            amount: -recoverableAmount,
            type: 'LIQUIDITY_RECOVERY',
            reason: `市场 ${marketId} 结算后流动性回收`,
            status: 'COMPLETED',
          },
        });
        
        // 流动性账户：收入
        await tx.transactions.create({
          data: {
            id: randomUUID(),
            userId: liquidityAccount.id,
            amount: recoverableAmount,
            type: 'LIQUIDITY_RECOVERY',
            reason: `市场 ${marketId} 结算后流动性回收`,
            status: 'COMPLETED',
          },
        });
      }
      
      // 6. 记录做市盈亏
      if (marketProfitLoss !== 0) {
        await tx.transactions.create({
          data: {
            id: randomUUID(),
            userId: ammAccount.id,
            amount: marketProfitLoss,
            type: 'MARKET_PROFIT_LOSS',
            reason: `市场 ${marketId} 做市盈亏（${finalOutcome} 胜）`,
            status: 'COMPLETED',
          },
        });
      }
      
      // 7. 记录坏账（如果存在）
      if (badDebt > 0) {
        await tx.transactions.create({
          data: {
            id: randomUUID(),
            userId: ammAccount.id,
            amount: -badDebt,
            type: 'MARKET_BAD_DEBT',
            reason: `市场 ${marketId} 结算后坏账（资金不足以偿还本金）`,
            status: 'COMPLETED',
          },
        });
      }
      
      // 8. 清零市场流动性（可选）
      await tx.markets.update({
        where: { id: marketId },
        data: {
          totalYes: 0,
          totalNo: 0,
        },
      });
    }
  }
});
```

#### 步骤3：记录初始注入金额

**方案A：在Market表添加字段**
```prisma
model markets {
  // ... 现有字段 ...
  initialLiquidity Float @default(0) // 🔥 新增：初始注入金额
}
```

**方案B：通过Transaction记录追溯**
```typescript
// 在注入流动性时，记录marketId
await tx.transactions.create({
  data: {
    type: 'LIQUIDITY_INJECTION',
    reason: `市场创建初始流动性注入 - 市场ID: ${marketId} - 金额: ${liquidityAmount}`,
    // 可以通过reason字段解析marketId和金额
  },
});
```

### 6.3 方案优势

1. ✅ **资金流转闭环**：流动性可以回收，不会变成"死钱"
2. ✅ **盈亏可追溯**：通过Transaction记录可以追踪做市盈亏
3. ✅ **坏账可记录**：如果资金不足，可以记录坏账
4. ✅ **对账可覆盖**：所有资金划转都有Transaction记录，对账功能可以捕捉
5. ✅ **数据可清理**：结算后可以清零totalYes/totalNo，避免数据残留

### 6.4 实施优先级

**P0（必须立即修复）：**
1. 添加流动性回收逻辑
2. 创建LIQUIDITY_RECOVERY类型的Transaction记录

**P1（重要）：**
3. 添加MARKET_PROFIT_LOSS类型的Transaction记录
4. 记录初始注入金额（用于计算盈亏）

**P2（可选）：**
5. 添加MARKET_BAD_DEBT类型的Transaction记录
6. 结算后清零totalYes/totalNo

---

## 7. 总结与建议

### 7.1 关键发现

1. ❌ **结算资金流向缺失**：结算时没有将AMM余额划转回system.liquidity
2. ❌ **盈亏记账缺失**：没有MARKET_PROFIT_LOSS类型的Transaction记录
3. ❌ **做市商角色定义不清**：初始流动性在结算后没有回收机制
4. ❌ **做市商机制不完整**：当前是"死钱"机制，不是真正的做市商
5. ⚠️ **对账冲突风险**：对账功能无法捕捉结算后的资金划转

### 7.2 建议

1. **立即实施**：添加流动性回收逻辑，确保资金流转闭环
2. **扩展TransactionType**：添加LIQUIDITY_RECOVERY和MARKET_PROFIT_LOSS类型
3. **记录初始注入**：在Market表或Transaction中记录初始注入金额
4. **完善对账**：确保所有资金划转都有Transaction记录
5. **清理数据**：结算后清零totalYes/totalNo，避免数据残留

### 7.3 风险评估

**当前风险：**
- 🔴 **高**：资金流失风险（流动性无法回收）
- 🔴 **高**：对账失败风险（无法追踪资金流向）
- 🟡 **中**：数据残留风险（totalYes/totalNo不清零）
- 🟡 **中**：盈亏不可追溯（没有Transaction记录）

**修复后风险：**
- 🟢 **低**：资金流转闭环，风险可控
- 🟢 **低**：对账功能可以覆盖所有资金划转
- 🟢 **低**：数据可清理，盈亏可追溯

---

**报告结束**

