-- AlterTable
ALTER TABLE "users" ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'email',
ALTER COLUMN "passwordHash" DROP NOT NULL;
