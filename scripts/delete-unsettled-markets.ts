/**
 * 删除结算监控中心的所有未结算数据
 * 用于测试新的结算逻辑
 * 
 * 删除条件：
 * - isFactory: true（工厂市场）
 * - status 不是 RESOLVED 或 CANCELED（未结算）
 */

import { PrismaClient, MarketStatus } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 加载 .env 文件
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function deleteUnsettledMarkets() {
  try {
    console.log('🚀 开始删除所有未结算的工厂市场...');
    
    // 查询所有未结算的工厂市场
    const unsettledMarkets = await prisma.market.findMany({
      where: {
        isFactory: true,
        status: {
          notIn: [MarketStatus.RESOLVED, MarketStatus.CANCELED],
        },
      },
      select: {
        id: true,
        title: true,
        status: true,
        closingDate: true,
        resolvedOutcome: true,
      },
    });
    
    const count = unsettledMarkets.length;
    
    if (count === 0) {
      console.log('✅ 没有找到未结算的工厂市场');
      return;
    }
    
    console.log(`📊 找到 ${count} 个未结算的工厂市场`);
    console.log('📋 前10个市场信息：');
    unsettledMarkets.slice(0, 10).forEach((market, index) => {
      console.log(`  ${index + 1}. ${market.title} (${market.status}) - ${market.closingDate.toISOString()}`);
    });
    
    if (count > 10) {
      console.log(`  ... 还有 ${count - 10} 个市场`);
    }
    
    // 执行删除
    const deleteResult = await prisma.market.deleteMany({
      where: {
        isFactory: true,
        status: {
          notIn: [MarketStatus.RESOLVED, MarketStatus.CANCELED],
        },
      },
    });
    
    console.log(`✅ 删除完成：成功删除了 ${deleteResult.count} 个未结算的工厂市场`);
    
    // 验证删除结果
    const remainingCount = await prisma.market.count({
      where: {
        isFactory: true,
        status: {
          notIn: [MarketStatus.RESOLVED, MarketStatus.CANCELED],
        },
      },
    });
    
    if (remainingCount === 0) {
      console.log('✅ 验证通过：所有未结算的工厂市场已全部删除');
    } else {
      console.log(`⚠️ 警告：仍有 ${remainingCount} 个未结算的工厂市场未删除`);
    }
    
  } catch (error: any) {
    console.error('❌ 删除失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 执行删除
deleteUnsettledMarkets()
  .then(() => {
    console.log('✅ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  });
