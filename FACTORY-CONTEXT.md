# 自动化工厂运行监控与熔断系统 - Context 文档

## 📋 概述

本文档总结了自动化工厂（Market Factory）的运行监控与熔断系统的核心实现细节、架构设计和关键代码逻辑。

**文档用途**: 为新的 AI Agent 提供上下文，帮助理解系统的实现方式和设计决策。

**相关文档**: 
- `FACTORY-CIRCUIT-BREAKER-SETUP.md` - 部署和使用指南
- `lib/factory/engine.ts` - 核心引擎实现

---

## 🏗️ 系统架构

### 核心组件

1. **工厂引擎** (`lib/factory/engine.ts`)
   - 自动化创建市场
   - ExternalId 绑定逻辑
   - 熔断机制实现

2. **监控面板** (`app/admin/(protected)/factory/page.tsx`)
   - 实时运行状态显示
   - 模版列表管理
   - 手动触发功能

3. **模版编辑** (`app/admin/(protected)/factory/templates/[template_id]/edit/page.tsx`)
   - 模版配置修改
   - 行权价偏移量设置

4. **API 层**
   - `/api/admin/factory/stats` - 统计信息
   - `/api/admin/factory/templates/[template_id]/trigger` - 手动触发
   - `/api/admin/factory/templates/[template_id]` - 模版管理

---

## 🗄️ 数据库 Schema 变更

### MarketTemplate 模型新增字段

```prisma
model MarketTemplate {
  // ... 原有字段 ...
  
  status        String   @default("ACTIVE") // ACTIVE | PAUSED
  failureCount  Int      @default(0)        // 连续失败计数（用于熔断）
  priceOffset   Float    @default(0.0)      // 行权价偏移量（美元）
  pauseReason   String?                     // 熔断原因
  
  @@index([status]) // 新增索引
}
```

**重要**: 
- 所有新字段都有默认值，兼容旧数据
- `status` 字段优先于 `isActive` 字段（向后兼容）

---

## 🔄 核心工作流程

### 1. 市场创建流程

```
1. shouldCreateMarket() 检查是否应该创建
   ├─ 检查 status !== 'PAUSED' && isActive === true
   └─ 计算下一个周期时间点

2. createMarketFromTemplate() 创建市场
   ├─ 获取 Oracle 价格
   ├─ 应用 priceOffset 偏移量
   ├─ 生成市场标题和描述
   ├─ 创建市场记录（Prisma）
   └─ 尝试绑定 externalId

3. tryBindExternalId() 绑定外部 ID
   ├─ 调用 Polymarket API 搜索
   ├─ 匹配 symbol + period
   └─ 更新市场 externalId

4. 结果处理
   ├─ 成功 → resetFailureCount() 重置计数
   └─ 失败 → recordFailureAndCheckCircuitBreaker() 记录失败
```

### 2. 熔断机制

**触发条件**:
- ExternalId 绑定失败时，`failureCount` +1
- 当 `failureCount >= 3` 时，自动触发熔断

**熔断操作**:
```typescript
updateData.status = 'PAUSED';
updateData.isActive = false;
updateData.pauseReason = '由于数据源丢失已自动熔断';
```

**重置条件**:
- ExternalId 绑定成功时，自动重置 `failureCount = 0`

**关键常量**:
```typescript
const FAILURE_THRESHOLD = 3; // 连续失败 3 次触发熔断
```

---

## 🔌 ExternalId 绑定逻辑

### 绑定流程

```typescript
async function tryBindExternalId(
  marketTitle: string, 
  symbol: string, 
  period: number
): Promise<string | null>
```

**搜索策略**:
1. 构建搜索关键词: `${symbol} ${period}min`
2. 调用 Polymarket Gamma API: `https://gamma-api.polymarket.com/markets?closed=false&limit=100&query=${searchQuery}`
3. 匹配逻辑:
   - 查找 `question` 或 `slug` 包含 `symbol` 的市场
   - 返回第一个匹配的市场 ID

**错误处理**:
- API 请求失败 → 返回 `null`（不抛出异常）
- 未找到匹配 → 返回 `null`
- 所有错误都会记录到日志，但不中断流程

---

## 💰 行权价偏移量机制

### 计算逻辑

```typescript
const baseStrikePrice = await getPrice(template.symbol);
const priceOffset = template.priceOffset || 0;
const strikePrice = baseStrikePrice + priceOffset;
```

**用途**:
- 运营人员可以调整盘口的博弈难度
- 正数：提高行权价（降低 Yes 获胜概率）
- 负数：降低行权价（提高 Yes 获胜概率）

**使用场景**:
- 市场过热时，提高行权价降温
- 市场冷清时，降低行权价吸引用户
- A/B 测试不同偏移量对交易量的影响

---

## 📊 监控面板数据

### 统计指标

1. **运行中的模版** (`activeTemplates`)
   ```typescript
   templates.filter(t => {
     const status = t.status || (t.isActive ? 'ACTIVE' : 'PAUSED');
     return status === 'ACTIVE' && t.isActive;
   }).length
   ```

2. **今日生成总数** (`todayGenerated`)
   ```typescript
   prisma.market.count({
     where: {
       createdAt: { gte: today },
       source: 'INTERNAL',
     },
   })
   ```

3. **异常熔断数** (`pausedTemplates`)
   ```typescript
   templates.filter(t => {
     const status = t.status || (t.isActive ? 'ACTIVE' : 'PAUSED');
     return status === 'PAUSED';
   }).length
   ```

### 刷新机制

- 前端每 3 秒自动调用 `/api/admin/factory/stats`
- 统计数据实时反映系统状态

---

## 🎨 UI 状态显示

