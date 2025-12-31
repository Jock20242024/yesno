# 市价单调试日志增强报告

## 📋 修复内容

### 1. 请求体解析优化

**修复前**:
- 可能在错误处理中重复调用 `request.json()`
- 没有提前解析请求体

**修复后**:
- 在函数开始时立即解析请求体
- 保存到 `requestBody` 变量，避免重复解析
- 在错误处理中使用已解析的 `requestBody`

### 2. 详细错误日志

添加了以下调试日志：

#### a. 请求数据日志
```typescript
console.log('🔍 [Orders API] 接收到请求数据:', {
  marketId,
  outcomeSelection,
  amount,
  orderType,
  limitPrice,
  amountType: typeof amount,
  orderTypeType: typeof orderType,
  limitPriceType: typeof limitPrice,
});
```

#### b. 订单类型和状态日志
```typescript
console.log('🔍 [Orders API] 订单类型和状态:', {
  validOrderType,
  orderStatus: safeOrderStatus,
  filledAmount: safeFilledAmountValue,
  amountNum,
  isAmountValid: isFinite(amountNum) && !isNaN(amountNum),
});
```

#### c. 准备创建订单日志
```typescript
console.log('🔍 [Orders API] 准备创建订单:', {
  orderType: validOrderType,
  status: safeOrderStatus,
  limitPrice: orderData.limitPrice,
  amount: safeAmount,
  filledAmount: safeFilledAmount,
  feeDeducted: safeFeeDeducted,
  userId: userId,
  marketId: marketId,
  outcomeSelection: outcomeSelection,
});
```

#### d. 错误详情日志
```typescript
console.error('🔥 [Orders API] 下单失败:', error);
console.error('📦 [Orders API] 尝试写入的数据:', {
  userId,
  marketId,
  amount: amountNum,
  orderType: validOrderType,
  limitPrice: limitPrice || null,
  status: validOrderType === 'MARKET' ? 'FILLED' : 'PENDING',
  outcomeSelection,
});
console.error('📋 [Orders API] 错误详情:', {
  message: error.message,
  stack: error.stack,
  name: error.name,
  code: (error as any).code,
  meta: (error as any).meta,
});
```

### 3. 数据清洗 (Sanitization)

添加了全面的数据清洗逻辑，防止 `NaN` 或 `undefined` 导致崩溃：

```typescript
// 订单状态和填充金额
const safeOrderStatus = validOrderType === 'MARKET' ? 'FILLED' : 'PENDING';
const safeFilledAmountValue = validOrderType === 'MARKET' 
  ? (isNaN(amountNum) || !isFinite(amountNum) ? 0 : amountNum)
  : 0.0;

// 所有数值字段清洗
const safeAmount = isNaN(amountNum) || !isFinite(amountNum) || amountNum <= 0 ? 0 : amountNum;
const safeFeeDeducted = isNaN(feeDeducted) || !isFinite(feeDeducted) || feeDeducted < 0 ? 0 : feeDeducted;
const safeFilledAmount = isNaN(safeFilledAmountValue) || !isFinite(safeFilledAmountValue) || safeFilledAmountValue < 0 
  ? (validOrderType === 'MARKET' ? safeAmount : 0) 
  : safeFilledAmountValue;
```

### 4. Prisma 错误处理增强

添加了 Prisma 特定错误处理：

```typescript
// Prisma 唯一约束违反
if ((error as any).code === 'P2002') {
  console.error('❌ [Orders API] Prisma 唯一约束违反:', (error as any).meta);
  return NextResponse.json({
    success: false,
    error: 'Order already exists',
  }, { status: 409 });
}

// Prisma 外键约束违反
if ((error as any).code === 'P2003') {
  console.error('❌ [Orders API] Prisma 外键约束违反:', (error as any).meta);
  return NextResponse.json({
    success: false,
    error: 'Invalid reference (user or market not found)',
  }, { status: 400 });
}
```

## 🔍 如何使用日志进行调试

### 1. 查看终端输出

当市价单失败时，终端会显示：

```
🔍 [Orders API] 接收到请求数据: { ... }
🔍 [Orders API] 订单类型和状态: { ... }
🔍 [Orders API] 准备创建订单: { ... }
🔥 [Orders API] 下单失败: Error: ...
📦 [Orders API] 尝试写入的数据: { ... }
📋 [Orders API] 错误详情: { ... }
```

### 2. 检查关键字段

- **amount**: 确保是有效的数字
- **orderType**: 应该是 'MARKET' 或 'LIMIT'
- **limitPrice**: MARKET 订单应该为 null
- **status**: MARKET 订单应该为 'FILLED'
- **filledAmount**: MARKET 订单应该等于 amount

### 3. Prisma 错误代码

- `P2002`: 唯一约束违反（订单 ID 重复）
- `P2003`: 外键约束违反（userId 或 marketId 无效）

## ✅ 修复验证清单

- [x] 请求体解析优化（避免重复调用）
- [x] 添加详细的请求数据日志
- [x] 添加订单类型和状态日志
- [x] 添加准备创建订单日志
- [x] 添加详细的错误日志
- [x] 数据清洗逻辑（防止 NaN/undefined）
- [x] Prisma 特定错误处理
- [x] 最外层错误捕获

所有调试日志已添加。当市价单失败时，终端会显示详细的错误信息，帮助快速定位问题。
