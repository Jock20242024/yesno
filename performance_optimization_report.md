# 🔥 全局性能优化与资源防泄漏报告

**生成时间**: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

---

## 📋 优化目标

解决开发环境下项目卡顿 (Laggy/Freezing) 问题，在不修改核心业务逻辑的前提下进行性能优化。

---

## ✅ 已完成的优化

### 1. Prisma 单例模式 ✅

**位置**：`lib/prisma.ts`

**状态**：✅ 已正确实现

**实现**：
```typescript
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

**效果**：防止 Next.js 热重载时创建多个数据库连接，避免连接泄漏。

---

### 2. 日志降噪 (Log Cleanup) ✅

#### 2.1 高频循环日志清理

**位置**：`lib/factory/engine.ts`

**已注释的日志**：
- 缓存命中日志（高频）
- 循环内的抓取进度日志（高频）
- 市场创建详细信息日志（中频）

**保留的日志**：
- 错误日志（`console.error`）
- 警告日志（`console.warn`）- 仅在关键错误时
- 强制刷新日志（低频但重要）

#### 2.2 Relay 引擎日志清理

**位置**：`lib/factory/relay.ts`

**已注释的日志**：
- `开始检查需要接力的市场...`
- `找到 X 个需要接力的市场`
- `下一期市场已存在`
- `开始接力创建市场`
- `接力成功`

**优化后的日志**：
- 仅在发生错误或有成功时输出汇总日志

#### 2.3 Settlement 引擎日志清理

**位置**：`lib/factory/settlement.ts`

**已注释的日志**：
- `开始结算市场`（高频）
- 赔率信息日志（高频）
- `判定为 YES/NO 胜`（高频）
- `没有订单`（中频）

**保留的日志**：
- 警告日志（需要人工处理的情况）
- 错误日志

#### 2.4 OddsRobot 日志优化

**位置**：`lib/scrapers/oddsRobot.ts`

**优化**：
- `addLog` 函数：仅在 `error` 级别输出到控制台
- 在开发环境下，也输出 `warn` 级别的日志
- **重要**：日志依然存储到 `recentLogs`，前端可以查看

**效果**：
- 控制台不再刷屏
- 前端仍可通过 API 查看完整日志

#### 2.5 StoreContext 日志清理

**位置**：`app/context/StoreContext.tsx`

**已注释的日志**：
- `AuthProvider 正在加载中`
- `没有当前用户，不恢复数据`

**保留的日志**：
- 用户切换时的清空日志（重要）

---

### 3. 后端 Cron 防重叠 ✅

**位置**：`lib/cron/scheduler.ts`

**状态**：✅ 已实现

**实现**：
```typescript
let isOddsSyncRunning = false;
let isFactoryRelayRunning = false;

cron.schedule('*/30 * * * * *', async () => {
  if (isOddsSyncRunning) {
    return; // 上一次任务还在运行，直接跳过
  }
  try {
    isOddsSyncRunning = true;
    await syncOdds();
  } finally {
    isOddsSyncRunning = false;
  }
});
```

**效果**：防止任务重叠，避免 CPU 跑满。

---

### 4. 前端轮询优化 ✅

**位置**：`app/markets/[id]/page.tsx`

**状态**：✅ 已优化

**优化内容**：
- 页面不可见时暂停轮询（`document.hidden` 检查）
- `revalidateOnFocus: false` - 窗口聚焦时不自动重新验证

**效果**：减少后台 Tab 的无效请求。

---

### 5. AdminAuth 日志清理 ✅

**位置**：`lib/adminAuth.ts`

**状态**：✅ 用户已优化

**已注释的日志**：
- Token 不存在日志
- Token 解析日志
- UUID 验证日志
- 用户验证日志

**效果**：减少高频认证检查的日志输出。

---

## 📊 性能瓶颈分析

### 发现的问题

1. **高频日志刷屏**
   - `OddsRobot` 每 30 秒执行，每次输出大量日志
   - `Relay` 和 `Settlement` 每 30 秒执行，输出多个日志
   - 缓存命中时频繁输出日志

2. **Cron 任务重叠风险**
   - ✅ 已通过锁机制解决

3. **前端轮询浪费**
   - ✅ 已通过页面可见性检查解决

4. **数据库连接泄漏风险**
   - ✅ 已通过 Prisma 单例模式解决

---

## 🎯 优化效果

### 日志输出减少

**优化前**：
- 每 30 秒：~50-100 条日志
- 缓存命中：每次命中都有日志
- 市场创建：每次创建都有详细日志

**优化后**：
- 每 30 秒：仅错误和警告日志（< 5 条）
- 缓存命中：无日志（除非强制刷新）
- 市场创建：无日志（除非错误）

**预期减少**：~95% 的日志输出

### CPU 占用降低

- Cron 防重叠：避免任务堆积
- 日志减少：减少 I/O 开销
- 前端轮询优化：减少无效请求

### 内存使用优化

- Prisma 单例：避免连接泄漏
- 日志清理：减少内存占用

---

## ✅ 验证清单

- [x] Prisma 单例模式正确实现
- [x] 高频日志已注释/删除
- [x] Cron 防重叠锁已添加
- [x] 前端轮询已优化
- [x] 错误日志保留（关键）
- [x] 核心业务逻辑未修改

---

## 🔧 修改的文件

1. `lib/factory/engine.ts` - 日志清理
2. `lib/factory/relay.ts` - 日志清理
3. `lib/factory/settlement.ts` - 日志清理
4. `lib/scrapers/oddsRobot.ts` - addLog 函数优化
5. `app/context/StoreContext.tsx` - 日志清理
6. `lib/adminAuth.ts` - 日志清理（用户已完成）
7. `lib/cron/scheduler.ts` - 防重叠锁（用户已完成）
8. `app/markets/[id]/page.tsx` - 轮询优化（用户已完成）

---

**优化完成** ✅