### 模版状态标识

**颜色编码**:
- 🟢 **绿色**: `status === 'ACTIVE' && isActive === true` → "激活"
- 🔴 **红色**: `status === 'PAUSED'` → "已熔断"（背景变红，显示 `pauseReason`）
- ⚪ **灰色**: `isActive === false` → "停用"

**失败计数显示**:
- `failureCount === 0`: 灰色文本 "0"
- `1 <= failureCount < 3`: 黄色标签 "X/3"
- `failureCount >= 3`: 红色标签 "3/3"（已熔断）

### 按钮状态

- **立即生成**: 仅在 `status !== 'PAUSED'` 时可用
- **编辑**: 始终可用，跳转到编辑页面
- **暂停/激活**: 切换 `isActive` 状态

---

## 🔐 API 权限控制

所有 Factory API 都需要管理员权限：

```typescript
const session = await auth();
const userRole = (session.user as any).role;
const userEmail = session.user.email;
const adminEmail = 'yesno@yesno.com';

if (userRole !== 'ADMIN' && userEmail !== adminEmail) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

---

## 🛠️ 关键代码位置

### 后端核心逻辑

| 功能 | 文件路径 | 关键函数 |
|------|---------|---------|
| 熔断逻辑 | `lib/factory/engine.ts` | `recordFailureAndCheckCircuitBreaker()` |
| ExternalId 绑定 | `lib/factory/engine.ts` | `tryBindExternalId()` |
| 市场创建 | `lib/factory/engine.ts` | `createMarketFromTemplate()` |
| 失败计数重置 | `lib/factory/engine.ts` | `resetFailureCount()` |
| 统计 API | `app/api/admin/factory/stats/route.ts` | `GET()` |
| 手动触发 | `app/api/admin/factory/templates/[template_id]/trigger/route.ts` | `POST()` |

### 前端核心组件

| 功能 | 文件路径 | 关键组件/函数 |
|------|---------|-------------|
| 监控面板 | `app/admin/(protected)/factory/page.tsx` | `FactoryPage` |
| 模版编辑 | `app/admin/(protected)/factory/templates/[template_id]/edit/page.tsx` | `TemplateEditPage` |
| 统计刷新 | `app/admin/(protected)/factory/page.tsx` | `fetchStats()` |
| 手动触发 | `app/admin/(protected)/factory/page.tsx` | `handleTriggerGeneration()` |

---

## ⚠️ 重要注意事项

### 1. 数据库迁移

**必须执行**:
```bash
npx prisma migrate dev --name add_factory_circuit_breaker_fields
npx prisma generate
```

否则新字段在运行时会是 `undefined`，导致逻辑错误。

### 2. 向后兼容

代码中大量使用 `(template as any).status` 和 `template.status || default` 来处理旧数据：
- 旧模版没有 `status` 字段时，使用 `isActive` 推导
- 旧模版没有 `failureCount` 时，默认 `0`
- 旧模版没有 `priceOffset` 时，默认 `0.0`

### 3. Polymarket API 依赖

ExternalId 绑定依赖 Polymarket Gamma API：
- API URL: `https://gamma-api.polymarket.com/markets`
- 如果 API 变更，需要修改 `tryBindExternalId()` 函数
- 绑定失败不影响市场创建，只是无法同步外部赔率

### 4. 熔断阈值

当前设置为连续失败 3 次，可在 `lib/factory/engine.ts` 修改：
```typescript
const FAILURE_THRESHOLD = 3; // 可调整
```

### 5. 周期性检查

`checkAndCreateMarkets()` 函数需要被定期调用（如 cron job）：
- 建议频率：每 30 秒或 1 分钟
- 检查所有 `status === 'ACTIVE'` 的模版
- 根据 `advanceTime` 决定是否创建新市场

---

## 🔍 调试技巧

### 查看熔断日志

```typescript
// 熔断触发时会输出：
console.warn(`🔴 [FactoryEngine] 模板 ${templateId} 触发熔断：连续失败 ${newFailureCount} 次`);
```

### 查看绑定失败日志

```typescript
// ExternalId 绑定失败时会输出：
console.warn(`⚠️ [FactoryEngine] externalId 绑定失败: ${error.message}`);
```

### 检查模版状态

在数据库中查询：
```sql
SELECT id, name, status, "failureCount", "priceOffset", "pauseReason" 
FROM market_templates 
WHERE status = 'PAUSED';
```

---

## 📚 相关技术栈

- **Next.js 14** (App Router) - 前端框架
- **Prisma ORM** - 数据库操作
- **NextAuth v5** - 权限验证
- **TypeScript** - 类型安全
- **Polymarket Gamma API** - 外部数据源

---

## 🚀 扩展建议

### 未来优化方向

1. **自动恢复机制**
   - 熔断后定时重试（如：每小时重试一次）
   - 成功恢复后自动将状态改回 `ACTIVE`

2. **通知系统**
   - 熔断时发送邮件/短信通知管理员
   - 集成 Slack/Discord Webhook

3. **历史记录**
   - 创建 `FactoryLog` 表记录每次创建和绑定操作
   - 提供历史查询和统计分析

4. **批量操作**
   - 批量重置熔断的模版
   - 批量修改 `priceOffset`

5. **A/B 测试**
   - 同一模版创建多个变体（不同 `priceOffset`）
   - 对比交易量差异

---

## 📝 版本历史

- **v1.0** (2024-12): 初始实现
  - 基础熔断机制
  - ExternalId 绑定
  - 监控面板
  - 行权价偏移量

---

**最后更新**: 2024-12-XX
**维护者**: AI Agent (参考此文档进行维护和扩展)












































































































