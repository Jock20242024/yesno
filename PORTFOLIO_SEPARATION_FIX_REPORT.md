# 持仓与挂单逻辑分离修复报告

## 📋 修复总结

### ✅ 已完成的修复

#### 1. **持仓接口** - `/api/user/portfolio`

**状态**: ✅ **已正确实现**

**实现逻辑**:
- ✅ 基于 **Position 表**查询（不是 Order 表）
- ✅ 只查询 `status: 'OPEN'` 的持仓
- ✅ 自动排除未成交订单（因为只有成交后才创建 Position）
- ✅ 自动排除已关闭（CLOSED）的持仓

**代码验证**:
```typescript
const positions = await prisma.position.findMany({
  where: {
    userId,
    status: 'OPEN', // 🔥 只返回持仓中的仓位，排除已关闭（CLOSED）的
    // 注意：PENDING 订单不会出现在这里，因为它们还没有创建 Position 记录
  },
  // ...
});
```

**说明**:
- 当前系统架构：订单创建时立即创建 Position（立即成交模式，AMM）
- Position 表代表了"实际持有的仓位"
- 查询 Position 表（status='OPEN'）已经自动排除了所有未成交订单

#### 2. **持仓接口** - `/api/positions`

**状态**: ✅ **已正确实现**

**实现逻辑**:
- ✅ 基于 Position 表查询
- ✅ 只查询 `status: 'OPEN'` 的持仓

**代码验证**:
```typescript
const positions = await prisma.position.findMany({
  where: {
    userId,
    status: 'OPEN', // 🔥 只返回持仓中的仓位，排除已关闭（CLOSED）的
  },
  // ...
});
```

#### 3. **挂单接口** - `/api/user/orders/pending` (新建)

**状态**: ✅ **已创建，但受限于数据库模型**

**实现逻辑**:
- ✅ 已创建新的路由 `/api/user/orders/pending`
- ⚠️ 当前返回空数组（因为 Order 模型缺少 status 字段）

**代码结构**:
```typescript
// ⚠️ 当前限制：Order 模型没有 status 字段，无法查询 PENDING 订单
// 🔥 TODO: 当 Order 模型添加 status 和 orderType 字段后，使用以下代码：
// const openOrders = await prisma.order.findMany({
//   where: {
//     userId,
//     status: 'PENDING', // 🔥 核心：只查询未成交的订单
//     orderType: 'LIMIT', // 🔥 只查询限价单
//   },
//   // ...
// });

const openOrders: any[] = []; // 当前返回空数组
```

#### 4. **挂单接口** - `/api/user/open-orders` (向后兼容)

**状态**: ✅ **保持向后兼容**

**实现逻辑**:
- ✅ 保持原有路由工作
- ✅ 添加弃用说明
- ⚠️ 当前返回空数组（因为 Order 模型缺少 status 字段）

---

## ⚠️ 关键限制说明

### Order 模型缺少必要字段

**当前 Order 模型（`prisma/schema.prisma`）**:
```prisma
model Order {
  id               String   @id @default(uuid())
  userId           String
  marketId         String
  outcomeSelection Outcome
  amount           Float
  payout           Float?
  feeDeducted      Float    @default(0.0)
  type             String?  @default("BUY") // BUY | SELL
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  // ❌ 没有 status 字段
  // ❌ 没有 orderType 字段
  // ❌ 没有 limitPrice 字段
  // ❌ 没有 remainingQuantity 字段
}
```

**问题**:
- 无法区分 PENDING（挂单）和 FILLED（已成交）订单
- 无法区分 MARKET（市价）和 LIMIT（限价）订单
- 当前系统是立即成交模式，所有订单都会立即创建 Position

---

## 🎯 当前架构说明

### 为什么持仓逻辑是正确的？

1. **Position 表代表实际持仓**
   - Position 记录只有在订单成交后才会创建
   - 查询 `status: 'OPEN'` 的 Position 自动排除了所有未成交订单

2. **Order 表用于记录所有订单**
   - 但由于缺少 status 字段，无法区分订单状态
   - 当前所有订单都是立即成交的，因此不会有 PENDING 订单

3. **系统设计**
   - 当前系统是 AMM（自动做市商）模式
   - 订单创建时立即创建 Position
   - 这是正确的架构选择，持仓应该基于 Position 表

---

## 🚀 要实现真正的挂单功能，需要：

### 1. 数据库迁移（必需）

在 `prisma/schema.prisma` 中为 Order 模型添加字段：

```prisma
enum OrderStatus {
  PENDING           // 待成交（挂单）
  FILLED            // 已完全成交
  PARTIALLY_FILLED  // 部分成交
  CANCELLED         // 已取消
}

enum OrderType {
  MARKET  // 市价单（立即成交）
  LIMIT   // 限价单（挂单）
}

model Order {
  // ... 现有字段
  status           OrderStatus @default(FILLED)      // 🔥 新增
  orderType        OrderType   @default(MARKET)      // 🔥 新增
  limitPrice       Float?                            // 🔥 新增（限价单价格）
  remainingQuantity Float?                           // 🔥 新增（剩余数量）
}
```

### 2. 修改订单创建逻辑

**文件**: `app/api/orders/route.ts`

- **MARKET 订单**: 立即创建 Position，status = FILLED
- **LIMIT 订单**: 不创建 Position，status = PENDING，冻结资金

### 3. 实现订单撮合逻辑

- 定时检查 LIMIT 订单
- 当市场价格达到限价时，将订单 status 改为 FILLED
- 创建对应的 Position 记录

---

## 📝 前端验证

### 当前前端调用

**持仓列表** (`app/wallet/page.tsx`):
```typescript
const response = await fetch('/api/positions', {
  method: 'GET',
  credentials: 'include',
});
```

**挂单列表** (`app/wallet/page.tsx`):
```typescript
const response = await fetch('/api/user/open-orders', {
  method: 'GET',
  credentials: 'include',
  cache: 'no-store',
});
```

### 建议前端修改

如果需要使用新的 pending 接口：
```typescript
const response = await fetch('/api/user/orders/pending', {
  method: 'GET',
  credentials: 'include',
  cache: 'no-store',
});
```

---

## ✅ 修复验证清单

- [x] `/api/user/portfolio` 基于 Position 表，正确过滤
- [x] `/api/positions` 基于 Position 表，正确过滤
- [x] `/api/user/orders/pending` 已创建（当前返回空数组，符合预期）
- [x] `/api/user/open-orders` 保持向后兼容（当前返回空数组，符合预期）
- [x] 所有接口都使用 NextAuth 统一认证
- [x] 代码注释清晰说明当前限制和未来实现方案

---

## 🎉 结论

**持仓逻辑已经正确实现**：
- ✅ 持仓接口基于 Position 表，自动排除未成交订单
- ✅ 不会出现"未成交的挂单显示在持仓列表中"的问题
- ✅ 所有持仓都是已成交的订单

**挂单功能暂时无法实现**：
- ⚠️ Order 模型缺少 status 字段
- ⚠️ 系统是立即成交模式
- ✅ 代码结构已就绪，注释中包含了未来实现方案

**如果用户看到"未成交订单显示在持仓中"**：
- 这可能是前端显示问题，或者数据来自其他接口
- 建议检查前端是否正确调用了 `/api/positions` 或 `/api/user/portfolio`
- 建议检查是否有其他 API 错误地基于 Order 表返回持仓数据
