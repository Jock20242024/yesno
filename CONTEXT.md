# YesNo App - 项目上下文文档

> **最后更新**: 2025-12-20  
> **项目阶段**: 生产就绪，核心功能已完善  
> **主要状态**: 数据隔离、分类管理、市场创建、统计计算、赔率监控等功能已修复并稳定运行

---

## 📋 项目概述

**YesNo** 是一个基于 Next.js 14 的预测市场平台，参考 Polymarket 的设计。用户可以创建和交易各类事件的预测市场（YES/NO 二元期权）。

### 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **数据库**: PostgreSQL + Prisma ORM
- **认证**: NextAuth v5 + 自定义 Auth Core (双认证系统)
- **UI**: React 18 + Tailwind CSS + Lucide Icons
- **状态管理**: React Context API
- **通知**: Sonner (Toast Notifications)

---

## 🗄️ 数据库架构

### 核心模型

#### User (用户)
- `id`: UUID (主键)
- `email`: String (唯一)
- `passwordHash`: String? (可空，OAuth 用户可能为空)
- `balance`: Float (用户余额)
- `isAdmin`: Boolean (管理员标识)
- `isBanned`: Boolean (封禁状态)
- `walletAddress`: String? (可空，无唯一约束)

#### Market (市场)
- `id`: UUID (主键)
- `title`: String (市场标题)
- `status`: MarketStatus (OPEN | CLOSED | RESOLVED | CANCELED | PENDING_REVIEW)
- `reviewStatus`: ReviewStatus (PENDING | PUBLISHED | REJECTED) - **重要：只有 PUBLISHED 的市场才会在前端显示**
- `source`: MarketSource (POLYMARKET | INTERNAL)
- `isActive`: Boolean (软删除标记，false 表示已删除)
- `totalVolume`, `totalYes`, `totalNo`: Float (交易量统计)
- `externalVolume`, `internalVolume`, `manualOffset`: Float (展示交易量计算字段)
- **🔥 Polymarket 原始数据字段**:
  - `outcomePrices`: String? (存储原始赔率 JSON 字符串，如 `"[\"0.7\", \"0.3\"]"`)
  - `image`: String? (存储全网头像 URL)
  - `iconUrl`: String? (作为备份头像字段)
  - `initialPrice`: Float? (存储初始价格，0-1 之间)
  - `volume24h`: Float? (存储 24 小时交易量)
- **关联**: 通过 `MarketCategory` 中间表与 `Category` 多对多关联

#### Category (分类)
- `id`: UUID (主键) - **重要：所有分类 ID 必须是 UUID 格式**
- `name`: String (唯一，中文名称如 "加密货币")
- `slug`: String (唯一，如 "crypto")
- `status`: String (默认 "active")
- `parentId`: String? (自关联，支持层级分类)

#### MarketCategory (市场-分类关联表)
- `id`: UUID (主键)
- `marketId`: String (外键)
- `categoryId`: String (外键) - **重要：使用 UUID，不是 slug**
- `@@unique([marketId, categoryId])` (防止重复关联)

#### GlobalStat (全局统计)
- `id`: UUID (主键)
- `label`: String (指标标签，如 "进行中事件", "24H 交易量")
- `value`: Float (指标值)
- `isActive`: Boolean (是否启用)
- `overrideValue`: Float? (手动覆盖值)
- `manualOffset`: Float (手动偏移量)

#### ScraperTask (采集任务监控)
- `id`: UUID (主键)
- `name`: String (唯一，如 "OddsRobot", "Polymarket_Main")
- `status`: String (NORMAL | ABNORMAL | STOPPED)
- `lastRunTime`: DateTime
- `frequency`: Int (运行频率，分钟)
- `message`: String? (状态消息)

#### AdminLog (管理员操作日志)
- `id`: UUID (主键)
- `adminId`: String (管理员 ID)
- `actionType`: String (操作类型，如 "ODDS_ROBOT_SYNC")
- `details`: String (操作详情)
- `timestamp`: DateTime

### 重要枚举

