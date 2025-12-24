# 🔍 1小时市场生成问题与Cron Job诊断报告

## 问题描述

**用户报告**：1小时场次停留在7小时前就不再生成新场次了。

---

## 诊断结果

### 1. 1小时模板状态

**模板信息**（从数据库查询结果）：
- 名称: BTC涨跌-1小时
- ID: 2c2c5107-0903-4987-9a26-dbeb3fa7c317
- 周期: 60 分钟
- **是否激活: true** ✅
- **状态: ACTIVE** ✅
- **提前时间: 120 秒（2分钟）**
- **失败次数: 0** ✅
- **暂停原因: N/A** ✅
- **最后创建时间: 2025-12-23 06:52:13（6小时前）**

**结论**：模板状态正常，未触发熔断机制。

---

### 2. 最近生成的市场分析

**最近3个1小时市场**：
1. closingDate: 2025-12-22T21:00:00Z（8小时前结束）
2. closingDate: 2025-12-23T00:00:00Z（5小时前结束）
3. closingDate: 2025-12-22T23:00:00Z（6小时前结束）

**问题发现**：
- 最后一个市场结束于 `2025-12-22T21:00:00Z`
- 下一个应该生成的时间是 `2025-12-22T22:00:00Z`（但这是8小时前，已经过去了）
- **关键问题**：`shouldCreateMarket` 函数要求 `secondsUntilNextPeriod > 0`，如果下一个周期已经过去，条件不满足

---

### 3. shouldCreateMarket 逻辑分析

**代码位置**: `lib/factory/engine.ts:449-476`

**关键逻辑**（第465行）：
```typescript
const shouldCreate = secondsUntilNextPeriod <= template.advanceTime && secondsUntilNextPeriod > 0;
```

**问题**：
- 条件 `secondsUntilNextPeriod > 0` 要求下一个周期必须在未来
- 如果Cron Job在周期开始后才运行，下一个周期已经过去，`secondsUntilNextPeriod` 为负数
- 导致 `shouldCreate` 返回 `false`，不会创建市场

**示例**：
- 当前时间: 2025-12-23 05:00:00 UTC
- 下一个整点: 2025-12-23 06:00:00 UTC
- secondsUntilNextPeriod: 3600秒（1小时）
- advanceTime: 120秒（2分钟）
- shouldCreate: `3600 <= 120 && 3600 > 0` = `false && true` = `false` ❌

**正确的触发时机**：
- 只有在距离下一个整点 **≤ 2分钟** 且 **> 0秒** 时才会创建
- 例如：当前 05:58:00，下一个整点 06:00:00，secondsUntilNextPeriod = 120秒，shouldCreate = `true` ✅

---

### 4. Cron Job 运行状态检查

#### 4.1 Cron Job API 端点

**文件位置**: `app/api/cron/market-factory/route.ts`

**检查方法**：
1. **手动触发测试**：
   ```bash
   curl http://localhost:3000/api/cron/market-factory
   ```
   或直接在浏览器访问该URL

2. **检查日志输出**：
   - 查看服务器终端（Terminal）日志
   - 应该看到 `🔄 [FactoryEngine] 开始检查模板...` 的日志

3. **检查进程状态**（如果使用独立进程）：
   ```bash
   # 如果使用PM2
   pm2 list
   pm2 logs market-factory-cron
   
   # 如果使用系统cron
   crontab -l
   ```

#### 4.2 Cron Job 配置方式

**方式1: Next.js API Route（HTTP触发）**
- 文件: `app/api/cron/market-factory/route.ts`
- 触发方式: 外部Cron服务（如Vercel Cron、Uptime Robot等）定期调用
- **检查点**：需要确认是否有外部服务在定期调用此API

**方式2: 独立Node.js进程（脚本方式）**
- 文件: `scripts/market-factory-cron.ts`
- 触发方式: 使用 `node-cron` 库，每分钟执行一次
- **检查点**：需要确认此进程是否在运行

#### 4.3 Cron Job 挂掉的可能原因

1. **进程崩溃**：
   - 未捕获的异常导致进程退出
   - 查看是否有错误日志

2. **服务器重启**：
   - 如果使用独立进程，服务器重启后进程不会自动启动

3. **依赖服务不可用**：
   - 数据库连接失败
   - 外部API（Oracle、Polymarket）不可用

