# 结算脚本审计报告

## 审计日期
2024-12-24

## 核心业务逻辑（业务方要求）

1. **判决权在 Polymarket**：我们的市场胜负完全同步 Polymarket 的结算结果
2. **忽略初始价格**：历史补录场次（initialPrice: 0）不需要回填价格，只需要知道 YES/NO
3. **处理历史场次**：已结束但状态为 PENDING 或 CLOSED 的历史场次也需要结算

---

## Q1. 结算源审计 (Source Check)

### ❌ 问题发现

**之前的错误逻辑**：
- `lib/factory/settlement.ts` 使用 `getPrice` from `@/lib/oracle` 获取 Crypto 价格
- `app/api/admin/markets/[market_id]/settle/route.ts` 也使用 Oracle 获取价格
- 根据 `strikePrice` 和结算价计算 YES/NO（YES=UP, NO=DOWN）

**问题**：❌ **完全错误！违反了业务方核心逻辑"判决权在 Polymarket"**

### ✅ 修复方案

**新的正确逻辑**：
1. ✅ 创建 `lib/polymarketResolution.ts` 服务，使用 Polymarket API 获取结算结果
2. ✅ API 端点：`https://clob.polymarket.com/markets/{conditionId}`
3. ✅ 从 API 响应中提取 `resolution` 或 `winner` 字段
4. ✅ 直接使用 Polymarket 的结果，不进行任何价格计算

**修改的文件**：
- ✅ `lib/factory/settlement.ts` - 完全重写，移除所有 Oracle 调用
- ✅ `app/api/admin/markets/[market_id]/settle/route.ts` - 替换为 Polymarket API 调用
- ✅ `lib/polymarketResolution.ts` - 新增 Polymarket 结算查询服务

---

## Q2. 历史场次处理 (Backfill Resolution)

### ❌ 问题发现

**之前的错误逻辑**：
1. ❌ `runSettlementScanner` 只查找 `status: MarketStatus.OPEN` 的市场
2. ❌ `settleMarket` 函数中有 `if (!market.strikePrice || market.strikePrice <= 0) throw Error` 检查
3. ❌ 无法处理历史场次（状态为 CLOSED）

**问题**：
- ❌ 历史场次（initialPrice: 0, status: CLOSED）无法被扫描到
- ❌ 即使扫描到，也会因为 `strikePrice <= 0` 抛出错误

### ✅ 修复方案

**新的正确逻辑**：
1. ✅ `runSettlementScanner` 现在查找 `status: { in: [OPEN, CLOSED] }` 的市场
2. ✅ 完全移除 `strikePrice <= 0` 的检查
3. ✅ 忽略 `initialPrice: 0`，直接使用 Polymarket 结算结果
4. ✅ 处理已过期很久的市场（超过7天标记为异常，但不会因为价格问题失败）

**修改的文件**：
- ✅ `lib/factory/settlement.ts` - 移除价格检查，扩展状态查询范围

---

## Q3. 修复方案总结

### ✅ 已完成的修复

#### 1. 结算源修复（Q1）

**文件**: `lib/factory/settlement.ts`
- ❌ 删除：所有 `getPrice` from `@/lib/oracle` 调用
- ❌ 删除：所有 `strikePrice` 比较逻辑
- ❌ 删除：`determineOutcome(settlementPrice, strikePrice)` 函数
- ✅ 新增：`getPolymarketResolution(market.externalId)` 调用
- ✅ 新增：直接从 Polymarket API 获取 `YES`/`NO` 结果

**文件**: `app/api/admin/markets/[market_id]/settle/route.ts`
- ❌ 删除：Oracle 价格获取逻辑
- ❌ 删除：`strikePrice <= 0` 检查
- ✅ 新增：Polymarket API 结算结果查询

**文件**: `lib/polymarketResolution.ts` (新增)
- ✅ 新增：`getPolymarketResolution(conditionId)` 函数
- ✅ 使用 Polymarket CLOB API: `https://clob.polymarket.com/markets/{conditionId}`
- ✅ 解析 `resolution`、`winner` 或 `outcome` 字段