```typescript
enum MarketStatus {
  OPEN              // 开放中 - 用户可以下注
  CLOSED            // 已关闭 - 市场已关闭，等待结算
  RESOLVED          // 已结算 - 市场已结算，结果已确定
  CANCELED          // 已取消 - 市场被取消，不进行结算
  PENDING_REVIEW    // 待审核 - 新抓取的市场，等待管理员审核
}

enum ReviewStatus {
  PENDING           // 待审核
  PUBLISHED         // 已发布 - 只有这个状态的市场才会在前端显示
  REJECTED          // 已拒绝
}

enum MarketSource {
  POLYMARKET        // 从 Polymarket 爬取的市场
  INTERNAL          // 平台自主创建的市场
}
```

---

## 🔐 认证系统

### 双认证系统

项目同时使用两套认证系统：

#### 1. NextAuth v5 (用于 Admin 后台)
- **位置**: `app/api/auth/[...nextauth]/route.ts`
- **使用场景**: Admin 后台 API (`/api/admin/*`)
- **验证方式**: `const session = await auth()`
- **权限检查**: `session.user.role === 'ADMIN'` 或 `session.user.email === 'yesno@yesno.com'`

#### 2. Auth Core (自定义 Session Store)
- **位置**: `lib/auth-core/sessionStore.ts`
- **Cookie**: `auth_core_session`
- **使用场景**: 普通用户认证 (`/api/auth/login`, `/api/auth/me`)
- **验证方式**: `verifyAdminToken(request)` 或 `extractUserIdFromToken()`

### Admin 认证要点

**重要文件**: `lib/adminAuth.ts`

```typescript
// Admin API 使用 NextAuth session
const session = await auth();
if (!session || !session.user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
const userRole = (session.user as any).role;
const userEmail = session.user.email;
const adminEmail = 'yesno@yesno.com';
if (userRole !== 'ADMIN' && userEmail !== adminEmail) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

---

## 🔥 关键修复和约定

### 1. Prisma 操作约定

**严禁使用 `upsert`**，必须使用三步法：

```typescript
// ❌ 错误：不要使用 upsert
await prisma.scraperTask.upsert({ ... });

// ✅ 正确：使用 findUnique + update/create
const existing = await prisma.scraperTask.findUnique({
  where: { name: taskName }
});
if (existing) {
  await prisma.scraperTask.update({
    where: { name: taskName },
    data: { ... }
  });
} else {
  await prisma.scraperTask.create({
    data: { ... }
  });
}
```

**原因**: `upsert` 在某些情况下会导致 "undefined" 错误，使用显式的 `findUnique` + `update/create` 更稳定。

**例外**: 在 `oddsRobot.ts` 和部分 API 中，由于需要频繁更新状态，可以使用 `upsert`，但必须确保所有字段都有默认值。

### 2. API 缓存控制

**所有 API 路由必须添加**:

```typescript
export const dynamic = 'force-dynamic';
export const revalidate = 0; // 可选，但推荐
```

**原因**: Next.js 默认会缓存 API 响应，导致数据库更新后前端仍显示旧数据。

**已修复的文件**: 所有 `/app/api/**/*.ts` 文件都已添加此配置。

### 3. 市场创建流程

#### 创建市场时的关键步骤：

1. **分类验证**: 只验证 ID 存在性，严禁自动创建分类
2. **reviewStatus**: 新创建的市场必须设置为 `"PUBLISHED"`，否则不会在前端显示
3. **分类关联**: 使用 `categories: { create: [{ categoryId: uuid }] }` 语法（MarketCategory 中间表）

```typescript
// app/api/admin/markets/route.ts (POST)
const marketData = {
  title: body.title,
  reviewStatus: "PUBLISHED", // 🔥 必须设置
  source: "INTERNAL",
  isActive: true,
  // ...
};

