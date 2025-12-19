# 自动化工厂使用指南

## 概述

自动化工厂（Market Factory）是一个自动化创建预测市场的工具。通过配置模板，系统可以自动按照设定的周期创建新的市场，并获取实时价格作为行权价。

## 功能特性

1. **模板管理**：创建和管理市场模板
2. **自动创建**：根据模板自动创建新市场
3. **实时价格**：从 Oracle 获取实时价格作为行权价
4. **周期管理**：支持按分钟周期自动创建市场（如 15 分钟）

## 数据库模型

### MarketTemplate 模型

```prisma
model MarketTemplate {
  id            String   @id @default(uuid())
  name          String   // 模板名称
  symbol        String   // 标的符号（如 "BTC/USD"）
  period        Int      // 周期（分钟数，如 15）
  advanceTime   Int      @default(60) // 接力时间（秒）
  oracleUrl     String?  // Oracle 价格来源 URL
  isActive      Boolean  @default(true) // 是否激活
  lastMarketId  String?  // 最后创建的市场ID
  lastCreatedAt DateTime? // 最后创建时间
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

## 使用步骤

### 1. 运行数据库迁移

```bash
npx prisma migrate dev --name add_market_template
npx prisma generate
```

### 2. 在后台创建模板

1. 登录管理后台
2. 访问"自动化工厂 (Market Factory)"页面
3. 点击"新建模板"按钮
4. 填写模板信息：
   - **模板名称**：例如 "BTC/USD 15分钟"
   - **标的符号**：例如 "BTC/USD"
   - **周期（分钟）**：例如 15
   - **接力时间（秒）**：例如 60（提前 60 秒创建下一期）
   - **Oracle URL**（可选）：价格来源 URL
5. 点击"创建模板"

### 3. 启动定时任务

有两种方式运行定时任务：

#### 方式 1：使用 Node.js 脚本（推荐用于开发环境）

```bash
npm run cron:market-factory
```

这个命令会启动一个持续运行的进程，每分钟检查一次模板并创建市场。

#### 方式 2：使用外部 Cron 服务（推荐用于生产环境）

设置外部 cron 服务（如 Vercel Cron、GitHub Actions、或服务器 cron）每分钟调用：

```
GET /api/cron/market-factory
```

**安全配置**：在 `.env` 文件中设置 `CRON_API_KEY`，然后在 cron 请求头中添加：

```
X-API-Key: your-api-key
```

### 4. 监控运行状态

定时任务会输出日志，显示：
- 检查模板的时间
- 是否满足创建条件
- 创建市场的结果
- Oracle 价格获取结果

## 工作原理

1. **每分钟检查**：定时任务每分钟执行一次
2. **计算下一个周期**：根据模板的周期（如 15 分钟），计算下一个周期的时间点
3. **判断创建时机**：如果距离下一个周期的时间 <= 接力时间（如 60 秒），则创建新市场
4. **获取实时价格**：从 Oracle（默认使用 CoinGecko API）获取实时价格
5. **创建市场**：使用获取的价格作为行权价，创建新的预测市场

### 示例场景

假设有一个模板：
- **标的**：BTC/USD
- **周期**：15 分钟
- **接力时间**：60 秒

当前时间：14:23:30

1. 计算下一个 15 分钟周期：14:30:00
2. 距离下一个周期：6 分 30 秒（390 秒）
3. 390 秒 > 60 秒，不满足条件，不创建

当前时间：14:29:00

1. 计算下一个 15 分钟周期：14:30:00
2. 距离下一个周期：60 秒
3. 60 秒 <= 60 秒，满足条件，开始创建

当前时间：14:29:01

1. 如果上次创建时间距离现在小于 7.5 分钟（周期的一半），跳过，避免重复创建

## API 接口

### 获取模板列表

```
GET /api/admin/factory/templates
```

### 创建模板

```
POST /api/admin/factory/templates
Content-Type: application/json

{
  "name": "BTC/USD 15分钟",
  "symbol": "BTC/USD",
  "period": 15,
  "advanceTime": 60,
  "oracleUrl": "https://api.coingecko.com/...",
  "isActive": true
}
```

### Cron 接口

```
GET /api/cron/market-factory
X-API-Key: your-api-key
```

## Oracle 价格获取

默认使用 CoinGecko API 获取 BTC/USD 价格。可以在 `lib/oracle.ts` 中扩展支持更多标的和价格源。

## 注意事项

1. **避免重复创建**：系统会检查上次创建时间，如果距离上次创建时间小于周期的一半，会跳过
2. **网络错误处理**：如果 Oracle API 调用失败，会记录错误但不会中断整个流程
3. **权限要求**：模板管理需要管理员权限
4. **生产环境部署**：建议使用 PM2 或其他进程管理器来运行定时任务脚本

## 故障排查

### 市场没有被创建

1. 检查模板是否激活（`isActive: true`）
2. 检查日志，确认是否满足创建条件
3. 检查 Oracle API 是否正常（网络连接、API 限制等）
4. 检查数据库连接是否正常

### 重复创建市场

1. 检查是否同时运行了多个定时任务实例
2. 检查时间同步是否正常
3. 检查上次创建时间的记录是否正确

### Oracle 价格获取失败

1. 检查网络连接
2. 检查 CoinGecko API 是否可用
3. 检查 API 调用频率是否超过限制