#### 2. 历史场次处理修复（Q2）

**文件**: `lib/factory/settlement.ts`

**修复 1**: 扩展状态查询
```typescript
// 之前（错误）：
status: MarketStatus.OPEN

// 现在（正确）：
status: { in: [MarketStatus.OPEN, MarketStatus.CLOSED] }
```

**修复 2**: 移除价格检查
```typescript
// 之前（错误）：
if (!market.strikePrice || market.strikePrice <= 0) {
  throw new Error('市场缺少有效的 strikePrice，无法进行结算');
}

// 现在（正确）：
// 完全移除，直接使用 Polymarket 结果
```

**修复 3**: 处理归档市场
- ✅ 如果市场已过期超过7天且无法从 Polymarket 获取结果，标记为异常但不抛出错误

---

## 关键代码变更

### 1. 结算逻辑（lib/factory/settlement.ts）

**之前**：
```typescript
// ❌ 错误：使用 Oracle 获取价格
const priceResult = await getPrice(market.symbol);
const settlementPrice = priceResult.price;
if (!market.strikePrice || market.strikePrice <= 0) {
  throw new Error('市场缺少有效的 strikePrice，无法进行结算');
}
const finalOutcome = determineOutcome(settlementPrice, strikePrice);
```

**现在**：
```typescript
// ✅ 正确：使用 Polymarket API 获取结算结果
if (!market.externalId) {
  return { success: false, error: '市场缺少 externalId' };
}
const resolutionResult = await getPolymarketResolution(market.externalId);
const finalOutcome = resolutionResult.outcome === 'YES' ? Outcome.YES : Outcome.NO;
// 完全忽略 initialPrice 和 strikePrice
```

### 2. 扫描器逻辑（lib/factory/settlement.ts）

**之前**：
```typescript
// ❌ 错误：只查找 OPEN 状态
where: {
  isFactory: true,
  status: MarketStatus.OPEN,
  closingDate: { lte: now },
  resolvedOutcome: null,
}
```

**现在**：
```typescript
// ✅ 正确：包括 OPEN 和 CLOSED 状态
where: {
  isFactory: true,
  status: { in: [MarketStatus.OPEN, MarketStatus.CLOSED] },
  closingDate: { lte: now },
  resolvedOutcome: null,
  externalId: { not: null }, // 必须有 externalId
}
```

---

## 测试建议

### 1. 测试 Polymarket API 集成

```bash
# 测试获取结算结果
curl https://clob.polymarket.com/markets/{conditionId}
```

### 2. 测试历史场次结算

1. 创建一个历史场次（initialPrice: 0, status: CLOSED）
2. 设置 externalId 为一个已结算的 Polymarket 市场 ID
3. 运行 `runSettlementScanner()`
4. 验证市场状态更新为 RESOLVED，outcome 正确

### 3. 测试归档市场处理

1. 创建一个已过期超过7天的市场
2. 设置 externalId 为一个不存在的 Polymarket ID
3. 运行结算扫描器
4. 验证市场被标记为 CLOSED，resolvedOutcome 为 null（异常状态）

---

## 注意事项

1. **externalId 必需**：没有 externalId 的市场无法从 Polymarket 获取结算结果，会被跳过
2. **Polymarket API 限制**：如果 API 返回 404，可能是市场已归档
3. **历史场次价格**：initialPrice: 0 不影响结算，完全依赖 Polymarket 结果
4. **状态更新**：结算成功后，状态更新为 RESOLVED（不是 CLOSED）

---

## 总结

✅ **Q1 修复完成**：结算完全依赖 Polymarket API，不再使用 Oracle 计算价格
✅ **Q2 修复完成**：可以处理历史场次，移除所有价格检查
✅ **Q3 修复完成**：重写结算逻辑，符合业务方核心要求

所有代码已按照业务方要求完成修复。