if (validCategoryConnect.length > 0) {
  marketData.categories = {
    create: validCategoryConnect.map(c => ({
      categoryId: c.id, // 🔥 直接使用 categoryId，不是嵌套 connect
    })),
  };
}
```

### 4. 市场查询约定

#### 前端市场列表 API (`/api/markets`)
- **过滤条件**: `isActive: true`, `reviewStatus: 'PUBLISHED'`
- **分类筛选**: 通过 `MarketCategory` 中间表的 `categories: { some: { categoryId: ... } }` 实现
- **数据字段**: 必须包含 `outcomePrices`, `image`, `iconUrl`, `initialPrice`, `volume24h` 等字段

#### Admin 市场管理 API (`/api/admin/markets`)
- **过滤条件**: `isActive: true`, `status: { not: 'PENDING_REVIEW' }`, `reviewStatus: 'PUBLISHED'`
- **说明**: 排除待审核市场，只显示已发布的市场

#### 市场详情 API (`/api/markets/[market_id]`)
- **支持双重查找**: `OR: [{ id: market_id }, { slug: market_id }]` (目前只支持 id，slug 字段未添加到 schema)
- **过滤条件**: `reviewStatus: 'PUBLISHED'`, `isActive: true`
- **数据字段**: 必须包含 `source`, `outcomePrices`, `image`, `iconUrl`, `initialPrice`, `volume24h`

### 5. Category ID 迁移

**已完成**: 所有分类 ID 已从非 UUID 格式（如 "crypto", "finance"）迁移为标准 UUID。

**迁移脚本**: `scripts/migrate-category-ids.ts`

**影响**: 
- 前端创建市场时必须使用数据库中的真实 UUID
- 不能再使用 slug 作为 categoryId

### 6. 市场数据同步（Polymarket 适配器）

**文件**: `lib/scrapers/polymarketAdapter.ts`

**核心功能**:
- 从 Polymarket Gamma API 抓取市场数据
- 提取并保存 `outcomePrices`, `image`, `iconUrl`, `initialPrice`, `volume24h` 字段
- **解耦逻辑**: 每个字段独立提取和保存，即使 `image` 为空，也要继续提取 `outcomePrices`

**数据提取逻辑**:
```typescript
// 独立提取每个字段
const outcomePrices = extractOutcomePrices(marketData);
const imageUrl = extractImage(marketData);
const iconUrl = extractIconUrl(marketData);
const initialPrice = extractInitialPrice(marketData);
const volume24h = extractVolume24h(marketData);

// 独立保存，不相互依赖
await prisma.market.update({
  data: {
    outcomePrices: outcomePricesJson || null,
    image: imageUrl || null,
    iconUrl: iconUrlValue || null,
    initialPrice: initialPriceValue || null,
    volume24h: volume24hValue || null,
  }
});
```

**重要**: 不要因为某个字段缺失就跳过其他字段的保存。

### 7. 赔率显示逻辑

**前端组件**: `components/MarketCard.tsx`, `components/MarketTable.tsx`

**赔率优先级**:
1. 第一优先级: 解析 `market.outcomePrices` (JSON 字符串)
2. 第二优先级: 使用 `market.initialPrice`
3. 第三优先级: 使用本地计算的 `totalYes`/`totalNo` 比例
4. 最后兜底: 50/50 (仅当所有数据都不可用时)

**头像优先级**:
1. 第一优先级: `market.image`
2. 第二优先级: `market.iconUrl`
3. 第三优先级: `market.imageUrl` (兼容字段)
4. 最后兜底: 默认图标

**交易量优先级**:
1. 第一优先级: `market.volume24h`
2. 第二优先级: `market.volume`
3. 第三优先级: `event.volume`
4. 第四优先级: `market.displayVolume`
5. 最后兜底: `market.totalVolume`

### 8. 市场详情页 Source 分流逻辑

**文件**: `app/markets/[id]/page.tsx`

**核心逻辑**: 根据 `market.source` 决定使用哪个数据源

```typescript
// 赔率计算
const getDisplayPrice = () => {
  if (market.source === 'POLYMARKET' && market.outcomePrices) {
    // 🔥 抓取市场：直接用全网真实赔率
    const prices = JSON.parse(market.outcomePrices);
    return prices[0] ? parseFloat(prices[0]) : 0.5;
  }
  // 🏠 自建市场：保留原有的本地成交计算逻辑
  return localCalculatedPrice || 0.5;
};

