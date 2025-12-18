-- AlterTable
ALTER TABLE "markets" ADD COLUMN IF NOT EXISTS "category" TEXT,
ADD COLUMN IF NOT EXISTS "categorySlug" TEXT;
