# 脚本 B（全网数据计算）深度自查报告

## 1. 文件存在性检查

### 1.1 脚本 B 物理路径

**检查结果：✅ 文件存在**

```bash
$ ls -la scripts/scrapers/calculate-global-stats.ts
-rw-r--r--  1 npcventures  staff  6935 Dec 20 11:28 scripts/scrapers/calculate-global-stats.ts
```

**物理路径：** `/Users/npcventures/yesno-app/scripts/scrapers/calculate-global-stats.ts`

### 1.2 处理"开启"按钮点击的 API 路由文件路径

**检查结果：✅ 文件存在**

```bash
$ ls -la app/api/admin/scrapers/global-stats/toggle/route.ts
-rw-r--r--  1 npcventures  staff  3481 Dec 20 11:47 app/api/admin/scrapers/global-stats/toggle/route.ts
```

**物理路径：** `/Users/npcventures/yesno-app/app/api/admin/scrapers/global-stats/toggle/route.ts`

**API 端点：** `POST /api/admin/scrapers/global-stats/toggle`

---

## 2. 数据库对账

### 2.1 Prisma Schema 检查

**检查结果：✅ Schema 定义正确**

#### ScraperTask 表

```prisma
model ScraperTask {
  id          String   @id @default(cuid())
  name        String   @unique // 例如 "Polymarket_Main"
  lastRunTime DateTime @default(now())
  status      String   @default("NORMAL") // NORMAL, ABNORMAL, STOPPED
  message     String?  // 存储报错信息
  frequency   Int      @default(10) // 运行频率（分钟）
  updatedAt   DateTime @updatedAt

  @@index([name])
  @@index([status])
  @@map("scraper_tasks")
}
```

**表名映射：** `scraper_tasks`（数据库表名）
**模型名：** `ScraperTask`（Prisma 模型名）
**客户端访问：** `prisma.scraperTask`（小写开头）

#### GlobalStat 表

```prisma
model GlobalStat {
  id           String   @id @default(uuid())
  label        String   // 指标名称（如 "24H 交易量"）
  value        Float    @default(0.0)
  manualOffset Float    @default(0.0)
  overrideValue Float?
  unit         String?
  icon         String?
  sortOrder    Int      @default(0)
  isActive     Boolean  @default(true) // 是否激活
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([isActive])
  @@index([sortOrder])
  @@map("global_stats")
}
```

**表名映射：** `global_stats`（数据库表名）
**模型名：** `GlobalStat`（Prisma 模型名）
**客户端访问：** `prisma.globalStat`（小写开头）

**注意：** Schema 中定义的是 `GlobalStat`，不是 `GlobalMetric`。

### 2.2 Prisma 客户端导入检查

**检查结果：✅ 导入正确**

**API 路由文件前 10 行代码：**

```typescript
/**
 * 开启/关闭脚本 B（全网数据计算）
 * POST /api/admin/scrapers/global-stats/toggle
 * 
 * 请求体：
 * - action: 'enable' | 'disable'
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from '@/lib/prisma';
```

**导入方式：** `import { prisma } from '@/lib/prisma';` ✅

**lib/prisma.ts 导出方式：**
```typescript
export { prisma }
export default prisma
```

**结论：** 导入方式正确，使用 named export `{ prisma }`。

---

## 3. 逻辑断路排查

### 3.1 Upsert 使用情况检查

**检查结果：❌ 当前代码中已无 upsert 调用**

**当前代码逻辑（第 50-94 行）：**