// 头像逻辑
const getImageUrl = () => {
  if (market.source === 'POLYMARKET') {
    // 🔥 强制使用数据库中的 image 字段
    return market.image || market.iconUrl || market.imageUrl;
  }
  return market.imageUrl;
};
```

---

## 🤖 赔率监控中心

### 功能概述

**位置**: `/admin/operations/odds`

**功能**: 实时监控赔率机器人运行状态和同步数据

### 后端 API

#### 1. 统计 API
**文件**: `app/api/admin/odds-robot/stats/route.ts`
- **路径**: `GET /api/admin/odds-robot/stats`
- **返回数据**:
  - `status`: 机器人运行状态 (ACTIVE | INACTIVE | ERROR)
  - `activePoolSize`: 活跃市场数量 (status: 'OPEN' 且 source: 'POLYMARKET')
  - `lastPulse`: 最后一次成功同步的时间戳
  - `successRate`: 成功率统计
  - `itemsCount`: 已处理数量
  - `errorMessage`: 错误信息
  - `nextRunAt`: 下次运行时间
  - `recentLogs`: 最近的同步日志

#### 2. 重启 API
**文件**: `app/api/admin/odds-robot/restart/route.ts`
- **路径**: `POST /api/admin/odds-robot/restart`
- **功能**: 手动重启机器人，更新 `scraper_tasks` 表

#### 3. 强制更新 API
**文件**: `app/api/admin/odds-robot/force-update/route.ts`
- **路径**: `POST /api/admin/odds-robot/force-update`
- **功能**: 立即触发一次赔率同步，不等待定时任务

### 赔率同步机器人

**文件**: `lib/scrapers/oddsRobot.ts`

**核心逻辑**:
- **严格只处理上架事件**: 只更新 `status: 'OPEN'` 的市场
- **30 秒内极速反馈**: 限制每次处理 1000 个市场
- **数据持久化**: 将执行结果保存到 `scraper_tasks` 表
- **操作日志**: 记录到 `admin_logs` 表

**同步逻辑**:
1. 查询所有 `status: 'OPEN'` 且 `source: 'POLYMARKET'` 的市场
2. 从 Polymarket API 获取最新赔率数据
3. 只更新 `outcomePrices`, `initialPrice`, `yesProbability`, `noProbability` 字段
4. 不修改其他字段（如 `image`, `iconUrl` 等）

**启动方式**:
```typescript
import { startOddsRobot } from '@/lib/scrapers/oddsRobot';

