# 手动市场显示逻辑全链路诊断报告

## 诊断时间
2025-12-23

## 诊断任务概览

本报告记录手动创建市场（ID 以 `manual-` 开头）在前端不显示的完整排查过程。

---

## 任务 1: 底层数据库物理状态取证

### 执行脚本
```bash
npx tsx scripts/audit-manual-market.ts
```

### 执行结果
```
📊 找到 0 个手动市场
⚠️  未找到任何以 manual- 开头的市场
```

### 结论
**当前数据库中没有以 `manual-` 开头的市场记录。**

### 下一步行动
1. 需要在后台创建一个标题包含"测试"的手动市场
2. 确保该市场的 ID 以 `manual-` 开头
3. 重新运行诊断脚本获取完整的字段信息

### 关键字段检查清单（待执行）
- [ ] `status` 字段值（期望: "OPEN"）
- [ ] `isHot` 字段值（期望: true/false）
- [ ] `categoryId` 关联（期望: 应有关联分类）
- [ ] `isActive` 字段值（期望: true）
- [ ] `reviewStatus` 字段值（期望: "PUBLISHED"）
- [ ] `closingDate` 是否过期（期望: 未过期）

---

## 任务 2: API 逻辑准入点取证

### 代码位置
`app/api/markets/route.ts` - `category === 'hot' || category === '-1'` 分支

### 添加的日志
已在以下位置添加深度日志：

1. **Prisma Where 条件打印**
   ```typescript
   console.log('📋 [Markets API] Prisma Where 条件:', JSON.stringify(whereCondition, null, 2));
   ```

2. **查询结果统计**
   ```typescript
   console.log(`📊 [Markets API] 查询返回的原始记录数: ${dbMarkets.length}`);
   console.log('📋 [Markets API] 查询返回的市场 ID 列表:');
   ```

3. **聚合前后对比**
   ```typescript
   console.log(`📊 [Markets API] 聚合项数量: ${marketsWithTemplate.length}, 独立项数量: ${independentMarkets.length}`);
   console.log(`📋 [Markets API] 最终返回的市场 ID 列表: ${filteredMarkets.map((m: any) => m.id).join(', ')}`);
   ```

### 关键查询条件
```typescript
where: {
  reviewStatus: 'PUBLISHED',
  isActive: true,
  status: 'OPEN',
  OR: [
    { isHot: true },
    { categories: { some: { categoryId: "-1" } } },
    { totalVolume: { gt: 100 } },
    { id: { startsWith: 'manual-' } }  // 🔥 强制包含手动市场
  ]
}
```

### 验证方法
1. 在浏览器中访问: `http://localhost:3000/api/markets?category=-1`
2. 检查控制台（Terminal）输出中的日志
3. 检查返回的 JSON 数组中是否包含 `manual-` 开头的 ID

### 待执行测试
- [ ] 访问 `/api/markets?category=-1` 并查看 Terminal 日志
- [ ] 确认手动市场 ID 是否出现在查询结果中
- [ ] 确认手动市场是否被正确分类为独立项（independentMarkets）

---

## 任务 3: 聚合逻辑去留取证

### 代码位置
`lib/marketAggregation.ts` - `aggregateMarketsByTemplate` 函数

### 添加的日志
已在函数开头和结尾添加数据长度对比：

1. **输入数据统计**
   ```typescript
   console.log(`📊 [Aggregation] 输入数据长度: ${markets.length}`);
   console.log(`📋 [Aggregation] 输入数据 ID 列表: ${markets.map(m => m.id).join(', ')}`);
   ```

2. **输出数据统计**
   ```typescript
   console.log(`📊 [Aggregation] 输出数据长度: ${result.length}`);
   console.log(`📋 [Aggregation] 输出数据 ID 列表: ${result.map(m => m.id).join(', ')}`);
   ```

3. **被丢弃市场追踪**
   ```typescript
   if (droppedMarkets.length > 0) {
     console.log(`⚠️  [Aggregation] 被丢弃的市场 (${droppedMarkets.length} 个):`);
     droppedMarkets.forEach(({ id, reason }) => {
       console.log(`   - ${id}: ${reason}`);
     });
   }
   ```

4. **消失市场检测**
   ```typescript
   const missingIds = Array.from(inputIds).filter(id => !outputIds.has(id));
   if (missingIds.length > 0) {
     console.log(`❌ [Aggregation] 消失的市场 ID (${missingIds.length} 个): ${missingIds.join(', ')}`);
   }
   ```

### 关键逻辑检查点

#### 手动市场处理逻辑（第 33-39 行）
```typescript
if (m.id && typeof m.id === 'string' && m.id.startsWith('manual-')) {
  key = m.id;
  isIndependentMarket = true;
  aggregatedMap.set(key, m);
  return; // 手动市场直接返回，不参与工厂市场的过滤逻辑
}
```

**预期行为**: 手动市场应该被直接添加到 `aggregatedMap`，不参与任何时间过滤逻辑。

### 待执行测试
- [ ] 确认手动市场是否进入聚合函数
- [ ] 确认手动市场是否被正确识别为独立市场
- [ ] 确认手动市场是否在输出结果中

---

## 任务 4: 前端静默过滤逻辑取证

