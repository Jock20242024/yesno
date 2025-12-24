/**
 * 清理结算监控中心的未结算过期市场
 * 安全删除：只删除已过期且未结算的市场，不影响其他数据
 */

import { PrismaClient, MarketStatus } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function cleanupUnsettledMarkets() {
  try {
    console.log('🧹 开始清理结算监控中心的未结算过期市场...\n');
    
    const now = new Date();
    
    // 🔥 查询条件：匹配结算监控中心的"待结算市场"查询逻辑
    // 参考：app/api/admin/settlement/route.ts
    const unsettledMarkets = await prisma.market.findMany({
      where: {
        isActive: true,
        reviewStatus: 'PUBLISHED',
        closingDate: {
          lte: now, // 已结束
        },
        resolvedOutcome: null, // 尚未结算
        status: {
          not: MarketStatus.RESOLVED, // 确保状态不是已结算
        },
      },
      select: {
        id: true,
        title: true,
        status: true,
        closingDate: true,
        isFactory: true,
        resolvedOutcome: true,
        outcomePrices: true,
        externalId: true,
        createdAt: true,
      },
      orderBy: {
        closingDate: 'asc',
      },
    });
    
    const count = unsettledMarkets.length;
    
    if (count === 0) {
      console.log('✅ 没有找到需要清理的市场');
      return;
    }
    
    console.log(`📊 找到 ${count} 个未结算的过期市场\n`);
    
    // 统计信息
    const factoryCount = unsettledMarkets.filter(m => m.isFactory).length;
    const manualCount = unsettledMarkets.filter(m => !m.isFactory).length;
    const withOddsCount = unsettledMarkets.filter(m => m.outcomePrices).length;
    const withoutOddsCount = unsettledMarkets.filter(m => !m.outcomePrices).length;
    const withExternalIdCount = unsettledMarkets.filter(m => m.externalId).length;
    const withoutExternalIdCount = unsettledMarkets.filter(m => !m.externalId).length;
    
    console.log('📈 统计信息:');
    console.log(`  - 工厂市场: ${factoryCount} 个`);
    console.log(`  - 手动市场: ${manualCount} 个`);
    console.log(`  - 有赔率数据: ${withOddsCount} 个`);
    console.log(`  - 无赔率数据: ${withoutOddsCount} 个`);
    console.log(`  - 有 externalId: ${withExternalIdCount} 个`);
    console.log(`  - 无 externalId: ${withoutExternalIdCount} 个\n`);
    
    // 显示前10个市场详情
    console.log('📋 待删除市场详情（前10个）:');
    unsettledMarkets.slice(0, 10).forEach((market, index) => {
      const hoursAgo = (now.getTime() - market.closingDate.getTime()) / (1000 * 60 * 60);
      console.log(`\n${index + 1}. ${market.title}`);
      console.log(`   状态: ${market.status}`);
      console.log(`   结束时间: ${market.closingDate.toISOString()}`);
      console.log(`   已过期: ${hoursAgo.toFixed(1)} 小时前`);
      console.log(`   类型: ${market.isFactory ? '工厂市场' : '手动市场'}`);
      console.log(`   赔率数据: ${market.outcomePrices ? '✅ 有' : '❌ 无'}`);
      console.log(`   externalId: ${market.externalId ? '✅ 有' : '❌ 无'}`);
    });
    
    if (count > 10) {
      console.log(`\n  ... 还有 ${count - 10} 个市场`);
    }
    
    // 🔥 安全删除：只删除已过期且未结算的市场
    // 这些市场已经无法自动结算（缺少必要数据），属于垃圾数据
    console.log(`\n🗑️  开始删除 ${count} 个未结算的过期市场...`);
    
    const deleteResult = await prisma.market.deleteMany({
      where: {
        isActive: true,
        reviewStatus: 'PUBLISHED',
        closingDate: {
          lte: now, // 已结束
        },
        resolvedOutcome: null, // 尚未结算
        status: {
          not: MarketStatus.RESOLVED, // 确保状态不是已结算
        },
      },
    });
    
    console.log(`✅ 删除完成：成功删除了 ${deleteResult.count} 个市场`);
    
    // 验证删除结果
    const remainingCount = await prisma.market.count({
      where: {
        isActive: true,
        reviewStatus: 'PUBLISHED',
        closingDate: {
          lte: now,
        },
        resolvedOutcome: null,
        status: {
          not: MarketStatus.RESOLVED,
        },
      },
    });
    
    if (remainingCount === 0) {
      console.log('✅ 验证通过：所有未结算的过期市场已全部删除');
    } else {
      console.log(`⚠️  警告：仍有 ${remainingCount} 个未结算的过期市场未删除`);
    }
    
    // 显示删除后的统计
    console.log(`\n📊 删除统计:`);
    console.log(`  - 已删除: ${deleteResult.count} 个`);
    console.log(`  - 剩余: ${remainingCount} 个`);
    
  } catch (error: any) {
    console.error('❌ 清理失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 执行清理
cleanupUnsettledMarkets()
  .then(() => {
    console.log('\n✅ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error);
    process.exit(1);
  });
