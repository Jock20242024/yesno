-- AlterTable
-- 添加AMM恒定乘积常数和初始流动性字段
ALTER TABLE "markets" ADD COLUMN IF NOT EXISTS "ammK" DOUBLE PRECISION;
ALTER TABLE "markets" ADD COLUMN IF NOT EXISTS "initialLiquidity" DOUBLE PRECISION;

-- 为现有市场计算并更新ammK值（如果totalYes和totalNo都不为0）
UPDATE "markets" 
SET "ammK" = "totalYes" * "totalNo"
WHERE "totalYes" > 0 AND "totalNo" > 0 AND "ammK" IS NULL;

