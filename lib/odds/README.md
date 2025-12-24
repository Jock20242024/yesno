# 赔率同步架构 - 分布式差分同步

## 架构概述

本架构实现了分布式差分同步系统，通过以下组件实现高效、可靠的赔率同步：

1. **差分过滤模块** (`diffSync.ts`) - 使用 Redis 缓存，仅在价格变化 > 0.001 时才更新
2. **任务队列模块** (`oddsQueue.ts`) - 使用 BullMQ 将更新任务队列化
3. **赔率机器人** (`oddsRobot.ts`) - 协调整个同步流程

## 工作流程

```
Polymarket API
    ↓
oddsRobot.ts (抓取数据)
    ↓
diffSync.ts (差分过滤: 价格变化 > 0.001?)
    ↓ [有变化]
oddsQueue.ts (加入队列)
    ↓
Worker (异步更新数据库)
```

## 关键特性

### 1. 差分过滤

- **阈值**: 价格变化 > 0.001 (0.1%)
- **缓存**: Redis (TTL: 1小时)
- **优势**: 大幅减少无效的数据库写入操作

### 2. 任务队列

- **队列系统**: BullMQ
- **并发**: 10 个任务同时处理
- **限流**: 每秒最多 100 个任务
- **重试**: 最多 3 次，指数退避

### 3. 监控指标

- **队列积压量**: 等待 + 正在处理的任务数
- **差分命中率**: 被过滤掉的市场数量 / 总检查数量
- **处理数量**: 检查的市场数量
- **加入队列数**: 实际加入队列的任务数量

## 环境变量

```env
# Redis 连接（可选，默认 localhost:6379）
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

## API 接口

### 统计接口

`GET /api/admin/odds-robot/stats`

返回数据：
```json
{
  "queueBacklog": 0,        // 队列积压量
  "diffHitRate": 85,        // 差分命中率（%）
  "checkedCount": 1000,     // 检查的市场数量
  "queuedCount": 150,       // 加入队列的数量
  "filteredCount": 850,     // 被过滤掉的数量
  "queueStats": {
    "waiting": 0,
    "active": 0,
    "completed": 1000,
    "failed": 0
  }
}
```

### 重启接口

`POST /api/admin/odds-robot/restart`

- 清空队列
- 立即执行一次同步

## 启动机器人

```typescript
import { startOddsRobot } from '@/lib/scrapers/oddsRobot';

// 启动机器人（自动启动队列工作器）
startOddsRobot();
```

机器人会：
1. 立即执行一次同步
2. 每 30 秒自动执行一次同步
