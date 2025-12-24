# 代码审计报告 - 市场分类查询与分配逻辑

## 🔍 第一步：审计市场列表 API 查询逻辑

### 1.1 取数过滤条件（app/api/markets/route.ts）

**代码位置**: `app/api/markets/route.ts:79`

```typescript
filteredMarkets = await DBService.getAllMarkets(category || undefined, includePending);
```

**实际查询逻辑**（lib/dbService.ts:194-234）:

```typescript
async getAllMarkets(categorySlug?: string, includePending: boolean = false): Promise<Market[]> {
  const where: any = {
    isActive: true, // 🔥 硬编码过滤：只返回未删除的市场
  };

  // 🔥 硬编码过滤：默认只返回已发布的市场
  if (!includePending) {
    where.reviewStatus = 'PUBLISHED';
  }
  
  if (categorySlug) {
    // 1. 先精准查出当前分类及其所有子分类的 ID
    const category = await prisma.category.findUnique({
      where: { slug: categorySlug },
      include: { children: { select: { id: true } } }
    });
    
    // 2. 严禁"裸奔"：如果 Slug 没对上，直接返回空数组
    if (!category) {
      console.warn(`⚠️ [DBService] 分类 ${categorySlug} 不存在，返回空数组`);
      return []; // ✅ 没有 Fallback 到全量市场
    }
    
    // 3. 构造 ID 集合（包含父类 ID 和所有子类 ID）
    const categoryIds = [category.id, ...(category.children?.map(c => c.id) || [])];
    
    // 4. 递归查询：只要市场属于这个 ID 集合中的任何一个，就显示
    where.categories = {
      some: {
        categoryId: { in: categoryIds }
      }
    };
  }
  
  // 实际 Prisma 查询
  dbMarkets = await prisma.market.findMany({
    where,
    include: {
      categories: {
        include: {
          category: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}
```

**关键发现**:
- ✅ **父子关联逻辑**: 有递归查询，使用 `categoryIds` 数组包含父类 ID 和所有子类 ID
- ✅ **Fallback 机制**: 如果 slug 找不到，返回 `[]`，**没有**返回全量市场的逻辑
- 🔥 **硬编码过滤**: `isActive: true` 和 `reviewStatus: 'PUBLISHED'`

### 1.2 前端过滤层（app/api/markets/route.ts:81-85）

```typescript
if (isFactoryOnlyCategory) {
  // 对这些子分类，只返回工厂生成的市场（source=INTERNAL）
  filteredMarkets = filteredMarkets.filter(market => (market as any).source === 'INTERNAL');
  console.log(`🔒 [Markets API] 子分类 '${category}' 强制过滤 source=INTERNAL，返回 ${filteredMarkets.length} 个工厂市场`);
}
```

**关键发现**:
- 🔥 **硬编码过滤**: 在 15m, 1h, 4h, daily 子分类下，强制过滤 `source: 'INTERNAL'`

---

## 🔍 第二步：排查数据的分配逻辑

### 2.1 工厂生成逻辑（lib/factory/engine.ts:557-563）

**代码位置**: `lib/factory/engine.ts:557-563`

```typescript
categories: {
  create: [
    {
      category: { connect: { id: categoryRecord.id } } // 🔥 必须物理连接到分类ID
    }
  ]
}
```

**关键发现**:
- ✅ **物理关联**: 使用 `categories.create` 在 `MarketCategory` 中间表中创建关联记录
- ✅ **使用 categoryRecord.id**: 直接使用查找到的分类 ID 进行关联

### 2.2 手动创建市场逻辑（app/api/admin/markets/route.ts:485-490）

**代码位置**: `app/api/admin/markets/route.ts:485-490`

```typescript
if (validCategoryConnect.length > 0) {
  marketData.categories = {
    create: validCategoryConnect.map(c => ({
      categoryId: c.id, // 🔥 直接使用 categoryId 字段，不需要嵌套 connect
    })),
  };
  console.log('✅ [Market API] 准备关联的分类:', validCategoryConnect.map(c => c.id));
} else {
  console.warn('⚠️ [Market API] 没有有效的分类，创建市场但不关联分类');
}
```

**关键发现**:
- ✅ **物理关联**: 使用 `categories.create` 在 `MarketCategory` 中间表中创建关联记录
- ✅ **使用 categoryId**: 直接使用分类 ID 数组进行关联

### 2.3 爬虫分配逻辑（lib/scrapers/polymarketAdapter.ts）

**代码位置**: `lib/scrapers/polymarketAdapter.ts:44-103, 744-759`

**分类映射函数** (`mapPolymarketCategory`):
```typescript
function mapPolymarketCategory(tags: string[] = [], title: string = ''): string | null {
  // 1. 标签匹配（优先）
  const categoryMap: Record<string, string> = {
    'crypto': 'crypto',
    'cryptocurrency': 'crypto',
    'bitcoin': 'crypto',
    'ethereum': 'crypto',
    'politics': 'politics',
    'sports': 'sports',
    // ... 更多映射
  };
  
  // 2. 标题关键词匹配（备选）
  const keywordMap: Record<string, string> = {
    'btc': 'crypto',
    'bitcoin': 'crypto',
    'president': 'politics',
    // ... 更多关键词
  };
  
  return categorySlug || null;
}
```

