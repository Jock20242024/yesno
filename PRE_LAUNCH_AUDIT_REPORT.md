# 预测市场系统 - 预上线稳定性风险报告

**审计日期**: 2024-12-22  
**审计范围**: 数据链路、交易闭环、结算逻辑、UI稳定性  
**审计状态**: 发现4个高风险项、2个中风险项

---

## 🔴 高风险项

### 1. 【数据链路】Market创建时缺少templateId和period字段

**问题描述**:  
在 `lib/factory/engine.ts` 的 `createMarketFromTemplate` 函数中，创建市场时**没有设置 `templateId` 和 `period` 字段**，导致：
- 前端导航栏（TimeNavigationBar）无法通过 `templateId` 聚合同模板市场
- 详情页API返回 `templateId: null, period: null`，导航栏不显示
- 无法实现多时段市场切换功能

**影响范围**:  
- 所有工厂生成的市场
- 市场详情页导航栏功能完全失效
- 用户体验严重受损

**问题代码位置**:  
`lib/factory/engine.ts:593-607`

```typescript
// 当前代码（缺失templateId和period）
const data: any = {
  title: marketTitle,
  description: description,
  symbol: template.symbol,
  strikePrice: Number(startingPrice),
  closingDate: endTime,
  status: 'OPEN',
  reviewStatus: 'PUBLISHED',
  isActive: true,
  isFactory: true,
  source: 'INTERNAL',
  externalId: polymarketId,
  categorySlug: categorySlug || null,
  // ❌ 缺失: templateId
  // ❌ 缺失: period
};
```

**修复方案**:
```typescript
// 修复后代码
const data: any = {
  title: marketTitle,
  description: description,
  symbol: template.symbol,
  strikePrice: Number(startingPrice),
  closingDate: endTime,
  status: 'OPEN',
  reviewStatus: 'PUBLISHED',
  isActive: true,
  isFactory: true,
  source: 'INTERNAL',
  externalId: polymarketId,
  categorySlug: categorySlug || null,
  templateId: template.id,        // ✅ 添加：关联模板ID
  period: template.period,         // ✅ 添加：周期（分钟数）
};
```

**优先级**: 🔴 **P0 - 必须立即修复**  
**修复文件**: `lib/factory/engine.ts:607`  
**验证方式**: 
1. 创建新市场后，检查数据库 `markets` 表的 `templateId` 和 `period` 字段
2. 访问市场详情页，验证导航栏是否正确显示

---

### 2. 【交易闭环】/api/trade 接口未使用数据库事务

**问题描述**:  
`app/api/trade/route.ts` 中的买入逻辑使用了多个独立的数据库操作：
1. 更新用户余额
2. 更新市场池（totalVolume, totalYes, totalNo）
3. 如果更新市场失败，手动回滚用户余额

**风险**:  
- **余额扣减与市场更新不同步**：如果步骤2失败，虽然代码尝试回滚，但在高并发场景下可能出现：
  - 用户余额已扣除，但市场交易量未更新
  - 数据库连接中断导致回滚失败
  - 资金流失或幽灵持仓

**影响范围**:  
- `/api/trade` 接口的所有交易请求
- 用户资金安全
- 市场交易量统计准确性

**问题代码位置**:  
`app/api/trade/route.ts:172-216`

```typescript
// 当前代码（非事务性）
if (type === 'buy') {
  // 1. 扣除用户余额
  const newBalance = user.balance - amountNum;
  const updatedUser = await DBService.updateUser(userId, {
    balance: newBalance,
  });

  // 2. 更新市场池
  const updatedMarket = await DBService.updateMarket(marketId, {
    totalVolume: newTotalVolume,
    totalYes: newTotalYes,
    totalNo: newTotalNo,
  });

  if (!updatedMarket) {
    // ❌ 手动回滚，不可靠
    await DBService.updateUser(userId, {
      balance: user.balance,
    });
    return NextResponse.json({ ... });
  }
}
```

