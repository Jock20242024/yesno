# 🔍 赔率同步问题全盘排查报告

**生成时间**: 2025-12-24T19:17:12Z

---

## 📋 问题描述

用户反馈：后端绑定成功后，前端也没有实时赔率同步，显示依然是 50/50。

---

## 🔍 问题根源分析

### 核心问题

**问题1：OddsRobot 绑定成功后无法获取赔率数据**

**位置**：`lib/scrapers/oddsRobot.ts` 第 386 行

**原因**：
- `tryBindExternalId` 成功绑定 `externalId` 后，`finalExternalId` 被设置为新绑定的 ID
- 但是 `apiMarketMap` 是在绑定**之前**构建的（第 290-298 行）
- 新绑定的 `externalId` 不在 `apiMarketMap` 中
- 因此 `apiMarketMap.get(finalExternalId!)` 返回 `undefined`
- 代码会返回错误："API 中没有找到 externalId 对应的市场数据"

**影响**：
- 即使绑定成功，赔率数据也无法提取
- `outcomePrices` 字段不会被更新到数据库
- 前端读取时仍然是空值，显示默认 50/50

---

## ✅ 修复方案

### 修复1：OddsRobot 绑定成功后单独查询 API

**修改文件**：`lib/scrapers/oddsRobot.ts`

**修改内容**：
- 在绑定成功后，如果 `apiMarketMap` 中没有数据，单独查询一次 Polymarket API
- API 端点：`https://gamma-api.polymarket.com/markets/${finalExternalId}`
- 查询成功后，使用返回的数据提取赔率

**代码位置**：第 386-434 行

**关键逻辑**：
```typescript
// 🔥 关键修复：如果绑定成功后 apiMarketMap 中没有数据，单独查询一次 API
if (!apiMarket && finalExternalId && finalExternalId !== market.externalId) {
  // 这说明是刚刚绑定成功的 externalId，需要单独查询
  const singleMarketUrl = `https://gamma-api.polymarket.com/markets/${finalExternalId}`;
  const singleMarketResponse = await fetch(singleMarketUrl, {...});
  if (singleMarketResponse.ok) {
    apiMarket = await singleMarketResponse.json();
  }
}
```

---

## 🔄 数据流程验证

### 后端流程

1. **OddsRobot 执行** → 发现市场没有 `externalId`
2. **调用 tryBindExternalId** → 绑定成功，更新数据库 `externalId`
3. **单独查询 API** → 获取 Polymarket 市场数据
4. **提取 outcomePrices** → 从 API 数据中提取赔率
5. **加入队列** → 通过 BullMQ 队列异步更新数据库 `outcomePrices`
6. **数据库更新** → `Market.outcomePrices` 字段被更新

### 前端流程

1. **SWR 轮询** → 每 5 秒自动刷新工厂市场数据
2. **API 请求** → `/api/markets/${id}` 获取市场详情
3. **后端解析** → API 从数据库读取 `outcomePrices`，解析为 `yesPercent`/`noPercent`
4. **前端显示** → 使用解析后的赔率百分比显示

---

## ✅ 前端配置验证

### SWR 轮询配置

**文件**：`app/markets/[id]/page.tsx` 第 43-59 行

**配置内容**：
```typescript
refreshInterval: (data) => {
  // 🔥 如果是工厂市场，无论是否有externalId，都每5秒刷新一次（实时同步赔率）
  if (data && (data as any).isFactory) {
    return 5000; // 5秒
  }
  // 其他市场每30秒刷新一次
  return 30000; // 30秒
}
```

**状态**：✅ 配置正确，工厂市场每 5 秒自动刷新

### 赔率解析逻辑

**文件**：`app/markets/[id]/page.tsx` 第 63-104 行

**逻辑**：
1. 优先使用 API 返回的 `yesPercent`/`noPercent`（后端已解析）
2. 兜底逻辑：如果 API 返回 50，但 `outcomePrices` 存在，前端再次解析

**状态**：✅ 逻辑正确，有双重保障

---

## 🔍 后端 API 验证

### 市场详情 API

**文件**：`app/api/markets/[market_id]/route.ts` 第 220-295 行

**逻辑**：
1. 检查是否为工厂市场或 Polymarket 市场
2. 第一优先级：使用 `outcomePrices` 字段解析赔率
3. 第二优先级：使用 `initialPrice` 字段
4. 如果都没有，显示默认 50/50 并记录日志

**状态**：✅ 逻辑正确

---

## 📊 完整数据流

```
┌─────────────────┐
│  OddsRobot 执行 │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ 发现市场没有 externalId  │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ 调用 tryBindExternalId  │
│    ↓ 绑定成功           │
│ 更新数据库 externalId   │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ 单独查询 Polymarket API │ ⬅️ 【修复点】
│ GET /markets/{id}       │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ 提取 outcomePrices      │
│ 加入 BullMQ 队列        │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ 异步更新数据库          │
│ Market.outcomePrices    │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ 前端 SWR 轮询 (5秒)     │
│ GET /api/markets/{id}   │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ 后端解析 outcomePrices  │
│ 返回 yesPercent/noPercent│
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ 前端显示实时赔率        │
└─────────────────────────┘
```

---

## ✅ 修复总结

### 已修复的问题

1. ✅ **OddsRobot 绑定成功后无法获取赔率数据**
   - 添加单独查询 API 逻辑
   - 确保绑定成功后能立即获取赔率数据

### 已验证正常的部分

1. ✅ **前端 SWR 轮询配置**
   - 工厂市场每 5 秒自动刷新
   - 配置正确无误

2. ✅ **前端赔率解析逻辑**
   - 有双重保障机制
   - 后端解析 + 前端兜底解析

3. ✅ **后端 API 赔率解析**
   - 正确使用 `outcomePrices` 字段
   - 有完善的日志记录

---

## 🎯 预期效果

修复后，赔率同步流程应该能够：

1. ✅ **后端绑定成功后立即获取赔率**
   - `tryBindExternalId` 成功后，立即查询 Polymarket API
   - 提取 `outcomePrices` 并更新数据库

2. ✅ **前端实时显示赔率**
   - SWR 每 5 秒自动刷新
   - 后端 API 返回解析后的赔率百分比
   - 前端正确显示实时赔率

3. ✅ **数据一致性**
   - 数据库 `outcomePrices` 字段及时更新
   - 前端显示与数据库数据一致

---

## 📝 测试建议

1. **后端测试**：
   - 触发 OddsRobot 执行
   - 检查日志：确认绑定成功后单独查询 API 的日志
   - 检查数据库：确认 `outcomePrices` 字段被更新

2. **前端测试**：
   - 打开工厂市场详情页
   - 等待 5-10 秒
   - 检查浏览器 Network 面板：确认每 5 秒有 API 请求
   - 检查赔率显示：确认从 50/50 变为实际赔率

3. **端到端测试**：
   - 创建一个新的工厂市场（无 externalId）
   - 等待 OddsRobot 执行并绑定成功
   - 检查前端是否在 5-10 秒内显示实际赔率

---

## 🔧 相关文件

### 修改的文件
- `lib/scrapers/oddsRobot.ts` - 添加绑定成功后单独查询 API 逻辑

### 验证的文件
- `app/markets/[id]/page.tsx` - 前端 SWR 轮询配置和赔率解析
- `app/api/markets/[market_id]/route.ts` - 后端 API 赔率解析逻辑

---

**报告生成完成** ✅
