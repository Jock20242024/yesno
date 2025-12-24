# 自动化工厂心跳监测说明

## 📋 作用是什么？

**心跳监测**用于监控自动化工厂是否正常运行，帮助管理员及时发现系统异常。

### 核心功能：
1. **实时监控**：显示工厂最后一次运行时间
2. **健康状态判断**：自动判断工厂是否正常运行（<20分钟为健康）
3. **异常预警**：当工厂停止运行时，立即显示红色警告

---

## 👀 怎么看？

### 前端显示位置
- **路径**：`/admin/factory`（自动化工厂管理页面）
- **组件**：`app/admin/(protected)/factory/components/StatsCards.tsx`
- **位置**：页面顶部的统计卡片区域

### 显示状态

#### 🟢 健康状态（绿色）
- **条件**：距离上次运行 < 20 分钟
- **显示**：
  - 绿色圆点（右上角）
  - 🟢 绿色图标
  - "自动化巡航中"
  - "上次运行: X 分钟前"

#### 🔴 异常状态（红色）
- **条件**：距离上次运行 ≥ 20 分钟，或没有记录
- **显示**：
  - 红色圆点（右上角）
  - 🔴 红色图标
  - "巡航中断 (上次: X分钟前)" 或 "暂无记录"

### 自动刷新
- 前端每 **30 秒**自动更新一次心跳状态
- 无需手动刷新页面

---

## 🔧 逻辑是什么？

### 1. 心跳写入（记录运行时间）

#### 写入时机
心跳在以下两个场景更新：

**场景1：手动触发工厂生成**
- **文件**：`app/api/admin/factory/templates/[template_id]/trigger/route.ts`
- **位置**：第 360-372 行
- **触发**：管理员点击"生成市场"按钮后
- **代码**：
```typescript
// 🔥 更新心跳：记录最后一次工厂运行时间
try {
  const nowUtc = dayjs.utc().toISOString();
  await prisma.systemSettings.upsert({
    where: { key: 'lastFactoryRunAt' },
    update: { value: nowUtc },
    create: { key: 'lastFactoryRunAt', value: nowUtc },
  });
  console.log(`💓 [Heartbeat] 已更新最后运行时间: ${nowUtc}`);
} catch (heartbeatError: any) {
  console.error(`⚠️ [Heartbeat] 更新心跳失败: ${heartbeatError.message}`);
}
```

**场景2：自动任务运行**
- **文件**：`lib/factory/relay.ts`
- **位置**：第 423-434 行
- **触发**：Cron 任务自动执行（每30秒）
- **代码**：
```typescript
try {
  const nowUtc = dayjs.utc().toISOString();
  await prisma.systemSettings.upsert({
    where: { key: 'lastFactoryRunAt' },
    update: { value: nowUtc },
    create: { key: 'lastFactoryRunAt', value: nowUtc },
  });
  console.log(`💓 [Heartbeat] 自动任务心跳已更新: ${nowUtc}`);
} catch (heartbeatError: any) {
  console.error(`⚠️ [Heartbeat] 更新心跳失败: ${heartbeatError.message}`);
}
```

#### 存储位置
- **数据库表**：`SystemSettings`
- **键名**：`lastFactoryRunAt`
- **值格式**：ISO 8601 时间字符串（UTC），例如：`2025-12-24T03:30:00.000Z`

### 2. 心跳读取（获取运行时间）

#### 读取位置
- **文件**：`app/api/admin/factory/stats/route.ts`
- **位置**：第 74-91 行
- **API 端点**：`GET /api/admin/factory/stats`
- **代码**：
```typescript
// 🔥 获取心跳状态：最后工厂运行时间
let lastFactoryRunAt: string | null = null;
try {
  const heartbeatSetting = await prisma.systemSettings.findUnique({
    where: { key: 'lastFactoryRunAt' },
  });
  lastFactoryRunAt = heartbeatSetting?.value || null;
} catch (heartbeatError: any) {
  console.warn('⚠️ [Factory Stats API] 获取心跳状态失败:', heartbeatError.message);
  lastFactoryRunAt = null;
}
```

### 3. 前端显示逻辑