### 代码位置
`app/(public)/category/[slug]/CategoryClient.tsx`

### 添加的日志

1. **API 返回数据检查**
   ```typescript
   console.log('🔍 [CategoryClient] API 返回的数据长度:', markets.length);
   console.log('🔍 [CategoryClient] API 返回的市场 ID 列表:', markets.map((m: any) => m.id).join(', '));
   const manualMarkets = markets.filter((m: any) => m.id && m.id.startsWith('manual-'));
   console.log(`🔍 [CategoryClient] 手动市场数量: ${manualMarkets.length}`);
   ```

2. **useMemo 转换检查**
   ```typescript
   console.log(`📊 [CategoryClient] useMemo 输入 (marketData 长度): ${marketData.length}`);
   console.log(`📊 [CategoryClient] useMemo 输出 (events 长度): ${events.length}`);
   const manualEvents = events.filter((e: any) => (e.originalId || e.id || '').toString().startsWith('manual-'));
   console.log(`📋 [CategoryClient] 事件中的手动市场数量: ${manualEvents.length}`);
   ```

### 关键检查点

#### convertMarketToEvent 函数（第 120 行）
- 检查是否有任何过滤条件在转换过程中被应用
- 检查 `originalId` 字段是否正确传递

#### filteredEvents useMemo（第 327 行）
- **当前实现**: 只是简单的 `map` 转换，没有额外过滤
- 需要检查是否有其他隐藏的过滤逻辑

### 待执行测试
- [ ] 在浏览器控制台查看日志输出
- [ ] 确认 `marketData` 中包含手动市场
- [ ] 确认 `filteredEvents` 中包含手动市场
- [ ] 检查 React DevTools 中的组件状态

---

## 诊断执行步骤

### 步骤 1: 创建测试市场
1. 在后台管理界面创建一个标题为"测试"的手动市场
2. 确保该市场的 ID 以 `manual-` 开头（通常系统会自动生成）
3. 确保该市场的状态为 `OPEN`，`reviewStatus` 为 `PUBLISHED`
4. 确保该市场关联了"热门"分类（categoryId: "-1"）或设置了 `isHot: true`

### 步骤 2: 运行数据库诊断脚本
```bash
npx tsx scripts/audit-manual-market.ts
```
记录输出中的所有字段值。

### 步骤 3: 测试 API 端点
```bash
# 在浏览器中访问
http://localhost:3000/api/markets?category=-1

# 或使用 curl
curl "http://localhost:3000/api/markets?category=-1" | jq '.data[] | select(.id | startswith("manual-"))'
```

检查 Terminal 中的日志输出，确认：
- Prisma 查询是否包含手动市场
- 手动市场是否出现在 `independentMarkets` 数组中
- 最终返回的数组中是否包含手动市场

### 步骤 4: 检查前端渲染
1. 在浏览器中访问热门市场页面
2. 打开浏览器开发者工具控制台
3. 查看日志输出，确认：
   - API 返回的数据中是否包含手动市场
   - `filteredEvents` 中是否包含手动市场
   - 是否有任何过滤逻辑导致手动市场被移除

### 步骤 5: 分析结果
根据上述步骤的输出，确定手动市场在哪个环节被过滤掉：

- **如果在步骤 2 中未找到市场**: 问题在数据库层面（市场未被正确创建或 ID 不正确）
- **如果在步骤 3 中 API 未返回市场**: 问题在 API 查询逻辑（Prisma where 条件或聚合逻辑）
- **如果 API 返回了但前端未显示**: 问题在前端过滤或渲染逻辑

---

## 预期诊断结果格式

### 如果问题在数据库层面
```
❌ 问题定位: 数据库物理状态异常
证据:
- status: "CLOSED" (期望: "OPEN")
- reviewStatus: "PENDING" (期望: "PUBLISHED")
- categoryId: null (期望: 应有关联分类)
```

### 如果问题在 API 层面
```
❌ 问题定位: API 查询逻辑过滤
证据:
- Prisma 查询返回 X 条记录，其中包含手动市场
- 但在 independentMarkets 过滤后，手动市场消失
- 或聚合函数丢弃了手动市场
```

### 如果问题在前端层面
```
❌ 问题定位: 前端静默过滤
证据:
- API 返回的数据中包含手动市场（ID: manual-xxx）
- filteredEvents 中不包含手动市场
- 在 convertMarketToEvent 或 useMemo 中存在隐藏过滤条件
```

---

## 下一步行动

1. **立即执行**: 创建测试市场并运行诊断脚本
2. **收集证据**: 记录所有日志输出和字段值
3. **定位问题**: 根据诊断结果确定问题环节
4. **修复问题**: 根据定位结果进行针对性修复

---

## 日志输出位置

- **数据库诊断**: Terminal 输出（运行脚本时）
- **API 日志**: Next.js 开发服务器 Terminal 输出
- **前端日志**: 浏览器开发者工具 Console 输出

---

## 注意事项

1. 确保开发服务器正在运行 (`npm run dev`)
2. 确保数据库连接正常
3. 确保测试市场的所有必需字段都已正确设置
4. 检查浏览器缓存，必要时清除缓存或使用无痕模式
