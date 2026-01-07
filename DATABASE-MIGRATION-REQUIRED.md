# 数据库迁移指南 - ammK 和 initialLiquidity 字段

## 问题

生产数据库中缺少 `ammK` 和 `initialLiquidity` 字段，导致以下错误：

```
The column `markets.ammK` does not exist in the current database.
```

## 解决方案

### 方法一：手动执行 SQL（推荐）

在 Vercel Postgres 控制台或 Supabase SQL 编辑器中执行以下 SQL：

```sql
-- 添加 ammK 字段（AMM恒定乘积常数 K）
ALTER TABLE "markets" ADD COLUMN IF NOT EXISTS "ammK" DOUBLE PRECISION;

-- 添加 initialLiquidity 字段（初始注入流动性金额）
ALTER TABLE "markets" ADD COLUMN IF NOT EXISTS "initialLiquidity" DOUBLE PRECISION;

-- 为现有市场计算并更新 ammK 值
UPDATE "markets"
SET "ammK" = "totalYes" * "totalNo"
WHERE "totalYes" > 0 AND "totalNo" > 0 AND "ammK" IS NULL;
```

### 方法二：使用 Prisma 迁移

在本地运行：

```bash
npx prisma migrate deploy
```

注意：这需要设置 `DATABASE_URL` 和 `DIRECT_URL` 环境变量指向生产数据库。

## 验证

执行完迁移后，可以通过以下 SQL 验证：

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'markets' 
AND column_name IN ('ammK', 'initialLiquidity');
```

应该返回两行结果：
- `ammK` - `double precision`
- `initialLiquidity` - `double precision`

## 注意事项

- 这些字段都是可选的（允许 NULL）
- `ammK` 用于 CPMM 做市算法
- `initialLiquidity` 用于结算时的本金回收校准

