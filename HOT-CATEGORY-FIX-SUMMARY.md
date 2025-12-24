# 🔥 热门分类查询参数修复总结

## 问题分析

**证据确凿**：前端控制台显示 API `/api/markets?category=-1` 返回的 `dataLength` 只有 1。

**根本原因**：
- 前端调用 `/api/markets?category=-1`（`-1` 是数据库中"热门"分类的 ID）
- 后端 API 只检查 `category === 'hot'`（`hot` 是"热门"分类的 slug）
- 当 `category === '-1'` 时，代码走到了 `else` 分支（普通分类筛选）
- `else` 分支调用 `DBService.getAllMarkets('-1')`，这会尝试查找 slug 为 `-1` 的分类
- 数据库中不存在 slug 为 `-1` 的分类，所以返回空数组或很少的数据

## 修复内容

### 修正查询参数识别逻辑
**文件**: `app/api/markets/route.ts`

**修复前**:
```typescript
if (category === 'hot') {
  // 热门市场查询逻辑
}
```

**修复后**:
```typescript
// 🔥 核心修复：处理 category === '-1' 或 category === 'hot'
// '-1' 是数据库中"热门"分类的 ID，"hot" 是其 slug
// 两者都应该执行热门市场的状态过滤逻辑，而不是分类 ID 过滤
if (category === 'hot' || category === '-1') {
  // 热门市场查询逻辑（使用状态过滤：isHot 或 totalVolume > 100）
}
```

**核心改进**:
1. **识别两种参数格式**：
   - `category=hot`（slug 格式）
   - `category=-1`（ID 格式）

2. **执行状态过滤而非分类 ID 过滤**：
   - 使用 `OR: [{ isHot: true }, { totalVolume: { gt: 100 } }]` 查询条件
   - 不限制 `categoryId`，因为"热门"是一个状态标签，而不是排他的物理分类
   - 一个属于"政治"分类的市场也可以是"热门"的

3. **查询逻辑**：
   ```typescript
   const dbMarkets = await prisma.market.findMany({
     where: {
       reviewStatus: 'PUBLISHED',
       isActive: true,
       OR: [
         { isHot: true }, // 手动标记的热门优先
         { totalVolume: { gt: 100 } } // 交易量 > 100
       ]
       // 注意：这里没有 categoryId 过滤条件
     },
     // ...
   });
   ```

## 技术说明

### 为什么 `-1` 和 `hot` 都要处理？

- **`hot`**：这是"热门"分类的 slug（slug 是 URL 友好的标识符）
- **`-1`**：这是"热门"分类在数据库中的 ID

前端可能通过不同的方式获取分类标识：
- 通过 slug（`hot`）
- 通过 ID（`-1`）

两种方式都应该被正确识别为"热门"分类。

### 为什么使用状态过滤而非分类 ID 过滤？

"热门"是一个**状态标签**，而不是**排他的物理分类**：
- 一个市场可以同时属于"政治"分类和"热门"状态
- 如果使用 `categoryId = -1` 过滤，只会返回明确标记为"热门"分类的市场
- 如果使用 `isHot: true` 或 `totalVolume > 100` 过滤，会返回所有符合热门条件的产品，无论它们的分类是什么

## 验证要点

- ✅ API 能正确识别 `category=-1` 参数
- ✅ API 能正确识别 `category=hot` 参数
- ✅ 两种参数都执行状态过滤逻辑（isHot 或 totalVolume）
- ✅ 不限制 categoryId，允许跨分类的热门市场
- ✅ 返回正确的市场数量（应该是 7 个，而不是 1 个）

## 修复文件清单

1. ✅ `app/api/markets/route.ts` - 修正 category 参数识别逻辑

所有修复已完成！
