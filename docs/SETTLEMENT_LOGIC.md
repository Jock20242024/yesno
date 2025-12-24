# 自动结算逻辑说明

## 📋 概述

系统已经实现了**自动结算功能**，通过定时任务（Cron Job）定期扫描并结算已结束的市场。

---

## ⚖️ 自动结算系统架构

### 1. 定时任务调度器

**文件**: `lib/cron/scheduler.ts`

**启动时机**: 服务器启动时自动启动（单例模式）

**任务列表**:
1. **赔率同步** (`syncOdds`): 每30秒执行一次
2. **工厂市场自动接力与结算**: 每30秒执行一次
   - 步骤1: 执行自动结算扫描 (`runSettlementScanner`)
   - 步骤2: 执行自动接力引擎 (`runRelayEngine`)

### 2. 自动结算扫描器

**文件**: `lib/factory/settlement.ts`

**函数**: `runSettlementScanner()`

**查询条件**:
```typescript
{
  isFactory: true,  // 只处理工厂市场
  status: { notIn: [RESOLVED, CANCELED] },  // 排除已结算和已取消的
  closingDate: { lte: now },  // 结束时间已到达
  resolvedOutcome: null,  // 尚未结算
  // 🔥 注意：不限制 externalId，允许处理没有 externalId 的市场
}
```

**处理逻辑**:
1. 查找所有符合条件的市场
2. 逐个调用 `settleMarket()` 进行结算
3. 统计成功和失败的数量

---

## 🏭 工厂市场结算流程

### 核心函数: `settleMarket(market)`

#### 步骤1: 检查并绑定 externalId

如果市场没有 `externalId`，尝试自动匹配：
```typescript
if (!market.externalId && market.templateId && market.marketTemplate?.symbol && market.period && market.closingDate) {
  const matchedId = await tryBindExternalId(
    market.marketTemplate.symbol,
    market.period,
    new Date(market.closingDate)
  );
  // 如果匹配成功，更新数据库中的 externalId
}
```

#### 步骤2: 调用 Polymarket API 获取结算结果

**核心原则**: **判决权在 Polymarket**

```typescript
const resolutionResult = await getPolymarketResolution(finalExternalId);
```

**函数位置**: `lib/polymarketResolution.ts` (推测)

**返回结果**:
- `resolved: true` - Polymarket 已结算
- `outcome: 'YES' | 'NO'` - 结算结果
- `resolved: false` - Polymarket 尚未结算或查询失败

#### 步骤3: 更新数据库状态

```typescript
await prisma.market.update({
  where: { id: market.id },
  data: {
    status: MarketStatus.RESOLVED,
    resolvedOutcome: finalOutcome,  // 'YES' 或 'NO'
  },
});
```

#### 步骤4: 分发奖金（如果有订单）

如果市场有订单，需要计算并分发奖金：
- 查询该市场的所有订单
- 筛选获胜订单（`outcomeSelection === finalOutcome`）
- 计算总奖金池和每个订单的 payout
- 更新订单的 `payout` 字段
- 更新用户余额

---

## 🌐 Polymarket 爬取市场结算

### 处理方式

**Polymarket 爬取的市场** (`source: 'POLYMARKET'`) 使用**相同的结算逻辑**：

1. 如果市场有 `externalId`，调用 `getPolymarketResolution()` 获取结算结果
2. 如果没有 `externalId`，可能无法自动结算（需要手动处理）

### 与工厂市场的区别

| 特性 | 工厂市场 | Polymarket市场 |
|------|---------|----------------|
| 来源 | 自动生成 | 从 Polymarket 爬取 |
| externalId | 可能为 null（会尝试匹配） | 通常已有 |
| 结算方式 | 完全同步 Polymarket | 完全同步 Polymarket |
| 结算API | 相同：`getPolymarketResolution()` | 相同 |

---

## ⏰ 结算时机

### 自动结算（推荐）

