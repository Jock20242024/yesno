# "全网数据计算" 和 "全网数据" 的区别说明

## 核心区别

**这是两个不同的概念，我之前确实解释混了！**

---

## 1. "全网数据计算(脚本B)" - 任务（Task）

### 定义
- **类型**：`scraper_tasks` 表中的任务记录
- **名称**：`GlobalStats_Calc`
- **显示名称**：`全网数据计算(脚本B)`

### 作用
这是一个**实际运行的任务**，负责计算并更新全局统计数据。

### 执行方式

**方式1：运行独立脚本**
```bash
npx tsx scripts/scrapers/calculate-global-stats.ts
```

**方式2：调用API**
```bash
POST /api/admin/stats/calculate
```

### 功能
1. 从 Polymarket Gamma API 获取全量活跃市场数据（最多1000条）
2. 计算全网统计数据：
   - 进行中事件：活跃事件总数（去重）
   - 24H 交易量：所有市场总交易量
   - 总锁仓量 (TVL)：所有市场总流动性
   - 24H 活跃交易者：基于交易量估算
3. 更新 `global_stats` 表：直接写入中文标签对应的指标值
4. 更新 `scraper_tasks` 表：更新 `name === 'GlobalStats_Calc'` 的记录

### 相关文件
- **脚本文件**：`scripts/scrapers/calculate-global-stats.ts`
- **API接口**：`app/api/admin/stats/calculate/route.ts`
- **任务名称**：`GlobalStats_Calc`

---

## 2. "全网数据" - 数据源（Data Source）

### 定义
- **类型**：`data_sources` 表中的数据源配置
- **名称**：`全网数据`
- **配置类型**：`type: 'global_stats'`

### 作用
这是一个**数据源配置记录**，用于标识和分类，但**没有实际运行逻辑**。

### 当前状态
- ✅ 在 `data_sources` 表中存在
- ❌ 在 `app/api/admin/scrapers/[sourceName]/run/route.ts` 中**没有对应的运行逻辑**
- ❌ 点击"手动运行"会返回错误：`未知的采集源: 全网数据`

### 为什么存在？
可能是历史遗留或占位符，用于：
1. 标识这是一个全局统计数据源
2. 未来可能添加运行逻辑
3. 在UI中显示数据源列表

### 相关文件
- **数据源配置**：`app/api/admin/scrapers/route.ts`（第86-99行）
- **运行逻辑**：**不存在**（`app/api/admin/scrapers/[sourceName]/run/route.ts` 中没有对应的 case）

---

## 对比表

| 项目 | "全网数据计算(脚本B)" | "全网数据" |
|------|---------------------|-----------|
| **类型** | 任务（Task） | 数据源（Data Source） |
| **存储表** | `scraper_tasks` | `data_sources` |
| **名称** | `GlobalStats_Calc` | `全网数据` |
| **是否有运行逻辑** | ✅ 有 | ❌ 没有 |
| **执行方式** | 脚本或API | 无法执行 |
| **实际功能** | 计算并更新全局统计 | 仅配置记录 |
| **状态** | 可运行 | 占位符 |

---

## 实际使用

### 如何运行"全网数据计算"？

**方法1：运行脚本（推荐）**
```bash
npx tsx scripts/scrapers/calculate-global-stats.ts
```

**方法2：调用API**
```bash
curl -X POST http://localhost:3000/api/admin/stats/calculate \
  -H "Cookie: your-admin-session-cookie"
```

**方法3：在后台管理界面**
- 进入"数据采集源监控"
- 找到"全网数据计算(脚本B)"任务
- 目前可能没有直接的"运行"按钮，需要通过API或脚本运行

### "全网数据"数据源的作用

目前**没有实际作用**，只是一个配置记录。如果需要在后台管理界面运行"全网数据计算"，应该：

1. **添加运行逻辑**：在 `app/api/admin/scrapers/[sourceName]/run/route.ts` 中添加 `case '全网数据'` 的处理
2. **或者**：直接调用 `/api/admin/stats/calculate` API

---

## 总结

- **"全网数据计算(脚本B)"** = 实际运行的任务，有完整功能
- **"全网数据"** = 数据源配置记录，目前没有运行逻辑

**我之前把这两个混在一起解释了，抱歉！**

正确的理解是：
- 如果要运行全局统计计算，应该运行"全网数据计算(脚本B)"对应的脚本或API
- "全网数据"只是一个数据源配置，目前无法直接运行