// 启动定时任务（每 30 秒执行一次）
startOddsRobot();
```

---

## 📊 数据流和脚本

### 脚本 A: Polymarket 市场抓取

**文件**: `lib/scrapers/polymarketAdapter.ts`

**功能**:
- 从 Polymarket Gamma API 抓取全量市场数据
- 提取并保存市场基本信息、分类、赔率、头像、交易量等
- 自动翻译标题和描述（中英文）
- 自动映射分类

**触发方式**:
- 手动: 通过 Admin 面板触发
- 定时: 通过 `ScraperEngine` 定时执行

### 脚本 B: 全网数据计算

**文件**: `scripts/scrapers/calculate-global-stats.ts`

**功能**:
- 从 Polymarket API 抓取全量活跃市场数据
- 计算: 进行中事件、24H 交易量、总锁仓量 (TVL)、24H 活跃交易者
- 直接写入 `GlobalStat` 表的中文标签: `进行中事件`, `24H 交易量`, `总锁仓量 (TVL)`, `24H 活跃交易者`

**防破坏逻辑**:
```typescript
// 如果 GlobalStat 记录不存在或 isActive: false，脚本不会创建或更新
const stat = await prisma.globalStat.findFirst({ where: { label } });
if (stat && stat.isActive) {
  await prisma.globalStat.update({ where: { id: stat.id }, data: { value } });
}
```

**触发方式**:
- 手动: `npx tsx scripts/scrapers/calculate-global-stats.ts`
- 通过 Admin 面板: `/api/admin/scrapers/global-stats/toggle` (POST, action: 'enable')

### 脚本 C: 赔率同步机器人

**文件**: `lib/scrapers/oddsRobot.ts`

**功能**:
- 定期同步 POLYMARKET 市场的赔率数据（outcomePrices, initialPrice）
- 只更新已上架（status: 'OPEN'）的市场
- 将执行数据持久化到 scraper_tasks 表

**触发方式**:
- 手动: `import { syncOdds } from '@/lib/scrapers/oddsRobot'; await syncOdds();`
- 定时: `import { startOddsRobot } from '@/lib/scrapers/oddsRobot'; startOddsRobot();`

### 统计 API

**文件**: `app/api/stats/route.ts`

**逻辑**: 简单返回所有 `isActive: true` 的 `GlobalStat` 记录，脚本 B 已直接写入中文标签，无需复杂映射。

---

## 🛠️ 重要工具函数和模式

### DBService (`lib/dbService.ts`)

所有数据库操作应通过 `DBService` 进行，而不是直接使用 Prisma Client。

**主要方法**:
- `getAllMarkets(categorySlug?, includePending?)`: 获取市场列表
- `findMarketById(marketId)`: 查找市场（支持双重查找：id 或 slug）
- `findUserByEmail(email)`: 查找用户
- `updateMarket(marketId, data)`: 更新市场（支持 `image` 字段）

### 市场交易量计算

**文件**: `lib/marketUtils.ts`

```typescript
calculateDisplayVolume({
  source: 'POLYMARKET' | 'INTERNAL',
  externalVolume: number,
  internalVolume: number,
  manualOffset: number
}): number
```

**逻辑**: 
- POLYMARKET 来源: `externalVolume + manualOffset`
- INTERNAL 来源: `internalVolume + manualOffset`

### 认证工具

**文件**: `lib/authUtils.ts`

```typescript
extractUserIdFromToken(request: Request): string | null
```

**功能**: 统一的用户 ID 提取工具，从 `auth_core_session` cookie 中提取用户 ID。

---

## ⚠️ 已知问题和注意事项

### 1. Category ID 格式

**状态**: 已修复 ✅

- 所有分类 ID 现在都是 UUID 格式
- 创建市场时必须使用真实的 UUID，不能使用 slug

### 2. Market Slug 字段

**状态**: 待实现 ⚠️

- Market 表目前**没有 slug 字段**
- 详情页 API 已准备支持双重查找（id 或 slug），但需要先添加 slug 字段到 schema
- 创建市场时**应自动生成 slug**（待实现）

### 3. Prisma Client 导入

**正确方式**:
```typescript
import { prisma } from '@/lib/prisma'; // named export
// 或
import prisma from '@/lib/prisma'; // default export（也支持）
```

**错误**: 不要使用 `import { PrismaClient } from '@prisma/client'` 然后 `new PrismaClient()`

### 4. 静态渲染和动态参数

**详情页**: `app/markets/[id]/page.tsx`

**待添加**:
```typescript
export const dynamicParams = true; // 允许动态参数，实时查询数据库
```

**原因**: 如果使用 `generateStaticParams`，新创建的市场不在预渲染列表里会报 404。

### 5. 客户端组件缓存

**重要**: 客户端组件（`"use client"`）不能使用 `export const dynamic = 'force-dynamic'`。

**正确做法**:
- 在客户端组件中使用 `fetch` 时添加 `cache: 'no-store'`
- 在服务端 API 路由中添加 `export const dynamic = 'force-dynamic'`

---

## 📁 关键文件位置

### API 路由

- **Admin 市场管理**: `app/api/admin/markets/route.ts`
- **市场详情**: `app/api/markets/[market_id]/route.ts`
- **市场列表**: `app/api/markets/route.ts`
- **统计数据**: `app/api/stats/route.ts`
- **Admin 认证**: `app/api/admin/auth/login/route.ts`
- **赔率监控统计**: `app/api/admin/odds-robot/stats/route.ts`
- **赔率机器人重启**: `app/api/admin/odds-robot/restart/route.ts`
- **赔率强制更新**: `app/api/admin/odds-robot/force-update/route.ts`

### 数据库和脚本

- **Prisma Schema**: `prisma/schema.prisma`
- **DB Service**: `lib/dbService.ts`
- **Polymarket 适配器**: `lib/scrapers/polymarketAdapter.ts`
- **赔率同步机器人**: `lib/scrapers/oddsRobot.ts`
- **脚本 B**: `scripts/scrapers/calculate-global-stats.ts`
- **迁移脚本**: `scripts/migrate-category-ids.ts`

### 前端组件

- **市场列表**: `components/MarketTable.tsx`
- **市场卡片**: `components/MarketCard.tsx`
- **市场详情页**: `app/markets/[id]/page.tsx`
- **Admin 市场创建**: `app/admin/(protected)/markets/create/page.tsx`
- **Admin 市场列表**: `app/admin/(protected)/markets/list/page.tsx`
- **Admin 市场编辑**: `app/admin/(protected)/markets/edit/[market_id]/page.tsx`
- **赔率监控中心**: `app/admin/(protected)/operations/odds/page.tsx`
- **Admin 侧边栏**: `components/admin/AdminSidebar.tsx`

---

## 🔄 数据流示例

### 市场创建流程

```
前端 (create/page.tsx)
  ↓ 提交 categories: [uuid1, uuid2]
