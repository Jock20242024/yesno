# 🔧 采集脚本彻底重写完成总结

## ✅ 已完成的修复

### 1. 精确解析数据路径

#### 交易量提取
- ✅ **遍历 events[0].markets 数组累加所有 market 的 volume**
  - 如果 market 有 `events` 数组，遍历 `events[0].markets` 累加所有 volume
  - 如果累加结果为 0，尝试使用 `event.active_volume` 或 `event.volume`
  - 如果仍然为 0，直接使用 `market.volumeNum` 或 `market.volume`
- ✅ **确保是非零数字** - 所有无效值默认为 0

#### 赔率/概率提取
- ✅ **从 `events[0].markets[0].outcomePrices` 或 `market.outcomePrices` 提取**
- ✅ **支持 JSON 字符串格式**（如 `"[\"0.7\", \"0.3\"]"`）和数组格式（如 `["0.7", "0.3"]`）
- ✅ **第一个值设为 `yesProbability`，第二个值设为 `noProbability`**
  - 例如：`["0.7", "0.3"]` -> `yesProbability = 70`, `noProbability = 30`
- ✅ **转换为 0-100 的整数**
- ✅ **必须处理空值**：如果 `outcomePrices` 不存在或格式不正确，跳过该事件

#### 截止日期解析
- ✅ 优先使用 `endDate`，其次使用 `endDateIso`
- ✅ 验证日期有效性，无效日期使用默认值

### 2. 强制更新逻辑 (Upsert Refresh)

- ✅ **不再因为 ID 存在就跳过** - 使用 `findFirst` + `update` 或 `create`
- ✅ **如果 ID 存在，强制更新以下字段**：
  - `totalVolume` - 强制更新交易量
  - `yesProbability` - 强制更新概率
  - `noProbability` - 强制更新概率
  - `updatedAt` - 更新时间戳
  - `title`, `description`, `closingDate`, `isHot` - 更新其他关键字段
- ✅ **保持 reviewStatus** - 如果之前是 `PUBLISHED`，保持 `PUBLISHED`；如果之前是 `PENDING`，保持 `PENDING`
- ✅ **已拒绝的市场跳过更新** - 如果 `reviewStatus === 'REJECTED'`，跳过更新

### 3. 抓取参数优化

- ✅ **使用 `order: 'volume'`** - 按交易量排序
- ✅ **使用 `ascending: false`** - 降序排列，确保抓回来的是全网最火的
- ✅ **保持 `limit: 100`** - 默认抓取 100 条

### 4. 数据处理优化

#### normalize() 方法
- ✅ 过滤掉没有 `outcomePrices` 的事件
- ✅ 支持从 `events[0].markets[0].outcomePrices` 或 `market.outcomePrices` 提取
- ✅ 必须有有效的 id 和 title/question

#### save() 方法
- ✅ **精确的字段提取逻辑**：
  - 交易量：从 `events[0].markets` 累加或使用 `market.volumeNum/volume`
  - 概率：从 `events[0].markets[0].outcomePrices` 或 `market.outcomePrices` 提取
- ✅ **空值处理**：如果 `outcomePrices` 不存在，跳过该事件
- ✅ **强制更新**：已存在的记录会被强制更新

---

## 📋 代码修改清单

### 主要修改

1. **`lib/scrapers/polymarketAdapter.ts`** - 完全重写
   - 重新定义接口 `PolymarketMarket`，支持 `events` 嵌套结构
   - 重写 `fetch()` 方法，使用 `order=volume&ascending=false`
   - 重写 `normalize()` 方法，精确验证 `outcomePrices` 存在性
   - 重写 `save()` 方法，实现精确的数据提取和强制更新逻辑

### 数据提取逻辑

```typescript
// 交易量提取（按优先级）：
1. 遍历 events[0].markets 数组累加所有 market.volumeNum 或 market.volume
2. 如果为 0，使用 events[0].active_volume 或 events[0].volume
3. 如果仍为 0，使用 market.volumeNum 或 market.volume

// 概率提取（按优先级）：
1. events[0].markets[0].outcomePrices
2. market.outcomePrices
3. 如果不存在，跳过该事件

// 概率计算：
outcomePrices = ["0.7", "0.3"]
-> yesProbability = Math.round((0.7 / (0.7 + 0.3)) * 100) = 70
-> noProbability = 100 - 70 = 30
```

---

## 🎯 关键改进

1. **数据路径精确** - 支持嵌套的 `events[0].markets` 结构和直接的 `market` 结构
2. **强制更新** - 确保每次采集都会更新已存在的数据，不会因为 ID 存在而跳过
3. **空值处理** - 严格按照要求，如果 `outcomePrices` 不存在，跳过该事件
4. **抓取最火数据** - 使用 `order=volume&ascending=false` 确保抓取全网最火的市场

---

## ✅ 完成状态

所有任务已完成：
- ✅ 精确解析数据路径（交易量、概率、日期）
- ✅ 强制更新逻辑（不再跳过已存在的记录）
- ✅ 抓取参数优化（order=volume, ascending=false）
- ✅ 空值处理（跳过没有 outcomePrices 的事件）

**采集脚本已彻底重写，确保数据真实有效！** 🎉
