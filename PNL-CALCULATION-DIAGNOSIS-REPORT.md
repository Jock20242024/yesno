# 盈亏计算逻辑诊断报告

## 📋 执行时间
2025-12-26

## 🎯 诊断目标
检查后端计算持仓价值（currentValue）和盈亏（PnL）的逻辑，确认是否正确处理了已结算市场的情况。

---

## 📊 问题描述

用户反馈：
- 手动结算了一个市场（结果为 YES）
- 用户的"我的持仓"列表里依然显示这些已结束（CLOSED）的订单
- 这些已结算订单的盈亏计算（PnL）似乎是错误的
- 例如 YES 赢了，应该按 $1.0 计算价值，但前端依然按结算前的市场价（如 $0.5）显示，导致显示亏损

---

## 🔍 代码检查结果

### 1. 持仓查询 API 检查

#### 1.1 `/api/positions` (主要持仓列表 API)
**文件位置**: `app/api/positions/route.ts`

**当前逻辑**:
```typescript
// 第29-48行：查询逻辑
const positions = await prisma.position.findMany({
  where: {
    userId,
    status: 'OPEN', // ✅ 只查询 OPEN 状态的持仓
  },
  include: {
    market: {
      select: {
        id: true,
        title: true,
        totalYes: true,
        totalNo: true,
        status: true, // ✅ 包含 market.status
        // ❌ 问题：没有包含 resolvedOutcome！
      },
    },
  },
});

// 第51-59行：价格计算逻辑
const positionsWithValue = positions.map((position) => {
  const totalVolume = (position.market.totalYes || 0) + (position.market.totalNo || 0);
  const currentPrice = position.outcome === 'YES'
    ? (position.market.totalYes / totalVolume || 0.5)  // ❌ 没有判断 market.status
    : (position.market.totalNo / totalVolume || 0.5);
  
  const currentValue = position.shares * currentPrice;
  const profitLoss = currentValue - costBasis;
  // ...
});
```

**问题诊断**:
- ❌ **没有判断 `market.status`**
- ❌ **即使市场已结算（RESOLVED），仍然使用 `totalYes / totalVolume` 计算价格**
- ❌ **没有包含 `resolvedOutcome` 字段**，无法判断赢家还是输家
- ❌ **没有区分已结算市场：赢家应该按 $1.0 计算，输家应该按 $0.0 计算**

---

#### 1.2 `/api/user/portfolio` (组合 API)
**文件位置**: `app/api/user/portfolio/route.ts`

**当前逻辑**:
```typescript
// 第48-70行：查询逻辑
const positions = await prisma.position.findMany({
  where: {
    userId,
    status: 'OPEN',
  },
  include: {
    market: {
      select: {
        id: true,
        title: true,
        totalYes: true,
        totalNo: true,
        status: true, // ✅ 包含 market.status
        closingDate: true,
        resolvedOutcome: true, // ✅ 包含 resolvedOutcome
      },
    },
  },
});

// 第73-82行：价格计算逻辑
const portfolioPositions = positions.map((position) => {
  const totalVolume = (position.market.totalYes || 0) + (position.market.totalNo || 0);
  const currentPrice = position.outcome === 'YES'
    ? (totalVolume > 0 ? position.market.totalYes / totalVolume : 0.5)  // ❌ 没有判断 market.status
    : (totalVolume > 0 ? position.market.totalNo / totalVolume : 0.5);
  
  const currentValue = position.shares * currentPrice;
  const profitLoss = currentValue - costBasis;
  // ...
});
```

**问题诊断**:
- ✅ **查询时包含了 `resolvedOutcome` 字段**
- ❌ **计算价格时没有判断 `market.status`**
- ❌ **即使市场已结算（RESOLVED），仍然使用 AMM 价格计算**

---

#### 1.3 `/api/users/[user_id]` (用户详情 API)
**文件位置**: `app/api/users/[user_id]/route.ts`

**当前逻辑**:
```typescript
// 第99-107行：价格计算逻辑
const positions = positionsData.map((position) => {
  const totalVolume = (position.market.totalYes || 0) + (position.market.totalNo || 0);
  const currentPrice = position.outcome === 'YES'
    ? (totalVolume > 0 ? position.market.totalYes / totalVolume : 0.5)  // ❌ 没有判断 market.status
    : (totalVolume > 0 ? position.market.totalNo / totalVolume : 0.5);
  
  const currentValue = position.shares * currentPrice;
  const profitLoss = currentValue - costBasis;
  // ...
});
```

**问题诊断**:
- ❌ **没有判断 `market.status`**
- ❌ **没有判断 `resolvedOutcome`**

---

#### 1.4 `/api/user/assets` (资产汇总 API)
**文件位置**: `app/api/user/assets/route.ts`