API (POST /api/admin/markets)
  ↓ 验证 categoryIds 存在性
  ↓ 创建 Market (reviewStatus: 'PUBLISHED')
  ↓ 创建 MarketCategory 关联
数据库 (markets + market_categories)
  ↓
前端列表 (自动刷新显示新市场)
```

### 统计数据流程

```
脚本 B (calculate-global-stats.ts)
  ↓ 抓取 Polymarket API
  ↓ 计算统计数据
  ↓ 写入 GlobalStat 表 (label: '进行中事件', ...)
数据库 (global_stats)
  ↓
API (GET /api/stats)
  ↓ 查询 isActive: true 的 GlobalStat
前端 (MarketOverview.tsx)
  ↓ 每 60 秒自动刷新
```

### 赔率同步流程

```
赔率机器人 (oddsRobot.ts)
  ↓ 查询 status: 'OPEN' 的 POLYMARKET 市场
  ↓ 从 Polymarket API 获取最新赔率
  ↓ 更新 outcomePrices, initialPrice, yesProbability, noProbability
数据库 (markets 表)
  ↓ 更新 scraper_tasks 表（记录执行状态）
  ↓ 记录 admin_logs（操作日志）
  ↓
监控中心 (operations/odds/page.tsx)
  ↓ 每 3 秒刷新统计数据
  ↓ 显示运行状态、成功率、日志等
```

### Polymarket 市场抓取流程

```
Polymarket 适配器 (polymarketAdapter.ts)
  ↓ 从 Polymarket Gamma API 抓取市场数据
  ↓ 提取 outcomePrices, image, iconUrl, initialPrice, volume24h
  ↓ 翻译标题和描述（中英文）
  ↓ 映射分类
  ↓ 创建或更新 Market 记录
数据库 (markets + market_categories)
  ↓
前端列表 (自动显示新市场)
```

---

## 🚨 调试和排查

### 常见问题排查

1. **市场不显示**: 检查 `reviewStatus === 'PUBLISHED'` 和 `isActive === true`
2. **分类关联失败**: 确认前端发送的是 UUID 而不是 slug
3. **统计为 0**: 检查 `GlobalStat` 表中对应 label 的 `isActive` 是否为 true
4. **401 Unauthorized**: Admin API 使用 `auth()`，确保 session 有效
5. **赔率显示 50/50**: 检查 `outcomePrices` 或 `initialPrice` 字段是否有值
6. **头像显示 Bitcoin 图标**: 检查 `image` 或 `iconUrl` 字段是否有值
7. **交易量显示 $0**: 检查 `volume24h` 或 `volume` 字段是否有值

### 有用的脚本

- `scripts/check-database.sh`: 检查数据库连接
- `scripts/migrate-category-ids.ts`: Category ID 迁移（已完成）
- `scripts/update-internal-markets-published.ts`: 批量更新市场 reviewStatus
- `scripts/check-db-data.ts`: 检查数据库中的赔率和图片数据
- `scripts/find-missing-data.ts`: 查找缺少图片的 POLYMARKET 市场
- `scripts/force-update-markets.ts`: 强制更新特定市场的数据

---

## 📝 代码约定

### 1. 错误处理

```typescript
try {
  // ...
} catch (error: any) {
  console.error('❌ [组件名] 操作失败:', error);
  return NextResponse.json(
    { success: false, error: error.message },
    { status: 500 }
  );
}
```

### 2. 日志格式

使用 emoji 前缀便于识别：
- `✅` 成功
- `❌` 错误
- `⚠️` 警告
- `🔍` 查询/查找
- `📊` 数据/统计
- `🔥` 重要提示
- `🤖` 机器人/自动化

### 3. 类型安全

- 使用 TypeScript 严格模式
- 从 `@/types/api.ts` 导入类型定义
- 处理 null/undefined 时使用 `??` 或明确的默认值

---

## 🔗 相关文档

- `README.md`: 项目基本信息和安装指南
- `prisma/schema.prisma`: 完整的数据库模型定义
- `docs/FRONTEND-STABILITY-RULES.md`: 前端稳定性规则

---

## 💡 实际使用示例

### 创建市场（Admin）

**前端**: `app/admin/(protected)/markets/create/page.tsx`
```typescript
// 1. 从数据库获取分类列表
const categories = await fetch('/api/admin/categories').then(r => r.json()).then(d => d.data);

