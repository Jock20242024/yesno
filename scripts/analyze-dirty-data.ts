/**
 * 数据分析脚本
 * 识别需要清洗的脏数据
 * 
 * 使用方法:
 * npx tsx scripts/analyze-dirty-data.ts
 */

// 加载环境变量
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AnalysisResult {
  testUsers: number;
  testMarkets: number;
  invalidOrders: number;
  orphanOrders: number;
  expiredSessions: number;
  duplicateMarkets: number;
}

async function analyzeDirtyData(): Promise<AnalysisResult> {
  console.log('🔍 开始分析脏数据...\n');

  const result: AnalysisResult = {
    testUsers: 0,
    testMarkets: 0,
    invalidOrders: 0,
    orphanOrders: 0,
    expiredSessions: 0,
    duplicateMarkets: 0,
  };

  try {
    // 1. 分析测试用户
    console.log('1️⃣ 分析测试用户...');
    const testUsers = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: 'test', mode: 'insensitive' } },
          { email: { contains: 'demo', mode: 'insensitive' } },
          { email: { contains: 'example', mode: 'insensitive' } },
          { email: 'test@test.com' },
          { email: 'admin@admin.com' },
        ],
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
        _count: {
          select: {
            orders: true,
            positions: true,
          },
        },
      },
    });
    result.testUsers = testUsers.length;
    console.log(`   找到 ${testUsers.length} 个测试用户`);
    if (testUsers.length > 0) {
      console.log(`   示例: ${testUsers.slice(0, 3).map(u => u.email).join(', ')}`);
    }

    // 2. 分析测试市场
    console.log('\n2️⃣ 分析测试市场...');
    const testMarkets = await prisma.market.findMany({
      where: {
        OR: [
          { title: { contains: '测试', mode: 'insensitive' } },
          { title: { contains: 'test', mode: 'insensitive' } },
          { title: { contains: 'demo', mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        totalVolume: true,
        _count: {
          select: {
            orders: true,
          },
        },
      },
    });
    result.testMarkets = testMarkets.length;
    console.log(`   找到 ${testMarkets.length} 个测试市场`);
    if (testMarkets.length > 0) {
      console.log(`   示例: ${testMarkets.slice(0, 3).map(m => m.title.substring(0, 30)).join(', ')}`);
    }

    // 3. 分析无效订单（金额 <= 0）
    console.log('\n3️⃣ 分析无效订单（金额 <= 0）...');
    const invalidOrders = await prisma.orders.findMany({
      where: {
        amount: {
          lte: 0,
        },
      },
      select: {
        id: true,
        amount: true,
        createdAt: true,
      },
    });
    result.invalidOrders = invalidOrders.length;
    console.log(`   找到 ${invalidOrders.length} 个无效订单`);

    // 4. 分析孤立订单（关联的市场不存在）
    console.log('\n4️⃣ 分析孤立订单（关联的市场不存在）...');
    const allOrders = await prisma.orders.findMany({
      select: {
        id: true,
        marketId: true,
      },
    });
    
    const allMarketIds = new Set(
      (await prisma.market.findMany({ select: { id: true } })).map(m => m.id)
    );
    
    const orphanOrders = allOrders.filter(order => !allMarketIds.has(order.marketId));
    result.orphanOrders = orphanOrders.length;
    console.log(`   找到 ${orphanOrders.length} 个孤立订单`);

    // 5. 分析过期会话
    console.log('\n5️⃣ 分析过期会话...');
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
    result.expiredSessions = expiredSessions.length;
    console.log(`   找到 ${expiredSessions.length} 个过期会话`);

    // 6. 分析重复市场（相同标题）
    console.log('\n6️⃣ 分析重复市场（相同标题）...');
    const allMarkets = await prisma.market.findMany({
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
    });
    
    const titleMap = new Map<string, string[]>();
    allMarkets.forEach(market => {
      const normalizedTitle = market.title.toLowerCase().trim();
      if (!titleMap.has(normalizedTitle)) {
        titleMap.set(normalizedTitle, []);
      }
      titleMap.get(normalizedTitle)!.push(market.id);
    });
    
    const duplicateGroups = Array.from(titleMap.values()).filter(ids => ids.length > 1);
    result.duplicateMarkets = duplicateGroups.reduce((sum, ids) => sum + ids.length - 1, 0);
    console.log(`   找到 ${duplicateGroups.length} 组重复市场（共 ${result.duplicateMarkets} 个重复记录）`);

    // 输出汇总
    console.log('\n' + '='.repeat(50));
    console.log('📊 数据分析汇总:');
    console.log('='.repeat(50));
    console.log(`测试用户: ${result.testUsers} 个`);
    console.log(`测试市场: ${result.testMarkets} 个`);
    console.log(`无效订单: ${result.invalidOrders} 个`);
    console.log(`孤立订单: ${result.orphanOrders} 个`);
    console.log(`过期会话: ${result.expiredSessions} 个`);
    console.log(`重复市场: ${result.duplicateMarkets} 个`);
    console.log('='.repeat(50));

    return result;
  } catch (error) {
    console.error('❌ 分析数据时出错:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 执行分析
analyzeDirtyData()
  .then(() => {
    console.log('\n✅ 数据分析完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 数据分析失败:', error);
    process.exit(1);
  });