#### 健康判断
- **文件**：`app/admin/(protected)/factory/components/StatsCards.tsx`
- **位置**：第 39-74 行
- **逻辑**：
```typescript
const calculateHeartbeat = () => {
  const lastRun = new Date(stats.lastFactoryRunAt!);
  const now = new Date();
  const diffMs = now.getTime() - lastRun.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 20) {
    // 🟢 健康：< 20分钟
    setHeartbeatStatus({
      isHealthy: true,
      minutesAgo: diffMinutes,
      statusText: '自动化巡航中',
    });
  } else {
    // 🔴 异常：≥ 20分钟
    setHeartbeatStatus({
      isHealthy: false,
      minutesAgo: diffMinutes,
      statusText: `巡航中断 (上次: ${diffMinutes}分钟前)`,
    });
  }
};
```

#### 自动刷新
- 每 **30 秒**执行一次 `calculateHeartbeat()`
- 使用 `setInterval` 实现

---

## 📝 都会有什么记录？

### 当前实现（单一记录）

**只记录最后一次运行时间**：
- **键名**：`lastFactoryRunAt`
- **值**：ISO 8601 时间字符串（UTC）
- **示例**：`2025-12-24T03:30:00.000Z`

### 数据库结构

```prisma
model SystemSettings {
  key       String   @id // 设置键名作为主键
  value     String   // 设置值（JSON字符串或纯文本）
  updatedAt DateTime @updatedAt

  @@map("system_settings")
}
```

### 可能的扩展（未来）

如果需要更详细的记录，可以考虑：

1. **运行历史记录**
   - 记录每次运行的时间、状态、创建的市场数量
   - 需要新建表：`FactoryRunLog`

2. **运行统计**
   - 记录运行时长、成功/失败次数
   - 需要新建表：`FactoryRunStats`

3. **错误日志**
   - 记录运行失败的原因、错误堆栈
   - 需要新建表：`FactoryErrorLog`

---

## 🔍 故障排查

### 问题1：显示"暂无记录"

**可能原因**：
1. 工厂从未运行过
2. 数据库中没有 `lastFactoryRunAt` 记录
3. 心跳更新失败（检查服务器日志）

**解决方法**：
1. 手动触发一次工厂生成（点击"生成市场"按钮）
2. 检查服务器日志是否有心跳更新错误
3. 检查数据库 `system_settings` 表是否有 `lastFactoryRunAt` 记录

### 问题2：一直显示红色（巡航中断）

**可能原因**：
1. Cron 任务没有运行（检查 Vercel Cron 配置）
2. `runRelayEngine()` 执行失败
3. 心跳更新失败（检查服务器日志）

**解决方法**：
1. 检查 `/api/cron/market-factory` 是否被正确调用
2. 检查服务器日志中是否有 `runRelayEngine()` 错误
3. 手动触发一次工厂生成，看是否能更新心跳

### 问题3：心跳更新失败

**可能原因**：
1. `SystemSettings` 表不存在
2. Prisma Client 未正确生成
3. 数据库连接问题

**解决方法**：
1. 运行 `npx prisma generate` 重新生成 Prisma Client
2. 运行 `npx prisma db push` 确保数据库表存在
3. 检查数据库连接配置（`.env` 文件中的 `DATABASE_URL`）

---

## 📊 流程图

```
┌─────────────────┐
│  手动触发生成    │
│  (trigger API)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 更新心跳记录     │
│ lastFactoryRunAt│
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌─────────────────┐
│  自动任务运行    │      │  前端请求统计    │
│  (Cron/Relay)   │      │  (Stats API)    │
└────────┬────────┘      └────────┬────────┘
         │                        │
         ▼                        ▼
┌─────────────────┐      ┌─────────────────┐
│ 更新心跳记录     │      │ 读取心跳记录     │
│ lastFactoryRunAt│      │ lastFactoryRunAt │
└────────┬────────┘      └────────┬────────┘
         │                        │
         └────────┬────────────────┘
                  ▼
         ┌─────────────────┐
         │  前端显示状态    │
         │  (StatsCards)   │
         └─────────────────┘
```

---

## 🎯 总结

- **作用**：监控自动化工厂运行状态
- **怎么看**：在 `/admin/factory` 页面顶部查看
- **逻辑**：写入（手动/自动）→ 读取（API）→ 显示（前端）
- **记录**：只记录最后一次运行时间（ISO 字符串）