**修复方案**:
```typescript
// 修复后代码（使用事务）
import { prisma } from '@/lib/prisma';

if (type === 'buy') {
  const result = await prisma.$transaction(async (tx) => {
    // 1. 扣除用户余额（带锁）
    const lockedUser = await tx.user.findUnique({
      where: { id: userId },
    });
    
    if (!lockedUser || lockedUser.balance < amountNum) {
      throw new Error('Insufficient balance');
    }

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { balance: { decrement: amountNum } },
    });

    // 2. 更新市场池
    const updatedMarket = await tx.market.update({
      where: { id: marketId },
      data: {
        totalVolume: { increment: amountNum },
        totalYes: outcome === 'YES' ? { increment: netAmount } : undefined,
        totalNo: outcome === 'NO' ? { increment: netAmount } : undefined,
      },
    });

    // 3. 创建订单记录
    const order = await tx.order.create({
      data: {
        userId,
        marketId,
        outcomeSelection: outcome,
        amount: amountNum,
        feeDeducted,
        type: 'BUY',
      },
    });

    return { updatedUser, updatedMarket, order };
  });

  // 返回成功响应
  return NextResponse.json({ ... });
}
```

**注意**: 该接口已标记为"已废弃"，建议使用 `/api/orders`（已使用事务），但需要确保所有前端调用已迁移。

**优先级**: 🔴 **P0 - 必须立即修复**  
**修复文件**: `app/api/trade/route.ts`  
**验证方式**: 
1. 模拟高并发交易场景
2. 测试数据库连接中断时的回滚机制
3. 对比 `/api/orders` 的实现（已正确使用事务）

---

### 3. 【结算逻辑】Oracle失败时无兜底机制，可能产生僵尸市场

**问题描述**:  
自动结算系统（`lib/factory/settlement.ts`）在Oracle价格获取失败时，直接抛出错误并跳过结算，导致：
- 市场一直处于 `OPEN` 状态，无法结算
- 用户资金被锁定，无法收回
- 需要人工介入才能解决

**影响范围**:  
- 所有工厂市场的自动结算
- 用户资金安全
- 系统可用性

**问题代码位置**:  
`lib/factory/settlement.ts:59-67`

```typescript
// 当前代码（无兜底）
let settlementPrice: number;
try {
  const priceResult = await getPrice(market.symbol);
  settlementPrice = priceResult.price;
} catch (oracleError: any) {
  console.error(`❌ [Settlement] Oracle 获取结算价失败:`, oracleError.message);
  throw new Error(`无法获取结算价: ${oracleError.message}`);
  // ❌ 直接失败，市场成为僵尸
}
```

**修复方案**:

**方案A - 重试机制（推荐）**:
```typescript
async function getSettlementPriceWithRetry(
  symbol: string, 
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<number> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const priceResult = await getPrice(symbol);
      return priceResult.price;
    } catch (error: any) {
      lastError = error;
      if (i < maxRetries - 1) {
        console.warn(`⚠️ [Settlement] Oracle重试 ${i + 1}/${maxRetries}: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw lastError || new Error('Oracle获取失败');
}

// 在settleMarket中使用
let settlementPrice: number;
try {
  settlementPrice = await getSettlementPriceWithRetry(market.symbol, 3, 1000);
} catch (oracleError: any) {
  // 重试失败后，标记为需要人工介入
  await prisma.market.update({
    where: { id: market.id },
    data: {
      status: MarketStatus.CLOSED,
      resolvedOutcome: null, // 保持null，标记为异常
    },
  });
  
  // 记录到异常日志表（如果存在）或管理后台
  console.error(`❌ [Settlement] 市场 ${market.id} Oracle持续失败，已标记为异常`);
  
  return {
    success: false,
    outcome: null,
    error: `Oracle获取失败，已标记为异常，需要人工介入`,
  };
}
```

**方案B - 使用历史价格兜底**:
```typescript
// 如果Oracle失败，尝试使用市场创建时的strikePrice作为兜底（不推荐，但可以作为最后手段）
if (!settlementPrice) {
  console.warn(`⚠️ [Settlement] Oracle失败，使用strikePrice作为兜底: $${market.strikePrice}`);
  settlementPrice = market.strikePrice; // 使用创建时的价格作为最后兜底
}
```

**方案C - 延迟结算队列**:
```typescript
// 如果Oracle失败，将市场加入延迟结算队列，等待后续重试
await prisma.market.update({
  where: { id: market.id },
  data: {
    // 添加一个标记字段，表示需要重试结算
    // 或者使用现有的status字段，设置为一个特殊状态
  },
});
```

**推荐实现**: 结合方案A和方案C，先重试3次，失败后标记为异常并记录，由管理后台人工介入。

**优先级**: 🔴 **P0 - 必须立即修复**  
**修复文件**: `lib/factory/settlement.ts`  
**验证方式**: 
1. 模拟Oracle API失败场景
2. 验证重试机制是否生效
3. 检查异常市场是否正确标记

---

### 4. 【结算逻辑】自动结算未使用事务，存在数据不一致风险

**问题描述**:  
`lib/factory/settlement.ts` 的 `settleMarket` 函数中，结算逻辑包含多个独立的数据库操作：
1. 更新订单 payout
2. 更新用户余额
3. 更新市场状态

如果步骤2或3失败，会导致：
- 订单已更新，但用户余额未增加
- 市场状态未更新，资金被锁定
- 数据不一致，难以恢复

**影响范围**:  
- 所有自动结算的工厂市场
- 用户资金安全
- 数据完整性

**问题代码位置**:  
`lib/factory/settlement.ts:135-171`

```typescript
// 当前代码（非事务性）
// 6. 更新订单 payout
for (const order of orders) {
  await prisma.order.update({
    where: { id: order.id },
    data: { payout },
  });
}

