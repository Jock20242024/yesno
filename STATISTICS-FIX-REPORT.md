# 📊 统计数字修复报告

## 问题诊断结果

### 问题根源
**文件**: `app/api/categories/route.ts` 第135行

**错误代码**（修复前）:
```typescript
const whereCondition = isHotCategory 
  ? await buildHotMarketFilter()
  : {
      ...BASE_MARKET_FILTER,
      categories: {
        some: {
          categoryId: category.id  // ❌ 错误：只使用了父分类ID，没有包含子分类
        }
      }
    };
```

**问题分析**:
- 第100行已经通过 `getAllCategoryIds(category)` 获取了所有分类ID（父+子）
- 但在构建 `whereCondition` 时，非热门分类使用的是 `categoryId: category.id`（只包含父分类）
- 导致查询时没有包含子分类的市场，统计数字不正确

### 数据库查询验证
通过诊断脚本验证：
- 加密货币分类有6个子分类（15分钟、1小时、4小时、每天、每月、每周）
- 查询使用了 `categoryId: { in: categoryIds }` 后，查询到112个市场
- 唯一templateId+period组合有5个：
  1. BTC-15分钟: 6155c32e...-15 (101个场次)
  2. ETH-15分钟: e66af175...-15 (5个场次)
  3. BTC-1小时: 2c2c5107...-60 (3个场次，但已过期被时间过滤)
  4. ETH-1小时: f862efe4...-60 (2个场次，但已过期被时间过滤)
  5. 1个独立市场 (poly-...)

### 时间过滤验证
通过聚合逻辑验证：
- BTC-15分钟：101个场次，通过时间过滤2个（显示1个）
- ETH-15分钟：5个场次，通过时间过滤1个（显示1个）
- BTC-1小时：3个场次，全部被过滤（已过期，hoursUntilStart: -7）
- ETH-1小时：2个场次，全部被过滤（已过期，hoursUntilStart: -7）

**结论**：1小时系列被正确过滤（因为它们已经过期），这是符合业务逻辑的。统计应该显示2个15分钟系列 + 1个独立市场 = 3个。

---

## 修复内容

### 修复1：使用递归查询条件
**文件**: `app/api/categories/route.ts` 第114行

**修复后代码**:
```typescript
const whereCondition = isHotCategory 
  ? await buildHotMarketFilter()
  : {
      ...BASE_MARKET_FILTER,
      categories: {
        some: {
          categoryId: { in: categoryIds }, // ✅ 修复：使用递归的categoryIds，包含父分类及其所有子分类
        }
      }
    };
```

### 修复2：统一统计逻辑
**文件**: `app/api/categories/route.ts` 第119-166行

**修复内容**:
1. 删除了重复的 `markets` 查询（之前有两个查询，现在只保留一个）
2. 统一使用 `marketsForAggregation` 进行聚合
3. 使用 `aggregateMarketsByTemplate` 进行聚合，确保与前端逻辑一致
4. 添加了详细的日志，用于调试和验证

---

## 修复效果

### 修复前
- 统计数字：1（错误）
- 原因：查询条件只使用了父分类ID，没有包含子分类的市场

### 修复后
- 统计数字应该等于：聚合后的市场数量
- 加密货币分类应该显示：2个15分钟系列（BTC和ETH）+ 1个独立市场 = 3个
- 1小时系列由于已过期，会被时间过滤逻辑正确过滤掉

---

## 验证步骤

1. **递归查询验证**：
   - ✅ 使用 `getAllCategoryIds(category)` 获取所有分类ID
   - ✅ 查询条件使用 `categoryId: { in: categoryIds }` 包含所有子分类

2. **聚合逻辑验证**：
   - ✅ 使用 `aggregateMarketsByTemplate` 进行聚合
   - ✅ 时间过滤逻辑正确（过滤已过期和超过24小时的场次）

3. **统计数字验证**：
   - ✅ 统计数字 = 聚合后的数组长度
   - ✅ 与前端显示的市场数量一致

---

## 回答用户的问题

**问题**: "在计算加密货币的 uniqueMarketCount 时，那 2 个 15 分钟的系列到底在哪一步被丢掉了？"

**答案**: 
在修复前，它们在第135行的 `whereCondition` 中被丢掉了。因为查询条件使用了 `categoryId: category.id`（只包含父分类ID），而没有使用 `categoryId: { in: categoryIds }`（包含所有子分类ID）。

**修复后**：
- ✅ 查询条件现在使用 `categoryId: { in: categoryIds }`，包含所有子分类
- ✅ 2个15分钟系列（BTC和ETH）会被正确查询到
- ✅ 经过聚合和时间过滤后，应该显示2个系列
- ✅ 1小时系列由于已过期，会被正确过滤掉（这是符合业务逻辑的）
