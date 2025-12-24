# 赔率机器人重构总结

## 重构日期
2025-01-XX

## 重构目标
将赔率机器人重构为"分布式差分同步架构"，实现高性能、高可靠性的赔率同步系统。

---

## 1. 环境修复与基础建设 ✅

### 1.1 依赖安装
- ✅ 已安装 `bullmq` 和 `ioredis`
- ✅ 移除了过时的 `@types/ioredis`（ioredis 自带类型定义）

### 1.2 P2003 崩溃修复
**文件**: `app/api/admin/odds-robot/restart/route.ts`

**修复内容**:
- 严格校验 `adminId`：从数据库查询有效的用户 ID
- 只有在获取到有效的 `adminId` 时才创建 `AdminLog`
- 如果无法获取有效的 `adminId`，跳过日志记录并输出警告

**代码示例**:
```typescript
// 🔥 核心修复：严格校验 adminId
let adminUserId: string | null = null;
if (userEmail) {
  const adminUser = await prisma.user.findUnique({
    where: { email: userEmail },
    select: { id: true },
  });
  if (adminUser?.id) {
    adminUserId = adminUser.id;
  }
}

if (adminUserId) {
  try {
    await prisma.adminLog.create({
      data: { adminId: adminUserId, ... }
    });
  } catch (logError) {
    // 日志失败不影响主流程
  }
}
```

### 1.3 Redis 单例化增强
**文件**: `lib/redis.ts`

**增强内容**:
- ✅ 添加 `connectTimeout: 10000`（10 秒连接超时）
- ✅ 添加 `enableOfflineQueue: false`（禁用离线队列，避免错误堆积）
- ✅ 增强错误监听（connect, ready, close, reconnecting）
- ✅ 添加 `isRedisConnected()` 函数用于检查连接状态

**关键改进**:
- Redis 连接错误不会导致应用崩溃
- 应用可以优雅处理 Redis 不可用的情况

---

## 2. 构建"差分更新"分布式队列 ✅

### 2.1 队列定义
**文件**: `lib/queue/oddsQueue.ts`

**队列名称**: `odds-sync`（已修改）

**队列配置**:
- 并发处理：10 个任务
- 限流：每秒最多 100 个任务
- 重试：最多 3 次，指数退避
- 任务保留：成功任务保留 1 小时，失败任务保留 24 小时

### 2.2 差分过滤逻辑
**文件**: `lib/odds/diffSync.ts`

**核心逻辑**:
```typescript
// 1. 从 Redis 获取旧价格
const cachedPriceStr = await redis.get(cacheKey);
const oldPrice = cachedPriceStr ? parseFloat(cachedPriceStr) : null;

// 2. 计算价格变化
const priceDiff = Math.abs(newPrice - oldPrice);

// 3. 只有当价格变化 > 0.001 时才返回 true
if (priceDiff > PRICE_CHANGE_THRESHOLD) {
  await redis.setex(cacheKey, CACHE_TTL, newPrice.toString());
  return { changed: true, newPrice, oldPrice };
}
```

**效果**:
- ✅ 消除无效的数据库写入
- ✅ 解决"更新 0 个"的显示逻辑错误
- ✅ 大幅减少数据库负载

---

## 3. 开发"上架池"高频同步机器人 ✅

### 3.1 定向扫描
**文件**: `lib/scrapers/oddsRobot.ts`

**查询条件**:
```typescript
where: {
  source: 'POLYMARKET',
  status: 'OPEN', // 注意：数据库中使用 'OPEN'，不是 'ACTIVE'
  isActive: true,
}
```

**注意**: 用户要求查询 `status: 'ACTIVE'`，但根据数据库 schema，实际状态值为 `'OPEN'`。代码中使用 `'OPEN'` 是正确的。

### 3.2 并行抓取
**实现方式**: 使用 `Promise.all` 批量处理市场数据

```typescript
const marketExtractionResults = await Promise.all(
  activeMarkets.map(async (market) => {
    // 并行提取每个市场的赔率数据
  })
);
```