// 7. 更新用户余额
for (const [userId, payout] of userPayouts.entries()) {
  await prisma.user.update({
    where: { id: userId },
    data: { balance: { increment: payout } },
  });
}

// 8. 更新市场状态
await prisma.market.update({
  where: { id: market.id },
  data: {
    status: MarketStatus.CLOSED,
    resolvedOutcome: finalOutcome,
  },
});
```

**修复方案**:
```typescript
// 修复后代码（使用事务）
await prisma.$transaction(async (tx) => {
  // 6. 批量更新订单 payout
  for (const order of orders) {
    await tx.order.update({
      where: { id: order.id },
      data: {
        payout: order.outcomeSelection === finalOutcome
          ? calculatePayout(order, winningPool, totalPool)
          : 0,
      },
    });
  }

  // 7. 批量更新用户余额
  for (const [userId, payout] of userPayouts.entries()) {
    if (payout > 0) {
      await tx.user.update({
        where: { id: userId },
        data: { balance: { increment: payout } },
      });
    }
  }

  // 8. 更新市场状态
  await tx.market.update({
    where: { id: market.id },
    data: {
      status: MarketStatus.CLOSED,
      resolvedOutcome: finalOutcome,
    },
  });
});
```

**注意**: `/api/admin/markets/[market_id]/settle/route.ts` 已经使用了事务，但自动结算系统没有。

**优先级**: 🔴 **P0 - 必须立即修复**  
**修复文件**: `lib/factory/settlement.ts`  
**验证方式**: 
1. 模拟数据库连接中断场景
2. 验证事务回滚是否生效
3. 对比手动结算API的实现（已正确使用事务）

---

## 🟡 中风险项

### 5. 【UI稳定性】PriceChart组件高度可能在某些布局中失效

**问题描述**:  
虽然 `PriceChart.tsx` 已设置固定高度 `h-[250px]`，但在某些Flex布局或响应式场景下，`ResponsiveContainer` 仍可能接收到无效的宽度/高度（-1），导致图表渲染失败。

**影响范围**:  
- 市场详情页K线图
- 移动端显示

**问题代码位置**:  
`components/market-detail/PriceChart.tsx:67-68`

```typescript
<div className="h-[250px] w-full relative group cursor-crosshair border-b border-pm-border">
  <ResponsiveContainer width="100%" height="100%">
```

**修复方案**:
```typescript
// 修复后代码（添加最小高度和明确尺寸）
<div 
  className="h-[250px] min-h-[250px] w-full relative group cursor-crosshair border-b border-pm-border"
  style={{ height: '250px', minHeight: '250px', width: '100%' }}
>
  <ResponsiveContainer width="100%" height={250}>
    {/* 使用固定数值而不是100% */}
