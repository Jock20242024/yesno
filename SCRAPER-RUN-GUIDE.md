# Polymarket 采集脚本运行指南

## 手动运行采集脚本

### 方法 1: 通过 API 端点（推荐）

```bash
# 使用 GET 请求（最简单）
curl http://localhost:3000/api/cron/sync-polymarket?limit=100

# 或使用 POST 请求
curl -X POST http://localhost:3000/api/cron/sync-polymarket?limit=100
```

### 方法 2: 使用 Next.js 开发服务器

如果开发服务器正在运行（`npm run dev`），可以直接在浏览器访问：
```
http://localhost:3000/api/cron/sync-polymarket?limit=100
```

### 方法 3: 通过脚本文件（需要 Node.js 环境）

如果需要在 Node.js 环境中直接运行：

```bash
# 进入项目目录
cd /Users/npcventures/yesno-app

# 使用 ts-node 运行（需要先安装 ts-node）
npx ts-node -e "
import { PolymarketAdapter } from './lib/scrapers/polymarketAdapter';
(async () => {
  const adapter = new PolymarketAdapter(100);
  const result = await adapter.execute();
  console.log('采集结果:', result);
})();
"
```

## 查看日志输出

运行采集脚本后，日志会输出到控制台。关键日志包括：

### 1. API 数据获取阶段
- `📡 [PolymarketAdapter] 开始请求 API:` - 显示请求的 URL
- `✅ [PolymarketAdapter] 成功获取数据` - 显示返回的数据条数
- `📋 [PolymarketAdapter] 原始数据样本（前 3 条）` - 显示前 3 条原始数据

### 2. 数据标准化阶段
- `💾 [PolymarketAdapter] 开始保存数据到数据库` - 开始保存流程
- `⏭️ [PolymarketAdapter] 跳过...` - 显示被跳过的数据及原因

### 3. 数据库保存阶段
- `🆕 [PolymarketAdapter] 创建新市场` - 显示新创建的市场信息
- `🔄 [PolymarketAdapter] 更新已存在的市场` - 显示更新的市场信息
- `✅ [PolymarketAdapter] 已保存/更新市场` - 显示保存成功的市场

### 4. 最终统计
- `💾 [PolymarketAdapter] 保存统计: 成功=X, 跳过=Y, 错误=Z` - 显示保存统计

## 常见问题排查

### 问题 1: 采集返回 0 条数据

**检查点：**
1. 查看日志中的原始 API 数据样本，确认 API 是否正常返回数据
2. 检查 `normalize` 阶段的跳过日志，确认是否有大量数据被过滤
3. 检查 `save` 阶段的错误日志，确认是否有数据库保存错误

**可能原因：**
- API 返回的数据格式发生变化
- 数据过滤条件过于严格（如 `outcomePrices` 缺失、死盘过滤等）
- 数据库字段验证失败（如 `isActive` 字段缺失）

### 问题 2: 数据库保存失败

**检查点：**
1. 查看错误日志中的完整错误堆栈
2. 确认数据库连接是否正常
3. 确认 Prisma schema 是否与数据库同步（运行 `npx prisma db push`）

### 问题 3: 数据格式不正确

**检查点：**
1. 查看 `📋 [PolymarketAdapter] 原始数据样本` 日志，确认 API 返回的数据结构
2. 检查字段映射逻辑，确认 `outcomePrices`、`volume` 等关键字段的解析是否正确

## 调试技巧

### 增加日志详细度

在代码中添加更多 `console.log` 来追踪问题：

```typescript
// 在 lib/scrapers/polymarketAdapter.ts 的 save 方法中
console.log('🔍 [DEBUG] 市场数据:', {
  id: marketData.id,
  title: marketData.title,
  outcomePrices: marketData.outcomePrices,
  volume: marketData.volume,
});
```

### 检查数据库状态

```bash
# 查看最近创建/更新的市场
npx prisma studio

# 或使用 SQL 查询
# 连接到数据库后运行：
SELECT id, title, source, isActive, reviewStatus, externalVolume, internalVolume 
FROM markets 
ORDER BY updatedAt DESC 
LIMIT 10;
```

## 自动化运行

### 使用 cron 定时任务

在服务器上设置 cron 任务，每小时运行一次：

```bash
# 编辑 crontab
crontab -e

# 添加以下行（每小时的第 0 分钟运行）
0 * * * * curl -X POST http://localhost:3000/api/cron/sync-polymarket?limit=100
```

### 使用 node-cron（Node.js 应用内）

已在 `app/api/cron/sync-polymarket/route.ts` 中实现了 API 端点，可以通过外部 cron 服务（如 Vercel Cron）来定时触发。
