# Harvester 修复总结

## 修复的问题

### 1. 删除重复函数定义
- ✅ 删除了旧的 `extractTitleTemplate` 函数（原第 334 行）
- ✅ 删除了未使用的 `extractPeriodFromTitle` 函数（原第 354 行）
- ✅ 保留了增强版的 `extractTitleTemplate` 函数（现第 406 行）

### 2. 增强模板提取逻辑

增强了 `extractTitleTemplate` 函数以处理多种特殊格式：

#### 支持的特殊格式：

1. **"Up or Down" 格式**
   - 示例: "Ethereum Up or Down - October 24, 10:15AM-10:30AM ET"
   - 输出: "Will ETH be above $[StrikePrice] at [EndTime]?"

2. **"Hit Price" 格式**
   - 示例: "What price will Bitcoin hit in February?"
   - 输出: "What price will BTC hit in [EndTime]?"

3. **"Multi Strikes" 格式**
   - 示例: "BTC above $30,000 on April 12?"
   - 输出: "BTC above $[StrikePrice] on [EndTime]?"

4. **"Neg Risk" 格式**
   - 通用替换处理

5. **通用格式**
   - 自动替换价格和时间占位符
   - 统一资产名称（Bitcoin -> BTC, Ethereum -> ETH, Solana -> SOL）

### 3. 增强错误处理

- ✅ 添加了 try-catch 包裹模板提取逻辑
- ✅ 增强了错误日志输出，包含错误代码和元数据
- ✅ 模板提取失败时使用原始标题作为后备

### 4. 数据库字段确认

确认以下字段在 schema 中都有默认值：
- ✅ `categorySlug` (String?)
- ✅ `status` (String @default("ACTIVE"))
- ✅ `priceOffset` (Float @default(0.0))

## 数据库迁移

**注意**: 请确保运行了数据库迁移：

```bash
npx prisma migrate dev
```

如果迁移状态显示有未应用的迁移，请先运行迁移命令。

## 使用方法

运行抓取：

```bash
POST /api/admin/factory/harvest
```

或者通过工厂管理页面点击"从 Polymarket 抓取标准模板"按钮。

## 预期结果

抓取完成后应该看到：
- 创建/更新的模板数量
- 跳过的数量（如果 symbol-period 组合已存在）
- 错误数量（应该为 0 或接近 0）
- 总共处理的唯一模板数量

目标：确保 56 个标准周期模板全部入库。
