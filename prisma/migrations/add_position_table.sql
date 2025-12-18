-- 添加Position表和PositionStatus枚举
-- 执行命令：npx prisma migrate dev --name add_position_table

-- 1. 创建PositionStatus枚举
CREATE TYPE "PositionStatus" AS ENUM ('OPEN', 'CLOSED');

-- 2. 创建positions表
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "outcome" "Outcome" NOT NULL,
    "shares" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "PositionStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- 3. 添加外键约束
ALTER TABLE "positions" ADD CONSTRAINT "positions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "positions" ADD CONSTRAINT "positions_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. 创建索引
CREATE INDEX "positions_userId_idx" ON "positions"("userId");
CREATE INDEX "positions_marketId_idx" ON "positions"("marketId");
CREATE INDEX "positions_status_idx" ON "positions"("status");

-- 5. 创建唯一约束（同一用户同一市场同一方向只能有一个OPEN持仓）
CREATE UNIQUE INDEX "positions_userId_marketId_outcome_status_key" ON "positions"("userId", "marketId", "outcome", "status") WHERE "status" = 'OPEN';

-- 6. 在Order表中添加type字段（如果还没有）
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT 'BUY';

-- 7. 从现有Order数据创建Position记录（数据迁移）
-- 注意：这只是一个示例，实际迁移需要根据业务逻辑调整
INSERT INTO "positions" ("id", "userId", "marketId", "outcome", "shares", "avgPrice", "status", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid()::text as id,
    o."userId",
    o."marketId",
    o."outcomeSelection" as outcome,
    -- 简化计算：假设每$1净投资 = 1份额
    SUM(o."amount" - o."feeDeducted") as shares,
    -- 简化计算：使用平均价格
    AVG((m."totalYes" / NULLIF(m."totalYes" + m."totalNo", 0))) as avgPrice,
    'OPEN'::"PositionStatus" as status,
    MIN(o."createdAt") as "createdAt",
    MAX(o."updatedAt") as "updatedAt"
FROM "orders" o
JOIN "markets" m ON o."marketId" = m."id"
WHERE o."payout" IS NULL  -- 只处理未结算的订单
GROUP BY o."userId", o."marketId", o."outcomeSelection"
HAVING SUM(o."amount" - o."feeDeducted") > 0.001;  -- 只创建有持仓的记录