**频率**: 每30秒执行一次

**触发**: Cron Scheduler 自动触发

**处理范围**: 所有已到达 `closingDate` 且未结算的工厂市场

### 手动结算

**API**: `POST /api/admin/markets/[market_id]/settle`

**请求体**:
```json
{
  "finalOutcome": "YES" | "NO"
}
```

**逻辑**:
- 对于工厂市场，如果 `externalId` 存在，会**强制从 Polymarket API 获取结算结果**（忽略传入的 `finalOutcome`）
- 对于手动创建的市场，使用传入的 `finalOutcome`

---

## 🔍 结算查询条件详解

### 自动结算扫描器的查询条件

```typescript
{
  isFactory: true,  // ✅ 只处理工厂市场
  status: { 
    notIn: [MarketStatus.RESOLVED, MarketStatus.CANCELED] 
  },  // ✅ 包含 OPEN 和 CLOSED 状态（历史场次通常是 CLOSED）
  closingDate: { lte: now },  // ✅ 结束时间已到达
  resolvedOutcome: null,  // ✅ 尚未结算
  // ✅ 不限制 externalId，允许处理没有 externalId 的市场
}
```

### 关键点

1. **不限制 externalId**: 允许处理没有 `externalId` 的市场，在结算时会尝试自动匹配
2. **包含 CLOSED 状态**: 历史补录场次通常是 `CLOSED` 状态，也会被处理
3. **不限制 source**: 虽然查询条件是 `isFactory: true`，但实际上 Polymarket 爬取的市场如果有 `externalId`，也可以使用相同的结算逻辑

---

## 🛡️ 错误处理

### 场景1: 无法匹配 externalId

**处理**: 返回错误，不进行结算

**日志**: `⚠️ 无法匹配 Polymarket ID，可能是历史场次或 Polymarket 中不存在对应市场`

### 场景2: Polymarket 尚未结算

**处理**: 跳过，等待下次扫描

**日志**: `⚠️ Polymarket 市场尚未结算`

### 场景3: 市场已过期很久（>7天）且无法获取结果

**处理**: 标记为异常状态

```typescript
await prisma.market.update({
  where: { id: market.id },
  data: {
    status: MarketStatus.CLOSED,
    resolvedOutcome: null,  // null 表示异常状态，需要人工介入
  },
});
```

---

## 📊 结算统计

每次结算扫描完成后，返回统计信息：

```typescript
{
  scanned: number,   // 扫描的市场数量
  settled: number,   // 成功结算的数量
  errors: number,    // 失败的数量
}
```

---

## ✅ 已实现的自动结算功能

1. ✅ **定时任务**: 每30秒自动执行结算扫描
2. ✅ **Polymarket同步**: 完全依赖 Polymarket API 获取结算结果
3. ✅ **自动绑定ID**: 如果市场没有 `externalId`，会尝试自动匹配
4. ✅ **奖金分发**: 结算后自动分发奖金给获胜订单
5. ✅ **状态管理**: 自动更新市场状态为 `RESOLVED`
6. ✅ **错误处理**: 处理各种异常情况（无法匹配、Polymarket未结算等）

---

## 🎯 核心原则

1. **判决权在 Polymarket**: 所有结算结果都从 Polymarket API 获取，不依赖本地计算
2. **忽略初始价格**: 历史场次的 `initialPrice: 0` 不影响结算，只需要 YES/NO 结果
3. **自动处理**: 无需人工干预，系统自动扫描、匹配、结算

---

## 📝 相关文件

- `lib/cron/scheduler.ts` - 定时任务调度器
- `lib/factory/settlement.ts` - 结算逻辑核心
- `app/api/cron/factory-settlement/route.ts` - 结算API（可由外部cron调用）
- `app/api/admin/factory/settlement/route.ts` - 手动触发结算API
- `lib/polymarketResolution.ts` - Polymarket API 封装（推测）