```

**优先级**: 🟡 **P1 - 建议修复**  
**修复文件**: `components/market-detail/PriceChart.tsx`  
**验证方式**: 
1. 在不同屏幕尺寸下测试
2. 检查浏览器控制台是否有width/height -1警告

---

### 6. 【数据链路】详情页API的templateId获取逻辑可能失效

**问题描述**:  
`app/api/markets/[market_id]/route.ts` 中，`templateId` 的获取逻辑依赖于 `market.marketTemplate`，但如果：
1. Market表的 `templateId` 字段为 `null`（由于问题1）
2. `marketTemplate` 关联查询失败

会导致前端收到 `templateId: null`，导航栏不显示。

**当前代码逻辑**:
```typescript
templateId: marketTemplate?.id || (market as any).templateId || null,
```

**影响范围**:  
- 市场详情页导航栏
- 多时段市场切换功能

**修复方案**:  
优先修复问题1（Market创建时设置templateId），确保数据源头正确。同时，在API中添加更详细的日志和错误处理：

```typescript
// 增强错误处理和日志
if (!marketTemplate && !(market as any).templateId) {
  console.warn(`⚠️ [Market Detail API] 市场 ${market_id} 缺少templateId和marketTemplate关联`);
}

const templateId = marketTemplate?.id || (market as any).templateId || null;
const period = marketTemplate?.period || (market as any).period || null;

if (!templateId) {
  console.warn(`⚠️ [Market Detail API] 市场 ${market_id} 无法获取templateId，导航栏将不显示`);
}
```

**优先级**: 🟡 **P1 - 建议修复（依赖问题1的修复）**  
**修复文件**: `app/api/markets/[market_id]/route.ts`  
**验证方式**: 
1. 修复问题1后，验证templateId是否正确返回
2. 检查日志中是否有警告信息

---

## ✅ 已通过检查项

### 1. 订单创建API（/api/orders）使用事务 ✅
- 文件: `app/api/orders/route.ts:173`
- 状态: 已正确使用 `prisma.$transaction`
- 验证: 余额扣减、订单创建、持仓更新均在事务内

### 2. TimeNavigationBar组件hasMoreSlots已定义 ✅
- 文件: `components/market-detail/TimeNavigationBar.tsx:73`
- 状态: 已正确定义 `const hasMoreSlots = (slots?.length || 0) > 5;`
- 验证: 无未定义变量错误

### 3. 手动结算API使用事务 ✅
- 文件: `app/api/admin/markets/[market_id]/settle/route.ts:125`
- 状态: 已正确使用 `prisma.$transaction`
- 验证: 订单更新、用户余额更新、市场状态更新均在事务内

---

## 📋 修复优先级总结

| 优先级 | 问题编号 | 问题描述 | 预计修复时间 |
|--------|----------|----------|--------------|
| P0 | 1 | Market创建缺少templateId/period | 5分钟 |
| P0 | 2 | /api/trade未使用事务 | 30分钟 |
| P0 | 3 | Oracle失败无兜底机制 | 1小时 |
| P0 | 4 | 自动结算未使用事务 | 30分钟 |
| P1 | 5 | PriceChart高度可能失效 | 10分钟 |
| P1 | 6 | 详情页API templateId获取逻辑 | 15分钟（依赖问题1） |

**总计预计修复时间**: 约2.5小时

---

## 🎯 修复建议

1. **立即修复P0问题**（问题1、2、3、4），这些问题直接影响系统稳定性和用户资金安全。

2. **问题1（templateId/period）** 是最快修复的问题，建议优先处理，因为它影响前端导航栏功能。

3. **问题2（/api/trade事务）** 虽然接口已标记为废弃，但如果有遗留调用，需要立即修复。

4. **问题3和4（结算逻辑）** 是核心功能，建议一起修复，确保结算系统的可靠性。

5. **问题5和6** 可以在P0问题修复后进行，属于优化项。

---

## 📝 修复后验证清单

- [ ] 创建新市场后，数据库 `templateId` 和 `period` 字段有值
- [ ] 市场详情页导航栏正确显示
- [ ] `/api/trade` 接口在高并发场景下数据一致
- [ ] Oracle失败时，市场正确标记为异常或重试成功
- [ ] 自动结算使用事务，数据一致性保证
- [ ] K线图在所有屏幕尺寸下正常显示
- [ ] 详情页API正确返回 `templateId` 和 `period`

---

**报告生成时间**: 2024-12-22  
**下次审计建议**: 修复完成后1周内进行二次审计
