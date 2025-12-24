# 手动市场显示逻辑诊断 - 执行摘要

## ✅ 已完成的诊断准备工作

### 1. 数据库诊断脚本 ✅
- **文件**: `scripts/audit-manual-market.ts`
- **功能**: 查询所有 `manual-` 开头的市场，打印完整字段信息
- **执行命令**: `npx tsx scripts/audit-manual-market.ts`

### 2. API 深度日志 ✅
- **文件**: `app/api/markets/route.ts`
- **位置**: `category === 'hot' || category === '-1'` 分支
- **日志内容**:
  - Prisma Where 条件（JSON 格式）
  - 查询返回的原始记录数和 ID 列表
  - 聚合前后的数据对比
  - 最终返回的市场 ID 列表

### 3. 聚合函数日志 ✅
- **文件**: `lib/marketAggregation.ts`
- **位置**: `aggregateMarketsByTemplate` 函数
- **日志内容**:
  - 输入数据长度和 ID 列表
  - 输出数据长度和 ID 列表
  - 被丢弃的市场及原因
  - 消失的市场 ID（输入有但输出没有）

### 4. 前端过滤检查日志 ✅
- **文件**: `app/(public)/category/[slug]/CategoryClient.tsx`
- **位置**: 
  - API 响应处理（`fetchMarkets` 函数）
  - 数据转换（`useMemo` 中的 `filteredEvents`）
- **日志内容**:
  - API 返回的数据长度和 ID 列表
  - 手动市场数量统计
  - useMemo 输入输出对比

---

## 🔍 诊断执行步骤

### 第一步：创建测试市场
1. 在后台管理界面创建一个手动市场
2. 标题包含"测试"或任意内容
3. 确保 ID 以 `manual-` 开头（系统自动生成）
4. 设置状态: `status = "OPEN"`, `reviewStatus = "PUBLISHED"`, `isActive = true`
5. 关联"热门"分类（categoryId: "-1"）或设置 `isHot = true`

### 第二步：运行数据库诊断
```bash
npx tsx scripts/audit-manual-market.ts
```
**检查点**:
- 是否找到手动市场
- `status` 字段值
- `reviewStatus` 字段值
- `isHot` 字段值
- `categoryId` 关联情况
- `closingDate` 是否过期

### 第三步：测试 API 端点
**方法 1: 浏览器访问**
```
http://localhost:3000/api/markets?category=-1
```

**方法 2: 查看 Terminal 日志**
在 Next.js 开发服务器的 Terminal 中查看:
- `🔥 [Markets API] ========== 任务 2: API 逻辑准入点取证 ==========`
- Prisma 查询条件和结果
- 聚合前后的数据对比

**检查点**:
- 手动市场 ID 是否出现在查询结果中
- 手动市场是否被正确分类为 `independentMarkets`
- 最终返回的数组是否包含手动市场

### 第四步：检查前端渲染
1. 在浏览器中访问热门市场页面
2. 打开开发者工具 Console
3. 查看日志输出

**检查点**:
- API 返回的数据中是否包含手动市场
- `filteredEvents` 中是否包含手动市场
- 是否有任何过滤导致手动市场被移除

---

## 📊 问题定位判断标准

### 如果数据库诊断未找到市场
**问题**: 数据库层面
- 市场未被创建
- ID 格式不正确（不是 `manual-` 开头）
- 市场已被删除（`isActive = false`）

### 如果 API 查询未返回市场
**问题**: API 查询逻辑
**检查 Terminal 日志**:
- Prisma Where 条件是否包含 `{ id: { startsWith: 'manual-' } }`
- 手动市场是否满足 `status = 'OPEN'`, `reviewStatus = 'PUBLISHED'`, `isActive = true`
- 手动市场是否被错误地分类为 `marketsWithTemplate`（应该被分类为 `independentMarkets`）

### 如果 API 返回了但前端未显示
**问题**: 前端过滤或渲染
**检查浏览器 Console**:
- `filteredEvents` 长度是否小于 API 返回的数据长度
- 是否有手动市场在转换过程中丢失
- React Key 是否正确（应使用 `event.originalId || event.id`）

---

## 🎯 关键代码检查点

### API 查询条件（app/api/markets/route.ts:81-93）
```typescript
OR: [
  { isHot: true },
  { categories: { some: { categoryId: "-1" } } },
  { totalVolume: { gt: 100 } },
  { id: { startsWith: 'manual-' } }  // 🔥 关键：应该包含所有 manual- 开头的市场
]
```

### 聚合函数手动市场处理（lib/marketAggregation.ts:33-39）
```typescript
if (m.id && typeof m.id === 'string' && m.id.startsWith('manual-')) {
  key = m.id;
  isIndependentMarket = true;
  aggregatedMap.set(key, m);
  return; // 手动市场直接返回，不参与工厂市场的过滤逻辑
}
```

### 前端 React Key（CategoryClient.tsx: 渲染循环）
```typescript
key={event.originalId || event.id}  // 🔥 确保手动市场有唯一 Key
```

---

## 📝 诊断报告模板

执行完诊断后，请填写以下信息：

### 数据库状态
- [ ] 找到手动市场数量: ______
- [ ] status: ______
- [ ] reviewStatus: ______
- [ ] isHot: ______
- [ ] categoryId: ______
- [ ] isActive: ______
- [ ] closingDate 是否过期: ______

### API 查询结果
- [ ] Prisma 查询返回记录数: ______
- [ ] 手动市场是否在查询结果中: ______
- [ ] independentMarkets 数量: ______
- [ ] 最终返回记录数: ______
- [ ] 手动市场是否在最终返回中: ______

### 前端渲染结果
- [ ] API 返回数据长度: ______
- [ ] filteredEvents 长度: ______
- [ ] 手动市场是否在 filteredEvents 中: ______

### 问题定位
- [ ] 问题环节: 数据库 / API 查询 / 聚合逻辑 / 前端过滤 / 前端渲染
- [ ] 具体证据: ______

---

## 🚀 下一步

1. **立即执行**: 按照上述步骤执行诊断
2. **收集证据**: 记录所有日志输出
3. **定位问题**: 根据判断标准确定问题环节
4. **修复问题**: 根据定位结果进行针对性修复

详细的诊断报告请参考: `DIAGNOSTIC-REPORT.md`
