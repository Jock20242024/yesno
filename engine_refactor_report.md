# 🔥 核心逻辑重构报告：强力匹配与实时赔率同步

**生成时间**: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

---

## 📋 重构目标

完全重写 `lib/factory/engine.ts` 中的匹配逻辑，解决以下问题：
1. 匹配逻辑太弱，无法识别 BTC/Bitcoin 等关系
2. 绑定成功后没有立即同步赔率，前端需要等待下一轮 Cron

---

## ✅ 核心修改

### 1. 植入完整资产别名字典

**位置**：`lib/factory/engine.ts` 第 551-597 行

**内容**：
- 完整的 `ASSET_ALIASES` 字典（40+ 资产）
- 从诊断脚本移植，确保匹配逻辑一致
- 覆盖所有常见资产的别名和全称

**示例**：
```typescript
'BTC': ['BITCOIN', 'BTC', 'XBT', 'BIT COIN'],
'ETH': ['ETHEREUM', 'ETH', 'ETHER'],
'SOL': ['SOLANA', 'SOL'],
// ... 40+ 资产
```

---

### 2. 重写 tryBindExternalId 函数

**位置**：`lib/factory/engine.ts` 第 729-777 行

**核心改进**：

#### 2.1 扩大时间窗口
- **从**：±15 分钟
- **到**：±30 分钟
- **原因**：防止时区/开盘延迟误差

#### 2.2 纯打分机制（不使用 if，只用 score）

**打分规则**：
- **名字命中别名**：+100分
- **时间每差1分钟**：-1分
- **状态一致性**：OPEN 匹配 OPEN +10分，CLOSED 匹配 CLOSED +5分
- **市场活跃度**：有 volume +5分

**自动修正**：
- 取最高分且 > 50分的候选项
- 直接绑定，无需人工干预

#### 2.3 新增参数
- `marketId?: string` - 用于实时同步赔率

---

### 3. 新增实时赔率同步函数

**位置**：`lib/factory/engine.ts` 第 654-711 行

**函数名**：`syncMarketOddsImmediately`

**功能**：
- 绑定成功后立即查询 Polymarket API
- 提取 `outcomePrices` 并更新数据库
- **不等待下一轮 Cron！**

**调用时机**：
1. `tryBindExternalId` 绑定成功后（如果提供了 `marketId`）
2. `createMarketFromTemplate` 市场创建后（如果已有 `externalId`）

---

### 4. 重写匹配评分函数

**位置**：`lib/factory/engine.ts` 第 790-864 行

**函数名**：`findBestMatchWithScoring`

**核心逻辑**：
```typescript
// 纯打分机制
let score = symbolScore; // 基础分：名字命中别名 +100分
score -= timeDiffMinutes; // 时间每差1分钟 -1分
if (localMarketStatus === 'OPEN' && m.closed === false) {
  score += 10; // OPEN 匹配 OPEN 额外加分
}
// ... 其他加分项

// 自动修正：取最高分且 > 50分
if (bestMatch.score > 50) {
  return { market: bestMatch.market, score: bestMatch.score };
}
```

---

### 5. 修改资产名称匹配函数

**位置**：`lib/factory/engine.ts` 第 599-626 行

**函数名**：`calculateSymbolMatchScore`（原 `isSymbolMatch`）

**改进**：
- 从返回 `boolean` 改为返回 `number`（0 或 100）
- 匹配成功返回 100 分，不匹配返回 0 分
- 支持纯打分机制

---

### 6. 更新调用点

#### 6.1 createMarketFromTemplate
**位置**：`lib/factory/engine.ts` 第 1318-1324 行

**修改**：
- 市场创建成功后，如果已有 `externalId`，立即同步赔率

#### 6.2 OddsRobot
**位置**：`lib/scrapers/oddsRobot.ts` 第 328-346 行

**修改**：
- 调用 `tryBindExternalId` 时传递 `market.id`
- 绑定成功后自动同步赔率（无需额外代码）

---

## 📊 完整数据流

```
市场创建/绑定请求
    ↓
tryBindExternalId
    ↓
findBestMatchWithScoring（纯打分机制）
    ↓
名字匹配：+100分
时间差异：每1分钟 -1分
状态一致性：+10分（OPEN匹配OPEN）
市场活跃度：+5分
    ↓
选择最高分且 > 50分的候选项
    ↓
绑定成功 → 更新数据库 externalId
    ↓
【实时同步】syncMarketOddsImmediately
    ↓
查询 Polymarket API → 提取 outcomePrices
    ↓
立即更新数据库 outcomePrices
    ↓
前端 SWR 轮询（5秒）→ 获取最新赔率
    ↓
前端显示实时赔率 ✅
```

---

## 🎯 预期效果

### 匹配能力提升
- ✅ **强力匹配**：能识别 BTC/Bitcoin、ETH/Ethereum 等关系
- ✅ **扩大时间窗口**：容忍 ±30 分钟的时间偏差
- ✅ **智能评分**：自动选择最佳匹配，无需人工干预

### 实时性提升
- ✅ **立即同步**：绑定成功后立即同步赔率
- ✅ **无需等待**：不等待下一轮 Cron
- ✅ **前端实时**：前端刷新即可看到赔率

---

## 📝 测试建议

1. **匹配测试**：
   - 创建 BTC 市场，验证能否匹配到 "Bitcoin" 相关市场
   - 创建 ETH 市场，验证能否匹配到 "Ethereum" 相关市场
   - 测试时间偏差较大的市场（±30 分钟内）

2. **实时同步测试**：
   - 创建新市场并绑定成功
   - 检查数据库：确认 `outcomePrices` 立即更新
   - 检查前端：刷新页面，确认赔率立即显示

3. **评分机制测试**：
   - 创建多个候选市场
   - 验证系统选择分数最高的匹配
   - 验证分数 < 50 的市场被拒绝

---

## 🔧 相关文件

### 修改的文件
- `lib/factory/engine.ts` - 完全重写匹配逻辑
- `lib/scrapers/oddsRobot.ts` - 更新调用点，传递 marketId

### 新增函数
- `syncMarketOddsImmediately` - 实时同步赔率
- `findBestMatchWithScoring` - 纯打分匹配机制
- `calculateSymbolMatchScore` - 资产名称匹配评分

### 修改函数
- `tryBindExternalId` - 完全重写，新增 marketId 参数
- `createMarketFromTemplate` - 添加实时同步逻辑

---

**重构完成** ✅