**优势**:
- ✅ 大幅提升处理速度
- ✅ 充分利用异步 I/O

### 3.3 任务下发
**流程**:
1. 机器人抓取 Polymarket API 数据
2. 通过差分过滤（Redis 缓存比对）
3. 将有价格变化的市场加入 `odds-sync` 队列
4. Worker 异步处理数据库写入

---

## 4. 完善"赔率监控中心" ✅

### 4.1 监控指标

**统计 API**: `GET /api/admin/odds-robot/stats`

**新增指标**:

1. **活跃池** (`activePoolSize`)
   - 显示当前正在被机器人高频监控的市场数量
   - 查询条件：`source: 'POLYMARKET'`, `status: 'OPEN'`, `isActive: true`

2. **队列积压量** (`queueBacklog`)
   - 等待 + 正在处理的任务数
   - 替代原来的 `itemsCount`

3. **同步效能** (`syncEfficiency`)
   - 计算公式：`(数据库写入次数 / 机器人抓取次数) * 100%`
   - 直观展示差分过滤效果
   - 例如：检查 100 个，写入 15 个，同步效能 = 15%

4. **差分命中率** (`diffHitRate`)
   - 计算公式：`(被过滤掉的数量 / 总检查数量) * 100%`
   - 例如：检查 100 个，过滤 85 个，命中率 = 85%

**API 响应示例**:
```json
{
  "activePoolSize": 23,
  "queueBacklog": 5,
  "syncEfficiency": 15,
  "diffHitRate": 85,
  "checkedCount": 100,
  "queuedCount": 15,
  "filteredCount": 85
}
```

### 4.2 实时日志系统
**日志格式**: 
```
[30s 轮询] 发现 23 个活跃市场 -> 3 个价格变动 -> 已下发同步队列
```

**日志位置**: 
- 控制台输出
- AdminLog 表（持久化）
- 前端监控面板（通过统计 API 获取）

---

## 架构流程图

```
┌─────────────────┐
│  Polymarket API │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  oddsRobot.ts   │ 每 30 秒运行
│  定向扫描活跃池  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  并行抓取数据    │ Promise.all
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  diffSync.ts    │ Redis 缓存比对
│  差分过滤       │ 价格变化 > 0.001?
└────────┬────────┘
         │ [有变化]
         ▼
┌─────────────────┐
│  odds-sync 队列 │ BullMQ
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Worker         │ 异步处理
│  数据库写入     │
└─────────────────┘
```

---

## 性能优化效果

### 预期效果
- **数据库写入减少**: 80-90%（通过差分过滤）
- **处理速度提升**: 3-5 倍（通过并行抓取）
- **系统稳定性**: 大幅提升（Redis 错误不会导致崩溃）

### 监控指标示例
假设有 1000 个活跃市场：
- **检查数量**: 1000
- **价格变化**: 150 个（15%）
- **过滤数量**: 850 个（85%）
- **同步效能**: 15%
- **差分命中率**: 85%

---

## 配置文件

### 环境变量
```env
# Redis 连接（可选，默认 localhost:6379）
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

---

## 启动方式

```typescript
import { startOddsRobot } from '@/lib/scrapers/oddsRobot';

// 启动机器人（自动启动队列工作器）
startOddsRobot();
```

机器人会：
1. 立即执行一次同步
2. 每 30 秒自动执行一次同步

---

## 注意事项

1. **状态值**: 数据库中使用 `status: 'OPEN'`，不是 `'ACTIVE'`
2. **Redis 连接**: 如果 Redis 不可用，应用会继续运行，但差分过滤会失效
3. **队列持久化**: 任务存储在 Redis 中，重启后任务不会丢失
4. **监控日志**: 所有操作都会记录到 AdminLog 表，便于追踪和调试

---

## 后续优化建议

1. **监控面板 UI**: 根据新的指标更新前端显示
2. **告警机制**: 当队列积压量过高时发送告警
3. **性能分析**: 收集更详细的性能指标
4. **缓存优化**: 优化 Redis 缓存策略，减少内存使用
