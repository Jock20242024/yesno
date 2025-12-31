# 持仓与挂单逻辑分离 - 当前状态说明

## 📋 架构分析

### 当前数据库模型状态

**Order 模型（`prisma/schema.prisma` 第 205-226 行）**：
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
  // ❌ 没有 orderType 字段（MARKET | LIMIT）
}
```

**Position 模型（`prisma/schema.prisma` 第 228-248 行）**：
```prisma
model Position {
  id        String         @id @default(uuid())
  userId    String
  marketId  String
  outcome   Outcome
  shares    Float          @default(0.0)
  avgPrice  Float          @default(0.0)
  status    PositionStatus @default(OPEN) // ✅ 有 status 字段 (OPEN | CLOSED)
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt
}
```

### 当前业务逻辑

**订单创建流程**（`app/api/orders/route.ts`）：
1. 用户下单 → 立即创建 Order 记录
2. **同时立即创建 Position 记录**（第 238-285 行）
3. 系统是 **立即成交模式（AMM）**，没有挂单概念

---

## ✅ 已正确实现的接口

### 1. `/api/user/portfolio` - 持仓接口

**状态**: ✅ **已正确**

**实现逻辑**:
- ✅ 基于 Position 表查询（不是 Order 表）
- ✅ 只查询 `status: 'OPEN'` 的持仓
- ✅ 自动排除未成交订单（因为只有成交后才创建 Position）

**代码位置**: `app/api/user/portfolio/route.ts` 第 38-59 行

**验证**: 该接口已经正确实现，**不需要修改**。

### 2. `/api/positions` - 持仓列表接口

**状态**: ✅ **已正确**

**实现逻辑**:
- ✅ 基于 Position 表查询
- ✅ 只查询 `status: 'OPEN'` 的持仓

**代码位置**: `app/api/positions/route.ts` 第 29-48 行

---

## ⚠️ 当前限制：挂单功能无法实现

### `/api/user/open-orders` - 挂单接口

**状态**: ⚠️ **受限于数据库模型**

**问题**:
- ❌ Order 模型**没有 `status` 字段**
- ❌ Order 模型**没有 `orderType` 字段**
- ❌ 当前系统是**立即成交模式**，所有订单都会立即创建 Position

**当前实现**:
- 返回空数组（因为无法区分 PENDING 和 FILLED 订单）

**代码位置**: `app/api/user/open-orders/route.ts` 第 64 行

---

## 🎯 要实现真正的挂单功能，需要：

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
  status    OrderStatus @default(FILLED)  // 🔥 新增
  orderType OrderType   @default(MARKET)  // 🔥 新增
  limitPrice Float?                        // 🔥 新增（限价单价格）
  remainingQuantity Float?                 // 🔥 新增（剩余数量）
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

## 📝 当前修复状态

### ✅ 已修复

1. **`/api/user/portfolio`**: 基于 Position 表，正确过滤
2. **`/api/users/[user_id]`**: 已修复，改为基于 Position 表查询持仓

### ⚠️ 暂时无法修复（需要数据库迁移）

1. **`/api/user/open-orders`**: 返回空数组（因为 Order 模型缺少 status 字段）

---

## 🚀 建议的下一步

如果用户需要真正的挂单功能：

1. **执行数据库迁移**，添加 status 和 orderType 字段到 Order 模型
2. **修改订单创建逻辑**，支持 LIMIT 订单
3. **实现订单撮合系统**
4. **更新 open-orders API**，查询 status='PENDING' 的订单

如果当前系统不需要挂单功能（立即成交模式），那么：
- ✅ 持仓接口已经正确
- ✅ 挂单列表为空是正常的（因为没有真正的挂单）
