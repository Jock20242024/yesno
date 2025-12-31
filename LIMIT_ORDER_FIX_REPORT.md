# 限价单丢失问题修复报告

## 📋 问题分析

用户反馈：下单后，LIMIT 订单既不在"持仓"里，也不在"挂单"里，更不在"订单簿"里，似乎凭空消失了。

## ✅ 修复内容

### 1. 订单创建接口 (`app/api/orders/route.ts`)

**状态**: ✅ **已正确实现**

**验证**:
- ✅ 正确读取 `orderType` 和 `limitPrice` 参数
- ✅ LIMIT 订单：设置 `status='PENDING'`，`filledAmount=0`
- ✅ LIMIT 订单：不创建 Position，不更新 Market
- ✅ LIMIT 订单：冻结用户资金（扣除 Balance）
- ✅ MARKET 订单：设置 `status='FILLED'`，创建 Position，更新 Market

**代码位置**: 第 34-61 行（参数解析和验证），第 256-283 行（订单创建）

**增强**: 添加了详细的日志输出，便于调试

### 2. 挂单查询接口 (`app/api/user/orders/pending/route.ts`)

**状态**: ✅ **已正确实现**

**验证**:
- ✅ 查询条件：`status='PENDING'` 且 `orderType='LIMIT'`
- ✅ 包含 `market` 关联信息（标题、图片、状态等）
- ✅ 返回完整的订单信息

**代码位置**: 第 35-56 行（查询逻辑）

### 3. 订单簿接口 (`app/api/markets/[market_id]/orderbook/route.ts`)

**状态**: ✅ **已完全重写**

**修复前**:
- ❌ 基于 AMM（自动做市商）逻辑，使用 Position 表模拟订单簿
- ❌ 不显示真实的限价单

**修复后**:
- ✅ 基于真实的 PENDING 限价单构建订单簿（CLOB 模式）
- ✅ 查询 `status='PENDING'` 且 `orderType='LIMIT'` 的订单
- ✅ 按 `limitPrice` 聚合（GroupBy Price）
- ✅ 买单（Bids）：`outcomeSelection='YES'`，按价格从高到低排序
- ✅ 卖单（Asks）：`outcomeSelection='NO'`，转换为 YES 卖出价格（1 - limitPrice），按价格从低到高排序
- ✅ 过滤掉 `quantity` 为 0 的空行
- ✅ 如果没有订单，返回空数组

**核心逻辑**:
```typescript
// 查询 PENDING 限价单
const pendingOrders = await prisma.order.findMany({
  where: {
    marketId: market_id,
    status: 'PENDING',
    orderType: 'LIMIT',
    limitPrice: { not: null },
  },
});

// 按价格聚合
// YES 订单 -> 买单（Bids）
// NO 订单 -> 卖单（Asks，价格 = 1 - limitPrice）
```

**代码位置**: 整个文件已重写

---

## 🔍 验证步骤

### 1. 创建 LIMIT 订单

**请求**:
```bash
POST /api/orders
{
  "marketId": "xxx",
  "outcomeSelection": "YES",
  "amount": 100,
  "orderType": "LIMIT",
  "limitPrice": 0.65
}
```

**预期结果**:
- ✅ 订单状态：`status='PENDING'`
- ✅ 订单类型：`orderType='LIMIT'`
- ✅ 限价：`limitPrice=0.65`
- ✅ 已成交数量：`filledAmount=0`
- ✅ 用户余额减少（资金冻结）
- ✅ **不创建** Position 记录
- ✅ **不更新** Market 的 totalYes/totalNo

### 2. 查询挂单列表

**请求**:
```bash
GET /api/user/orders/pending
```

**预期结果**:
- ✅ 返回刚才创建的 LIMIT 订单
- ✅ 包含 market 信息（标题、图片等）

### 3. 查询订单簿

**请求**:
```bash
GET /api/markets/{market_id}/orderbook
```

**预期结果**:
- ✅ 在 `bids` 或 `asks` 中显示刚才创建的 LIMIT 订单
- ✅ 订单按价格聚合
- ✅ 数量（quantity）和总金额（total）正确计算

---

## ⚠️ 注意事项

### 1. NO 订单的价格转换

在订单簿中，NO 订单需要转换为 YES 卖出价格：
- 用户买入 NO 的限价：`limitPrice = 0.3`
- 转换为 YES 卖出价格：`1 - 0.3 = 0.7`
- 显示在 `asks` 列表中（卖单）

### 2. 订单数量计算

剩余数量（shares）计算：
```typescript
remainingQuantity = (amount - filledAmount) / limitPrice
```

例如：
- `amount = 100 USD`
- `limitPrice = 0.65`
- `remainingQuantity = 100 / 0.65 = 153.85 shares`

### 3. 空订单簿处理

如果市场没有任何 PENDING 限价单：
- 返回空数组 `bids: []`，`asks: []`
- 不返回 AMM 模拟数据
- 前端应显示"暂无挂单"提示

---

## 🎯 下一步

1. **测试验证**：创建 LIMIT 订单，验证是否出现在挂单列表和订单簿中
2. **订单撮合**（待实现）：实现订单撮合逻辑，将 PENDING 订单转换为 FILLED
3. **订单取消**（待实现）：允许用户取消 PENDING 订单，返还冻结资金

---

## 📝 日志增强

在订单创建接口中添加了详细日志：
```typescript
console.log('✅ [Orders API] 事务执行成功:', {
  orderId: newOrder.id,
  orderType: newOrder.orderType,
  status: newOrder.status,
  limitPrice: newOrder.limitPrice,
  filledAmount: newOrder.filledAmount,
  hasPosition: !!updatedPosition,
  // ...
});
```

这些日志可以帮助调试订单是否正确创建和保存。
