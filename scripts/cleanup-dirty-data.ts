/**
 * 数据清洗脚本
 * 清理测试数据、脏数据
 * 
 * ⚠️ 警告: 此脚本会删除数据，执行前请先备份数据库！
 * 
 * 使用方法:
 * npx tsx scripts/cleanup-dirty-data.ts
 * 
 * 环境变量:
 * - DRY_RUN=true  # 只显示将要删除的数据，不实际删除（默认: true）
 */

// 加载环境变量
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DRY_RUN = process.env.DRY_RUN !== 'false'; // 默认是 dry run

interface CleanupStats {
  deletedUsers: number;
  deletedMarkets: number;
  deletedOrders: number;
  deletedSessions: number;
  errors: string[];
}

async function cleanupDirtyData(): Promise<CleanupStats> {
  const stats: CleanupStats = {
    deletedUsers: 0,
    deletedMarkets: 0,
    deletedOrders: 0,
    deletedSessions: 0,
    errors: [],
  };

  console.log('🧹 开始数据清洗...\n');
  console.log(`模式: ${DRY_RUN ? '🔍 DRY RUN（预览模式，不会实际删除）' : '⚠️  实际删除模式'}\n`);

  try {
    // 1. 清理测试用户（及其相关数据）
    console.log('1️⃣ 清理测试用户...');
    const testUsers = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: 'test', mode: 'insensitive' } },
          { email: { contains: 'demo', mode: 'insensitive' } },
          { email: { contains: 'example', mode: 'insensitive' } },
          { email: 'test@test.com' },
          { email: 'admin@admin.com' },
        ],
        // 排除系统账户和管理员账户
        AND: [
          { email: { not: 'yesno@yesno.com' } },
          { email: { not: { startsWith: 'system.' } } },
        ],
      },
      select: {
        id: true,
        email: true,
        _count: {
          select: {
            orders: true,
            positions: true,
          },
        },
      },
    });

    console.log(`   找到 ${testUsers.length} 个测试用户`);
    
    if (testUsers.length > 0) {
      for (const user of testUsers) {
        console.log(`   - ${user.email} (订单: ${user._count.orders}, 持仓: ${user._count.positions})`);
        
        if (!DRY_RUN) {
          try {
            // 使用事务确保原子性
            await prisma.$transaction(async (tx) => {
              // 删除订单
              await tx.orders.deleteMany({ where: { userId: user.id } });
              // 删除持仓
              await tx.positions.deleteMany({ where: { userId: user.id } });
              // 删除交易记录
              await tx.transactions.deleteMany({ where: { userId: user.id } });
              // 删除充值记录
              await tx.deposit.deleteMany({ where: { userId: user.id } });
              // 删除提现记录
              await tx.withdrawal.deleteMany({ where: { userId: user.id } });
              // 删除用户
              await tx.users.delete({ where: { id: user.id } });
            });
            stats.deletedUsers++;
          } catch (error) {
            const errorMsg = `删除用户 ${user.email} 失败: ${error instanceof Error ? error.message : String(error)}`;
            console.error(`   ❌ ${errorMsg}`);
            stats.errors.push(errorMsg);
          }
        } else {
          stats.deletedUsers++;
        }
      }
    }

    // 2. 清理测试市场（及其相关数据）
    console.log('\n2️⃣ 清理测试市场...');
    const testMarkets = await prisma.market.findMany({
      where: {
        OR: [
          { title: { contains: '测试', mode: 'insensitive' } },
          { title: { contains: 'test', mode: 'insensitive' } },
          { title: { contains: 'demo', mode: 'insensitive' } },
        ],
        // 🔥 移除 totalVolume 限制：删除所有测试市场，不管交易量
      },
      select: {
        id: true,
        title: true,
        totalVolume: true,
        _count: {
          select: {
            orders: true,
          },
        },
      },
    });

    console.log(`   找到 ${testMarkets.length} 个测试市场`);
    
    if (testMarkets.length > 0) {
      for (const market of testMarkets) {
        console.log(`   - ${market.title.substring(0, 50)} (订单: ${market._count.orders})`);
        
        if (!DRY_RUN) {
          try {
            // 使用事务确保原子性
            await prisma.$transaction(async (tx) => {
              // 删除订单
              await tx.orders.deleteMany({ where: { marketId: market.id } });
              // 删除持仓
              await tx.positions.deleteMany({ where: { marketId: market.id } });
              // 删除市场分类关联
              await tx.marketCategory.deleteMany({ where: { marketId: market.id } });
              // 删除市场
              await tx.markets.delete({ where: { id: market.id } });
            });
            stats.deletedMarkets++;
          } catch (error) {
            const errorMsg = `删除市场 ${market.title} 失败: ${error instanceof Error ? error.message : String(error)}`;
            console.error(`   ❌ ${errorMsg}`);
            stats.errors.push(errorMsg);
          }
        } else {
          stats.deletedMarkets++;
        }
      }
    }

    // 3. 清理无效订单（金额 <= 0）
    console.log('\n3️⃣ 清理无效订单（金额 <= 0）...');
    const invalidOrders = await prisma.orders.findMany({
      where: {
        amount: {
          lte: 0,
        },
      },
      select: {
        id: true,
        amount: true,
      },
    });

    console.log(`   找到 ${invalidOrders.length} 个无效订单`);
    
    if (invalidOrders.length > 0 && !DRY_RUN) {
      const deleted = await prisma.orders.deleteMany({
        where: {
          amount: {
            lte: 0,
          },
        },
      });
      stats.deletedOrders = deleted.count;
      console.log(`   ✅ 删除了 ${deleted.count} 个无效订单`);
    } else if (invalidOrders.length > 0) {
      stats.deletedOrders = invalidOrders.length;
    }

    // 4. 清理过期会话
    console.log('\n4️⃣ 清理过期会话...');
    const now = new Date();
    const expiredSessions = await prisma.authSession.findMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
      select: {
        id: true,
        expiresAt: true,
      },
    });

    console.log(`   找到 ${expiredSessions.length} 个过期会话`);
    
    if (expiredSessions.length > 0 && !DRY_RUN) {
      const deleted = await prisma.authSession.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      });
      stats.deletedSessions = deleted.count;
      console.log(`   ✅ 删除了 ${deleted.count} 个过期会话`);
    } else if (expiredSessions.length > 0) {
      stats.deletedSessions = expiredSessions.length;
    }

    // 输出汇总
    console.log('\n' + '='.repeat(50));
    console.log('📊 数据清洗汇总:');
    console.log('='.repeat(50));
    if (DRY_RUN) {
      console.log('🔍 DRY RUN 模式 - 以下是预览数据');
    }
    console.log(`删除用户: ${stats.deletedUsers} 个`);
    console.log(`删除市场: ${stats.deletedMarkets} 个`);
    console.log(`删除订单: ${stats.deletedOrders} 个`);
    console.log(`删除会话: ${stats.deletedSessions} 个`);
    if (stats.errors.length > 0) {
      console.log(`\n❌ 错误: ${stats.errors.length} 个`);
      stats.errors.forEach(err => console.log(`   - ${err}`));
    }
    console.log('='.repeat(50));

    return stats;
  } catch (error) {
    console.error('❌ 清洗数据时出错:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 执行清洗
cleanupDirtyData()
  .then(() => {
    console.log('\n✅ 数据清洗完成');
    if (DRY_RUN) {
      console.log('\n💡 提示: 这是 DRY RUN 模式，没有实际删除数据');
      console.log('   要实际执行删除，请设置环境变量: DRY_RUN=false');
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 数据清洗失败:', error);
    process.exit(1);
  });