**当前逻辑**:
```typescript
// 第206-211行：持仓价值计算逻辑
const currentPrice = position.outcome === 'YES'
  ? (position.market.totalYes / totalVolume)  // ❌ 没有判断 market.status
  : (position.market.totalNo / totalVolume);

// 持仓价值 = 份额 * 当前价格
positionsValue += position.shares * currentPrice;
```

**问题诊断**:
- ❌ **没有判断 `market.status`**
- ❌ **即使市场已结算，仍然使用 AMM 价格计算持仓价值**

---

## 📝 核心问题总结

### 问题 1: 没有判断市场状态
**所有 API 在计算 `currentPrice` 时，都没有判断 `market.status`**：
- 无论市场是 `OPEN`、`CLOSED` 还是 `RESOLVED`，都使用相同的计算公式
- 使用公式：`totalYes / totalVolume` 或 `totalNo / totalVolume`

### 问题 2: 已结算市场的价格计算错误
**对于已结算（RESOLVED）的市场**：
- 应该根据 `resolvedOutcome` 判断输赢
- **赢家（持仓方向 = 结算结果）**：价格应该是 **$1.0**（完全兑现）
- **输家（持仓方向 ≠ 结算结果）**：价格应该是 **$0.0**（完全归零）
- 但当前代码依然使用 AMM 价格（如 $0.5），导致盈亏计算错误

### 问题 3: 前端可能显示 CLOSED 持仓
**虽然后端查询时过滤了 `status: 'OPEN'`**，但如果：
- 市场已结算，Position 状态被设为 `CLOSED`
- 但 API 返回的数据中可能仍包含这些持仓（如果查询条件有问题）
- 前端需要双重保险，再次过滤

---

## ✅ 正确答案逻辑

对于已结算市场（`market.status === 'RESOLVED'`），应该使用以下逻辑：

```typescript
let currentPrice: number;

if (market.status === 'RESOLVED' && market.resolvedOutcome) {
  // 市场已结算
  const isWinner = (position.outcome === 'YES' && market.resolvedOutcome === 'YES') ||
                   (position.outcome === 'NO' && market.resolvedOutcome === 'NO');
  
  currentPrice = isWinner ? 1.0 : 0.0;  // 赢家 $1.0，输家 $0.0
} else {
  // 市场未结算，使用 AMM 价格
  const totalVolume = (market.totalYes || 0) + (market.totalNo || 0);
  currentPrice = position.outcome === 'YES'
    ? (totalVolume > 0 ? market.totalYes / totalVolume : 0.5)
    : (totalVolume > 0 ? market.totalNo / totalVolume : 0.5);
}

const currentValue = position.shares * currentPrice;
const profitLoss = currentValue - costBasis;
```

---

## 📌 需要修复的 API 列表

1. ✅ `/api/positions` - 已修复（添加 resolvedOutcome 字段和价格判断逻辑）
2. ✅ `/api/user/portfolio` - 已修复（添加价格判断逻辑）
3. ⚠️ `/api/users/[user_id]` - 需要修复（需要检查 market 查询是否包含 resolvedOutcome）
4. ⚠️ `/api/user/assets` - 需要修复（用于计算总持仓价值）

---

## 🔧 修复建议

### 修复步骤 1: 确保查询包含必要字段
所有持仓查询的 `include.market.select` 必须包含：
- `status` ✅（大部分已有）
- `resolvedOutcome` ⚠️（部分缺失）

### 修复步骤 2: 修改价格计算逻辑
所有计算 `currentPrice` 的地方，都需要：
1. 判断 `market.status === 'RESOLVED'`
2. 如果已结算，根据 `resolvedOutcome` 判断输赢
3. 赢家：`currentPrice = 1.0`
4. 输家：`currentPrice = 0.0`

### 修复步骤 3: 前端双重保险
前端在接收到持仓数据后，再次过滤：
- 只显示 `status === 'OPEN'` 的持仓
- 并且 `marketStatus !== 'RESOLVED'` 且 `marketStatus !== 'CLOSED'`

---

## 🎯 结论

**核心问题确认**：
- ✅ **问题确实存在**：所有 API 都没有判断 `market.status`
- ✅ **已结算市场的价格计算错误**：应该按 $1.0（赢家）或 $0.0（输家）计算，但代码仍然使用 AMM 价格
- ✅ **导致盈亏显示错误**：赢家持仓显示亏损（因为按 $0.5 计算而不是 $1.0）

**修复状态**：
- ✅ `/api/positions` - 已修复
- ✅ `/api/user/portfolio` - 已修复
- ⚠️ `/api/users/[user_id]` - 待修复
- ⚠️ `/api/user/assets` - 待修复