4. **资源限制**：
   - 内存不足
   - CPU占用过高

5. **配置错误**：
   - 如果使用外部Cron服务，可能配置的URL错误或已失效

---

### 5. 如何判断Cron Job是否挂了

#### 方法1: 检查最后创建时间

**代码位置**: `lib/factory/engine.ts:728-736`

如果 `lastCreatedAt` 距离现在超过1个周期（1小时）且没有新市场创建，说明Cron Job可能挂了。

**当前状态**：
- 最后创建时间: 2025-12-23 06:52:13（6小时前）
- 距离现在: 6小时
- **判断**: ⚠️ 超过1小时，可能已挂

#### 方法2: 检查服务器日志

**查找日志关键词**：
- `🔄 [FactoryEngine] 开始检查模板...` - 每次Cron运行应该看到
- `✅ [FactoryEngine] 模板 XXX 市场创建完成` - 成功创建市场
- `⏭️ [FactoryEngine] 模板 XXX 最近已创建，跳过` - 跳过（正常）
- `❌ [FactoryEngine] 处理模板 XXX 失败` - 错误

**如果看不到这些日志**：说明Cron Job没有运行

#### 方法3: 手动触发测试

**直接调用API**：
```bash
curl -X GET http://localhost:3000/api/cron/market-factory
```

**如果返回成功但日志中没有执行**：说明API路由有问题
**如果返回404或500**：说明Cron Job API不存在或配置错误

---

### 6. 问题根源分析

#### 问题1: shouldCreateMarket 的时间窗口太窄

**当前逻辑**：
```typescript
const shouldCreate = secondsUntilNextPeriod <= template.advanceTime && secondsUntilNextPeriod > 0;
```

**问题**：
- 只有在距离下一个周期 ≤ 2分钟时才创建
- 如果Cron Job运行时机不对，可能错过这个窗口
- 1小时周期 + 2分钟提前时间 = 非常小的触发窗口

**影响**：
- 如果Cron Job每分钟运行一次，理论上应该能捕获
- 但如果Cron Job挂了或延迟，就会错过窗口

#### 问题2: 没有"补偿生成"机制

**当前逻辑**：
- 如果下一个周期已经过去（secondsUntilNextPeriod < 0），不会创建
- 没有逻辑去"补偿"已错过的周期

**建议**：
- 应该检查是否已经存在下一个周期的市场
- 如果不存在且下一个周期已经开始或即将开始，应该立即创建

---

## 修复建议

### 修复1: 放宽shouldCreateMarket的条件

**修改位置**: `lib/factory/engine.ts:465`

**当前代码**：
```typescript
const shouldCreate = secondsUntilNextPeriod <= template.advanceTime && secondsUntilNextPeriod > 0;
```

**建议修改**：
```typescript
// 如果下一个周期已经过去，检查是否已经存在该周期的市场，如果不存在则创建（补偿生成）
if (secondsUntilNextPeriod < 0) {
  // 检查是否已经存在下一个周期的市场
  const nextPeriodEndTime = getNextPeriodTime(template.period);
  const existingMarket = await prisma.market.findFirst({
    where: {
      templateId: template.id,
      closingDate: {
        gte: new Date(nextPeriodEndTime.getTime() - 1000),
        lte: new Date(nextPeriodEndTime.getTime() + 1000),
      },
      isFactory: true,
    },
  });
  
  // 如果不存在，应该创建（补偿生成）
  return !existingMarket;
}

// 正常逻辑：在提前时间内创建
const shouldCreate = secondsUntilNextPeriod <= template.advanceTime && secondsUntilNextPeriod > 0;
return shouldCreate;
```

### 修复2: 增加Cron Job健康检查

**建议**：
1. 在Cron Job API中添加健康检查端点
2. 记录每次运行的日志和时间戳
3. 如果超过一定时间没有运行，发送告警

---

## 检查清单

- [ ] 检查服务器日志，确认Cron Job是否在运行
- [ ] 检查 `lastCreatedAt`，确认最后创建时间
- [ ] 手动触发 `/api/cron/market-factory`，确认API是否正常
- [ ] 检查模板状态（isActive、status、failureCount）
- [ ] 检查是否有外部Cron服务配置
- [ ] 检查独立进程（如果使用）是否在运行
