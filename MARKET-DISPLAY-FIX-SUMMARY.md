# 🔥 市场展示逻辑修复总结

## 问题分析

### 问题 1: 4 vs 2 显示缺失
**症状**：'全部'标签显示(4)，但只渲染了2个15分钟卡片，1小时卡片消失了。

**根本原因**：聚合逻辑使用 `templateId` 作为唯一键，导致同一个 templateId 但不同 period（15m 和 1h）的市场被合并成一个。

### 问题 2: 图标硬编码
**症状**：所有市场都显示比特币图标，无论是 BTC、ETH 还是独立市场（如 Musk、体育事件）。

**根本原因**：`convertMarketToEvent` 函数中硬编码 `icon: "Bitcoin"`，没有根据市场类型动态匹配图标。

## 修复内容

### 1. 修正聚合逻辑（按 templateId + period 聚合）
**文件**: `lib/marketAggregation.ts`

**修复前**:
```typescript
if (mAny.templateId) {
  key = mAny.templateId; // 只使用 templateId，导致不同 period 被合并
}
```

**修复后**:
```typescript
if (mAny.templateId) {
  // 🔥 核心修复：使用 templateId + period 作为聚合键
  // 原因：同一个 templateId 可能有不同的 period（15m, 1h），它们应该作为不同的展示项
  // 例如：BTC-15m 和 BTC-1h 应该显示为两个不同的卡片
  const period = mAny.period || '15';
  key = `${mAny.templateId}-${period}`;
}
```

**核心改进**:
- 使用 `templateId + period` 组合作为聚合键
- 确保 BTC-15m 和 BTC-1h 显示为两个不同的卡片
- ETH-15m 和 ETH-1h 也显示为两个不同的卡片

### 2. 动态图标匹配逻辑
**文件**: `app/(public)/category/[slug]/CategoryClient.tsx` 和 `components/MarketCard.tsx`

**修复前**:
```typescript
icon: "Bitcoin", // 硬编码
iconColor: "bg-[#f7931a]", // 硬编码
```

**修复后**:
```typescript
// 🔥 核心修复：动态匹配图标
// 如果是工厂市场：根据 symbol/asset 或标题中的币种匹配
// 如果是独立市场：根据分类匹配
let iconName = "Bitcoin";
let iconColor = "bg-[#f7931a]";

if (market.templateId || market.isFactory) {
  // 工厂市场：根据 symbol/asset 匹配
  const symbol = (market.symbol || market.asset || '').toUpperCase();
  const title = (market.title || '').toUpperCase();
  
  if (symbol.includes('BTC') || title.includes('BTC') || title.includes('比特币')) {
    iconName = 'Bitcoin';
    iconColor = 'bg-[#f7931a]'; // 橙色
  } else if (symbol.includes('ETH') || title.includes('ETH') || title.includes('以太坊')) {
    iconName = 'Coins';
    iconColor = 'bg-[#627EEA]'; // 以太坊蓝色
  } else {
    iconName = 'Coins';
    iconColor = 'bg-[#627EEA]';
  }
} else {
  // 独立市场：根据分类匹配
  const categorySlug = (market.categorySlug || '').toLowerCase();
  const category = (market.category || '').toLowerCase();
  
  if (categorySlug.includes('politic') || category.includes('政治')) {
    iconName = 'Building2';
    iconColor = 'bg-blue-800';
  } else if (categorySlug.includes('sport') || category.includes('体育')) {
    iconName = 'Trophy';
    iconColor = 'bg-orange-600';
  } else if (categorySlug.includes('tech') || category.includes('科技')) {
    iconName = 'Bot';
    iconColor = 'bg-purple-600';
  } else if (categorySlug.includes('finance') || category.includes('金融')) {
    iconName = 'Building2';
    iconColor = 'bg-blue-800';
  } else if (categorySlug.includes('crypto') || category.includes('加密货币')) {
    iconName = 'Coins';
    iconColor = 'bg-[#627EEA]';
  }
}
```

### 3. 确保 API 返回 symbol 字段
**文件**: `app/api/markets/route.ts`

**修复内容**:
```typescript
symbol: (dbMarket as any).symbol || null, // 🔥 添加 symbol 字段，用于图标匹配
```

### 4. 传递模板相关信息到前端
**文件**: `app/(public)/category/[slug]/CategoryClient.tsx`

**修复内容**:
```typescript
// 🔥 添加模板相关信息，用于图标匹配
templateId: (market as any).templateId || null,
isFactory: (market as any).isFactory || false,
symbol: (market as any).symbol || null,
asset: (market as any).asset || null,
period: (market as any).period || null,
```

## 图标匹配规则

### 工厂市场（有 templateId 或 isFactory）
- **BTC** → `Bitcoin` 图标，橙色 (`bg-[#f7931a]`)
- **ETH** → `Coins` 图标，蓝色 (`bg-[#627EEA]`)
- **其他** → `Coins` 图标，蓝色

### 独立市场（没有 templateId）
- **政治** → `Building2` 图标，蓝色 (`bg-blue-800`)
- **体育** → `Trophy` 图标，橙色 (`bg-orange-600`)
- **科技** → `Bot` 图标，紫色 (`bg-purple-600`)
- **金融** → `Building2` 图标，蓝色 (`bg-blue-800`)
- **加密货币** → `Coins` 图标，蓝色 (`bg-[#627EEA]`)
- **默认** → `Bitcoin` 图标，橙色

## 验证要点

- ✅ '全部'标签下显示 4 个卡片：BTC-15m, ETH-15m, BTC-1h, ETH-1h
- ✅ BTC 市场显示橙色 Bitcoin 图标
- ✅ ETH 市场显示蓝色 Coins 图标
- ✅ 独立市场（如 Musk、体育事件）根据分类显示对应图标，不再是比特币图标
- ✅ 聚合逻辑按 `templateId + period` 组合聚合，不同周期不会合并

## 修复文件清单

1. ✅ `lib/marketAggregation.ts` - 修正聚合键逻辑（使用 templateId + period）
2. ✅ `app/(public)/category/[slug]/CategoryClient.tsx` - 动态图标匹配
3. ✅ `components/MarketCard.tsx` - 动态图标匹配（同步方式）
4. ✅ `app/api/markets/route.ts` - 确保返回 symbol 字段
5. ✅ `lib/marketIconUtils.ts` - 图标工具函数（新建）

所有修复已完成！