```typescript
try {
  // 1. 更新 ScraperTask 状态（使用 findUnique + update/create 代替 upsert）
  const targetStatus = action === 'enable' ? 'NORMAL' : 'STOPPED';
  const targetMessage = action === 'enable' ? '任务已启用' : '任务已停用';
  
  // 先尝试查找
  const task = await prisma.scraperTask.findUnique({
    where: { name: taskName },
  });
  
  if (task) {
    // 如果存在，更新
    await prisma.scraperTask.update({
      where: { name: taskName },
      data: {
        status: targetStatus,
        message: targetMessage,
        lastRunTime: new Date(),
      },
    });
  } else {
    // 如果不存在，创建
    await prisma.scraperTask.create({
      data: {
        name: taskName,
        status: targetStatus,
        message: targetMessage,
        lastRunTime: new Date(),
        frequency: 10,
      },
    });
  }

  // 2. 同时更新 GlobalStat 中 external_active_markets_count 指标的 isActive 状态
  await prisma.globalStat.updateMany({
    where: { label: 'external_active_markets_count' },
    data: { isActive: action === 'enable' },
  });
} catch (error) {
  console.error('❌ [Global Stats Toggle] 数据库操作失败:', error);
  throw error;
}
```

**结论：**
1. ✅ 代码中已不使用 `upsert` 方法
2. ✅ 使用 `findUnique` + `update`/`create` 替代
3. ✅ 所有 Prisma 操作都在 try-catch 块中

### 3.2 可能的问题分析

如果仍然报错 "reading 'upsert'"，可能的原因：

1. **Prisma Client 未正确生成**
   - 需要运行 `npx prisma generate`
   - 已执行，生成成功 ✅

2. **运行时 Prisma Client 未加载**
   - 需要重启开发服务器
   - 可能是热重载问题

3. **其他文件仍在使用 upsert**
   - 检查结果：`toggle/route.ts` 中已无 upsert
   - 但其他 API 文件可能仍在使用（如 `app/api/cron/sync/route.ts`）

---

## 4. 执行环境排查

### 4.1 脚本 B 触发方式

**检查结果：❓ 目前只能手动运行**

#### 当前触发方式

1. **手动运行（唯一确认的方式）**
   ```bash
   npx tsx scripts/scrapers/calculate-global-stats.ts
   ```

2. **通过 API 调用（不存在）**
   - ❌ 未找到通过 `child_process` 或类似方式调用脚本的 API
   - ❌ 未找到 `POST /api/admin/scrapers/global-stats/run` 等类似端点

3. **Cron 定时触发（不存在）**
   - ❌ 未找到 Cron 配置
   - ❌ `app/api/cron/sync/route.ts` 是用于 Polymarket 采集（脚本 A），不是脚本 B

#### 相关 API 端点

**已存在的 API：**

1. **`POST /api/admin/scrapers/global-stats/toggle`**
   - 功能：开启/关闭脚本 B（更新 ScraperTask 状态和 GlobalStat.isActive）
   - 不执行脚本，只改变状态

2. **`POST /api/admin/stats/calculate`**（`app/api/admin/stats/calculate/route.ts`）
   - 功能：计算并更新全局统计数据
   - 但这与脚本 B 的逻辑不同（脚本 B 只计算 external_active_markets_count）

**缺失的 API：**
- ❌ 没有直接执行脚本 B 的 API 端点
- ❌ 没有通过 child_process 调用脚本的代码

---

## 总结与建议

### ✅ 正常项

1. ✅ 脚本文件存在
2. ✅ API 路由文件存在
3. ✅ Prisma 导入正确
4. ✅ Schema 定义正确（ScraperTask, GlobalStat）
5. ✅ 代码已不使用 upsert（改用 findUnique + update/create）

### ⚠️ 需要确认项

1. **如果仍然报错 "reading 'upsert'"**
   - 可能是浏览器缓存问题
   - 可能需要硬刷新（Ctrl+Shift+R 或 Cmd+Shift+R）
   - 可能需要重启开发服务器

2. **脚本 B 自动化执行缺失**
   - 目前只能手动运行
   - 建议添加：
     - Cron API 端点（如 `/api/cron/global-stats`）
     - 或通过 child_process 在 toggle API 中执行脚本

### 📋 检查清单

- [x] 脚本文件存在
- [x] API 路由文件存在
- [x] Prisma 导入正确
- [x] Schema 定义正确
- [x] 代码已不使用 upsert
- [ ] 开发服务器是否需要重启（需用户确认）
- [ ] 浏览器是否需要清除缓存（需用户确认）

---

**报告生成时间：** 2024-12-20
**检查人员：** AI Assistant
**状态：** 等待用户确认后再进行修复
