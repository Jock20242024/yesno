# Order 状态字段迁移说明

## 📋 架构升级总结

已成功为 Order 模型添加状态字段，支持 CLOB（限价单）模式。

### ✅ 已完成的修改

#### 1. Prisma Schema 修改

**文件**: `prisma/schema.prisma`

**新增字段**:
```prisma
model Order {
  // ... 原有字段
  status      String   @default("PENDING") // PENDING | FILLED | CANCELLED | PARTIALLY_FILLED
  orderType   String   @default("MARKET")  // MARKET | LIMIT
  limitPrice  Float?   // 限价单的价格（仅限价单需要）
  filledAmount Float   @default(0.0) // 已成交数量
  // ...
}
```

**新增索引**:
```prisma
@@index([status])
@@index([orderType])
```

#### 2. 订单创建逻辑修改

**文件**: `app/api/orders/route.ts`

**核心变更**:
- ✅ 支持 `orderType` 参数（MARKET | LIMIT）
- ✅ 支持 `limitPrice` 参数（限价单必需）
- ✅ MARKET 订单：立即成交（status='FILLED'），创建 Position，更新 Market
- ✅ LIMIT 订单：挂单状态（status='PENDING'），不创建 Position，不更新 Market，冻结资金

#### 3. 挂单接口激活

**文件**: `app/api/user/orders/pending/route.ts`

**核心变更**:
- ✅ 查询 `status='PENDING'` 且 `orderType='LIMIT'` 的订单
- ✅ 返回完整的订单信息，包括 market 详情

---

## 🚀 数据库迁移步骤

### 步骤 1: 生成迁移文件

```bash
npx prisma migrate dev --name add_order_status_fields
```

或者使用 `db push`（开发环境）：

```bash
npx prisma db push
```

### 步骤 2: 验证迁移

检查数据库中的 `orders` 表，确认新字段已添加：
- `status` (String, default: 'PENDING')
- `orderType` (String, default: 'MARKET')
- `limitPrice` (Float, nullable)
- `filledAmount` (Float, default: 0.0)

### 步骤 3: 更新现有订单数据（可选）

如果需要为现有订单设置默认值：

```sql
-- 将所有现有订单设置为已成交状态（因为它们是立即成交的）
UPDATE orders SET status = 'FILLED', orderType = 'MARKET', filledAmount = amount WHERE status IS NULL OR status = '';
```

---

## 📝 API 使用说明

### 创建市价单（MARKET Order）

```typescript
POST /api/orders
{
  "marketId": "xxx",
  "outcomeSelection": "YES",
  "amount": 100,
  "orderType": "MARKET"  // 可选，默认 MARKET
}
```

**响应**:
- `order.status`: "FILLED"
- `order.orderType`: "MARKET"
- `position`: 创建的 Position 对象

### 创建限价单（LIMIT Order）

```typescript
POST /api/orders
{
  "marketId": "xxx",
  "outcomeSelection": "YES",
  "amount": 100,
  "orderType": "LIMIT",
  "limitPrice": 0.65  // 必需：限价（0-1 之间）
}
```

**响应**:
- `order.status`: "PENDING"
- `order.orderType`: "LIMIT"
- `order.limitPrice`: 0.65
- `position`: null（未创建）

### 查询挂单列表

```typescript
GET /api/user/orders/pending
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "xxx",
      "marketId": "yyy",
      "marketTitle": "市场标题",
      "orderType": "LIMIT",
      "status": "PENDING",
      "limitPrice": 0.65,
      "amount": 100,
      "filledAmount": 0,
      // ...
    }
  ]
}
```

---

## ⚠️ 重要注意事项

### 1. 资金冻结

- LIMIT 订单创建时，用户余额会立即扣除（冻结）
- 只有当订单成交时，才创建 Position
- 如果订单取消，需要返还冻结的资金

### 2. Market 价格更新

- MARKET 订单：立即更新 Market 的 `totalYes`/`totalNo`
- LIMIT 订单：**不更新** Market（因为还未成交）

### 3. 订单撮合（待实现）

当前实现只支持订单创建，**尚未实现订单撮合逻辑**。

要实现完整的限价单功能，还需要：
1. 实现订单撮合系统（定时检查 LIMIT 订单，当市场价格达到限价时成交）
2. 实现订单取消功能（返还冻结资金）
3. 实现部分成交支持（PARTIALLY_FILLED 状态）

---

## 🔄 向后兼容性

- ✅ 现有 API 调用（不提供 `orderType`）仍然工作，默认创建 MARKET 订单
- ✅ 现有订单数据保持兼容（新字段有默认值）
- ✅ 持仓接口逻辑不变（仍然基于 Position 表）

---

## 📊 数据流图

### MARKET 订单流程

```
用户下单 → 扣除余额 → 更新Market → 创建Order(status=FILLED) → 创建Position
```

### LIMIT 订单流程

```
用户下单 → 扣除余额(冻结) → 创建Order(status=PENDING) → [等待撮合]
                                                           ↓
                                                     订单撮合
                                                           ↓
                                                      更新Market → 创建Position → 更新Order(status=FILLED)
```

---

## ✅ 验证清单

- [x] Prisma Schema 已更新
- [x] 订单创建逻辑已修改
- [x] 挂单接口已激活
- [ ] 数据库迁移已执行（需要手动执行）
- [ ] 订单撮合逻辑（待实现）
- [ ] 订单取消功能（待实现）

---

## 🎯 下一步工作

1. **执行数据库迁移**（必需）
   ```bash
   npx prisma db push
   ```

2. **实现订单撮合系统**（可选，但推荐）
   - 定时检查 PENDING 的 LIMIT 订单
   - 当市场价格达到限价时，触发成交逻辑

3. **实现订单取消功能**（可选）
   - 允许用户取消 PENDING 订单
   - 返还冻结的资金

4. **测试**
   - 测试 MARKET 订单创建
   - 测试 LIMIT 订单创建
   - 测试挂单列表查询
   - 验证持仓列表不包含 PENDING 订单