**分类关联逻辑** (744-759):
```typescript
// 获取或创建分类
let categoryId: string | null = null;
const categorySlug = mapPolymarketCategory(
  marketData.tags || [],
  title
);

if (categorySlug) {
  const category = await prisma.category.findFirst({
    where: { slug: categorySlug, status: 'active' },
  });
  if (category) {
    categoryId = category.id;
  }
}

// 更新或创建分类关联
if (categoryId) {
  const existingLink = await prisma.marketCategory.findFirst({
    where: {
      marketId: market.id,
      categoryId: categoryId,
    },
  });

  if (!existingLink) {
    await prisma.marketCategory.create({
      data: {
        marketId: market.id,
        categoryId: categoryId,
      },
    });
  }
}
```

**关键发现**:
- ✅ **物理关联**: 使用 `MarketCategory.create` 在中间表中创建关联记录
- ⚠️ **分类匹配**: 基于标签和标题关键词匹配，只匹配顶级分类（如 `crypto`, `politics`）
- ⚠️ **问题**: 爬虫抓取的市场可能被分配到父分类（如 `crypto`），而不是子分类（如 `crypto-15m`），这可能导致"全部"标签下显示的数据比子分类多

---

## 🔍 第三步：查清束缚与限制

### 3.1 硬编码过滤

**发现位置**:
1. `lib/dbService.ts:197`: `isActive: true`
2. `lib/dbService.ts:202`: `reviewStatus: 'PUBLISHED'`（除非 `includePending` 为 true）
3. `app/api/markets/route.ts:83`: 在 15m, 1h, 4h, daily 子分类下，强制过滤 `source: 'INTERNAL'`

### 3.2 分类路径锁定

**未发现**: 代码中没有强制要求 slug 必须符合特定格式（如 `crypto-xxx`）的逻辑。

### 3.3 缓存干扰

**发现位置**:
- `app/api/markets/route.ts:7`: `export const dynamic = 'force-dynamic';`
- `app/api/markets/route.ts:8`: `export const revalidate = 0;`

**关键发现**:
- ✅ API 已设置强制禁用缓存：`dynamic = 'force-dynamic'` 和 `revalidate = 0`
- ✅ **Redis 缓存**: 系统中存在 Redis 客户端（`lib/redis.ts`），但主要用于：
  - 差分同步架构（`lib/odds/diffSync.ts`）：缓存赔率数据
  - 任务队列（`lib/queue/oddsQueue.ts`）：BullMQ 队列存储
  - **不影响市场列表查询**：市场列表 API 不使用 Redis 缓存

---

## 📋 总结

### 查询逻辑
- ✅ 父子关联逻辑正确：使用 ID 集合包含父类和所有子类
- ✅ Fallback 机制正确：slug 不存在时返回空数组，不返回全量市场
- 🔥 硬编码过滤：`isActive: true` 和 `reviewStatus: 'PUBLISHED'`

### 分配逻辑
- ✅ 工厂生成：使用物理关联（MarketCategory 中间表）
- ✅ 手动创建：使用物理关联（MarketCategory 中间表）
- ⚠️ 爬虫分配：需要进一步检查

### 束缚与限制
- 🔥 硬编码过滤：`isActive: true`, `reviewStatus: 'PUBLISHED'`, `source: 'INTERNAL'`（特定子分类）
- ❌ 分类路径锁定：未发现强制要求 slug 格式的逻辑
- ✅ 缓存：API 已设置强制禁用缓存，Redis 不影响市场列表查询

---

## 🎯 核心问题分析

### 问题：为什么"全部 (15)"比"每周 (20)"少？

**根本原因**:

1. **爬虫分配逻辑问题** (`lib/scrapers/polymarketAdapter.ts`):
   - 爬虫使用 `mapPolymarketCategory` 函数匹配分类
   - 该函数只匹配**顶级分类**（如 `crypto`, `politics`）
   - 爬虫抓取的市场（如马斯克、MegaETH）被分配到父分类 `crypto`
   - 这些市场**没有**被分配到子分类（如 `crypto-每周`）

2. **查询逻辑正确**:
   - 查询"全部"（父类）时，应该包含所有子分类的市场
   - 查询"每周"（子类）时，应该只包含该子分类的市场
   - 但由于爬虫市场只关联到父分类，所以：
     - "全部"包含：父分类市场 + 所有子分类市场（工厂生成）
     - "每周"包含：只有该子分类市场（工厂生成）
     - 如果爬虫市场数量 > 工厂市场数量，就会出现"全部"比子分类多的情况

3. **硬编码过滤的影响**:
   - `source: 'INTERNAL'` 过滤只应用于特定子分类（15m, 1h, 4h, daily）
   - "每周"子分类**不受** `source: 'INTERNAL'` 过滤影响
   - 但查询逻辑本身使用 ID 集合，应该能正确包含所有关联的市场

### 解决方案建议

1. **检查数据库数据**:
   - 确认"全部"分类和"每周"子分类的实际 ID
   - 检查市场数据中，哪些市场关联到了哪些分类 ID
   - 验证爬虫市场是否正确关联到父分类

2. **修复查询逻辑**（如果确实有问题）:
   - 确认查询时是否正确获取了所有子分类 ID
   - 验证 `categoryIds` 数组是否包含所有应该包含的分类

3. **修复爬虫分配逻辑**（如果需要）:
   - 让爬虫也能分配到子分类，而不仅仅是父分类
   - 或者确保爬虫市场只关联到父分类，但查询时能正确包含它们