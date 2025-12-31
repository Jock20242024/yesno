# 持仓盈亏(PnL)计算逻辑重构总结

## 📋 执行时间
2025-12-26

## 🎯 重构目标
统一所有 API 的持仓价格计算逻辑，确保已结算市场的盈亏计算正确。

---

## ✅ 已完成的工作

### 第一步：创建通用计算工具 ✅

**文件**: `lib/utils/valuation.ts`

**实现的功能**:
1. `calculatePositionPrice()` - 计算持仓的当前价格
   - 已结算市场（RESOLVED）：赢家 = $1.0，输家 = $0.0
   - 交易中/等待结果（OPEN/CLOSED）：使用 AMM 公式计算
   - **重要**：CLOSED 状态维持最后成交价，绝不归零

2. `calculatePositionValue()` - 计算持仓的完整价值信息
   - 返回：currentPrice, currentValue, costBasis, profitLoss, profitLossPercent

---

### 第二步：重构后端 API ✅

所有 API 都已重构，使用统一的工具函数：

#### 1. `/api/positions` ✅
- ✅ 添加了 `calculatePositionValue` import
- ✅ 替换硬编码的价格计算逻辑
- ✅ 确保查询包含 `resolvedOutcome` 字段

#### 2. `/api/user/portfolio` ✅
- ✅ 添加了 `calculatePositionValue` import
- ✅ 替换硬编码的价格计算逻辑
- ✅ 查询已包含 `resolvedOutcome` 字段

#### 3. `/api/users/[user_id]` ✅
- ✅ 添加了 `calculatePositionValue` import
- ✅ 替换硬编码的价格计算逻辑
- ✅ 查询已包含 `resolvedOutcome` 字段

#### 4. `/api/user/assets` ✅
- ✅ 添加了 `calculatePositionPrice` import
- ✅ 替换持仓价值计算逻辑
- ✅ 添加 `resolvedOutcome` 字段到查询
- ✅ 修复历史价值计算逻辑（也使用工具函数）

---

### 第三步：前端过滤逻辑检查 ✅

**文件**: `app/wallet/page.tsx`

**当前逻辑** (第 134-138 行):
```typescript
const openPositions = result.data.filter((p: any) => {
  const isPositionOpen = p.status === 'OPEN';
  const isMarketOpen = p.marketStatus !== 'RESOLVED' && p.marketStatus !== 'CLOSED';
  return isPositionOpen && isMarketOpen;
});
```

**状态**: ✅ **已正确实现双重过滤**
- 只显示 `status === 'OPEN'` 的 Position
- 且 `marketStatus !== 'RESOLVED'` 且 `marketStatus !== 'CLOSED'`

---

## 📊 重构前后对比

### 重构前（问题）
- ❌ 代码重复：每个 API 都有独立的价格计算逻辑
- ❌ 逻辑不一致：不同 API 可能使用不同的计算方法
- ❌ 已结算市场计算错误：仍然使用 AMM 价格（$0.5）而不是 $1.0/$0.0
- ❌ CLOSED 状态处理不明确：可能导致资产归零

### 重构后（解决方案）
- ✅ 代码统一：所有 API 使用同一个工具函数
- ✅ 逻辑一致：确保计算结果完全相同
- ✅ 已结算市场计算正确：赢家 $1.0，输家 $0.0
- ✅ CLOSED 状态正确处理：维持最后成交价，绝不归零
- ✅ 易于维护：价格计算逻辑集中在一个文件中

---

## 🔍 核心逻辑说明

### 价格计算规则

```typescript
if (market.status === 'RESOLVED' && market.resolvedOutcome) {
  // 已结算：赢家 $1.0，输家 $0.0
  return outcome === market.resolvedOutcome ? 1.0 : 0.0;
} else {
  // 未结算（OPEN 或 CLOSED）：使用 AMM 公式
  // totalYes / (totalYes + totalNo) 或 totalNo / (totalYes + totalNo)
  // CLOSED 状态维持最后成交价，绝不归零
}
```

---

## 📌 关键修复点

1. **已结算市场价格**：
   - 修复前：使用 AMM 价格（如 $0.5）
   - 修复后：赢家 $1.0，输家 $0.0

2. **CLOSED 状态处理**：
   - 修复前：可能被归零
   - 修复后：维持最后成交价（AMM 价格）

3. **代码复用**：
   - 修复前：4 个 API 有 4 套不同的计算逻辑
   - 修复后：所有 API 使用统一的工具函数

---

## ✅ 验证清单

- [x] `lib/utils/valuation.ts` 已创建
- [x] `calculatePositionPrice()` 函数已实现
- [x] `calculatePositionValue()` 函数已实现
- [x] `/api/positions` 已重构
- [x] `/api/user/portfolio` 已重构
- [x] `/api/users/[user_id]` 已重构
- [x] `/api/user/assets` 已重构
- [x] 所有查询都包含 `resolvedOutcome` 字段
- [x] 前端过滤逻辑已检查（双重保险）
- [x] TypeScript 类型检查通过
- [x] Linter 检查通过

---

## 🎯 总结

所有 API 的盈亏计算逻辑已成功重构，使用统一的工具函数。现在：

1. **已结算市场**：正确按 $1.0（赢家）或 $0.0（输家）计算
2. **未结算市场**：使用 AMM 公式计算当前价格
3. **CLOSED 状态**：维持最后成交价，绝不归零
4. **代码质量**：统一、一致、易于维护

前端也已确保只显示 OPEN 状态的活跃持仓，RESOLVED/CLOSED 的持仓不会出现在"我的持仓"列表中。
