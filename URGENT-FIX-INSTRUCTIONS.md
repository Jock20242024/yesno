# 🔥 紧急修复：TransactionType 枚举值缺失

## 问题症状

日志中持续出现以下错误：
```
invalid input value for enum "TransactionType": "MARKET_PROFIT_LOSS"
invalid input value for enum "TransactionType": "LIQUIDITY_RECOVERY"
invalid input value for enum "TransactionType": "LIQUIDITY_INJECTION"
```

**影响**：做市监控页面无法正常显示统计数据。

## 立即修复步骤

### 方法 1：在 Supabase 控制台执行（推荐）

1. **登录 Supabase Dashboard**
   - 访问：https://supabase.com/dashboard
   - 选择你的项目

2. **打开 SQL Editor**
   - 点击左侧菜单 "SQL Editor"
   - 点击 "New query"

3. **执行修复脚本**
   - 打开项目根目录的 `URGENT-TRANSACTION-TYPE-ENUM-FIX.sql` 文件
   - 复制整个 SQL 内容
   - 粘贴到 Supabase SQL Editor
   - 点击 "Run" 执行

4. **验证修复**
   - 执行后应该看到类似输出：
     ```
     ✅ TransactionType 枚举已存在
     ✅ 已添加 LIQUIDITY_INJECTION
     ✅ 已添加 LIQUIDITY_RECOVERY
     ✅ 已添加 MARKET_PROFIT_LOSS
     ```
   - 以及一个包含所有枚举值的列表

### 方法 2：在 Vercel 数据库控制台执行

1. **登录 Vercel Dashboard**
   - 访问：https://vercel.com/dashboard
   - 选择你的项目

2. **找到数据库连接**
   - 进入项目设置
   - 找到 "Storage" 或 "Database" 部分
   - 点击进入数据库管理界面

3. **执行 SQL**
   - 找到 SQL 查询工具
   - 复制 `URGENT-TRANSACTION-TYPE-ENUM-FIX.sql` 的内容
   - 执行

### 方法 3：使用 Prisma Studio（如果已安装）

```bash
# 在项目根目录执行
npx prisma studio
```

然后在 Prisma Studio 的 SQL 面板中执行修复脚本。

## 修复脚本位置

- **文件路径**：`/URGENT-TRANSACTION-TYPE-ENUM-FIX.sql`
- **内容**：包含完整的 SQL 修复脚本，安全可重复执行

## 修复后验证

1. **检查日志**
   - 刷新做市监控页面
   - 检查 Vercel 日志，应该不再出现枚举错误

2. **检查数据**
   - 做市监控页面应该能正常显示统计数据
   - 如果之前显示为 0，现在应该能看到实际数据（如果有的话）

## 注意事项

- ✅ 这个 SQL 脚本是**安全的**，可以重复执行
- ✅ 使用条件判断，不会重复添加已存在的值
- ✅ 不会影响现有数据
- ⚠️ 执行后需要等待几秒钟让数据库更新完成
- ⚠️ 如果使用 Supabase，可能需要刷新页面才能看到结果

## 如果修复后仍有问题

1. **检查数据库连接**
   - 确认使用的是正确的数据库实例

2. **检查迁移历史**
   - 在 Supabase 中查看 "Database" > "Migrations"
   - 确认迁移 `20250106180000_fix_transaction_type_enum_complete` 是否已应用

3. **手动验证枚举值**
   ```sql
   SELECT enumlabel 
   FROM pg_enum 
   WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'TransactionType')
   ORDER BY enumsortorder;
   ```
   应该看到 8 个值：
   - DEPOSIT
   - WITHDRAW
   - BET
   - WIN
   - ADMIN_ADJUSTMENT
   - **LIQUIDITY_INJECTION** ← 新增
   - **LIQUIDITY_RECOVERY** ← 新增
   - **MARKET_PROFIT_LOSS** ← 新增

## 联系支持

如果执行后仍有问题，请提供：
1. SQL 执行后的完整输出
2. 验证查询的结果
3. 最新的错误日志