// 2. 用户选择分类（使用 category.id，UUID）
handleCategoryToggle(categoryId: string) {
  // 切换分类选中状态
  setFormData(prev => ({
    categories: prev.categories.includes(categoryId)
      ? prev.categories.filter(id => id !== categoryId)
      : [...prev.categories, categoryId]
  }));
}

// 3. 提交时发送 categoryIds 数组
fetch('/api/admin/markets', {
  method: 'POST',
  body: JSON.stringify({
    title: formData.marketName,
    categories: validCategoryIds, // [uuid1, uuid2, ...]
    // ...
  })
});
```

**后端**: `app/api/admin/markets/route.ts` (POST)
```typescript
// 1. 验证分类 IDs 存在性
const validCategories = await prisma.category.findMany({
  where: { id: { in: body.categories } },
  select: { id: true },
});

// 2. 创建市场（reviewStatus: 'PUBLISHED'）
const marketData = {
  title: body.title,
  reviewStatus: "PUBLISHED", // 🔥 必须设置
  // ...
  categories: {
    create: validCategoryIds.map(id => ({ categoryId: id })),
  },
};
```

### 查询市场详情

**API**: `app/api/markets/[market_id]/route.ts`
```typescript
// 支持双重查找（目前只支持 id，将来支持 slug）
const market = await prisma.market.findFirst({
  where: {
    OR: [
      { id: market_id },
      // { slug: market_id }, // 待添加 slug 字段后启用
    ],
    reviewStatus: 'PUBLISHED',
    isActive: true,
  },
  include: {
    categories: {
      include: { category: true }
    }
  }
});
```

### 赔率监控中心使用

**前端**: `app/admin/(protected)/operations/odds/page.tsx`
```typescript
// 获取统计数据
const response = await fetch('/api/admin/odds-robot/stats', {
  credentials: 'include',
});

// 手动重启机器人
await fetch('/api/admin/odds-robot/restart', {
  method: 'POST',
  credentials: 'include',
});

// 强制更新赔率
await fetch('/api/admin/odds-robot/force-update', {
  method: 'POST',
  credentials: 'include',
});
```

---

## ✅ 当前项目状态

### 已完成 ✅

- [x] Category ID 统一为 UUID 格式
- [x] 市场创建时的分类关联修复
- [x] Admin 市场删除接口权限修复
- [x] 市场创建时自动设置 `reviewStatus: 'PUBLISHED'`
- [x] API 缓存控制 (`export const dynamic = 'force-dynamic'`)
- [x] 脚本 B (全网数据计算) 独立部署
- [x] Prisma `upsert` 替换为 `findUnique` + `update/create`（大部分场景）
- [x] 市场详情 API 支持双重查找（id 或 slug，目前只支持 id）
- [x] Polymarket 市场数据字段（outcomePrices, image, iconUrl, initialPrice, volume24h）添加和同步
- [x] 市场卡片和详情页赔率显示逻辑修复（优先使用 outcomePrices）
- [x] 市场卡片和详情页头像显示逻辑修复（优先使用 image）
- [x] 市场卡片和详情页交易量显示逻辑修复（优先使用 volume24h）
- [x] 市场详情页 Source 分流逻辑（POLYMARKET vs INTERNAL）
- [x] Admin 市场编辑页面添加头像 URL 字段
- [x] Admin 市场编辑权限修复（使用 NextAuth session）
- [x] 赔率监控中心（统计 API、监控页面、机器人脚本）

### 待实现 ⚠️

- [ ] Market 表添加 `slug` 字段
- [ ] 市场创建时自动生成 slug
- [ ] 详情页添加 `export const dynamicParams = true`
- [ ] 完善 slug 生成逻辑（中文标题转 URL 友好格式）
- [ ] 赔率机器人定时任务自动启动（需要集成到系统启动流程）

---

**提示**: 修改代码前，请先阅读本文档，了解项目架构和约定。如有疑问，请查看相关文件的实际实现。

**最后更新**: 2025-12-20 - 添加赔率监控中心功能
