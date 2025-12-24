/**
 * 检查市场状态的诊断脚本
 * 用于排查为什么自动结算没有工作
 */

import { PrismaClient, MarketStatus } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function checkMarketStatus() {
  try {
    console.log('🔍 开始检查市场状态...\n');
    
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    
    // 1. 查询所有已结束但未结算的工厂市场（匹配结算监控中心的查询）
    const allUnsettled = await prisma.market.findMany({
      where: {
        isFactory: true,
        isActive: true,
        closingDate: {
          lte: now, // 已结束
        },
        resolvedOutcome: null, // 尚未结算
        status: {
          not: MarketStatus.RESOLVED,
        },
      },
      select: {
        id: true,
        title: true,
        status: true,
        closingDate: true,
        outcomePrices: true,
      },
      take: 10,
    });
    
    console.log(`📊 总共找到 ${allUnsettled.length} 个已结束但未结算的工厂市场（前10个）:\n`);
    
    // 2. 按状态分组
    const statusGroups = new Map<string, number>();
    allUnsettled.forEach(m => {
      const count = statusGroups.get(m.status) || 0;
      statusGroups.set(m.status, count + 1);
    });
    
    console.log('📈 按状态分组:');
    statusGroups.forEach((count, status) => {
      console.log(`  - ${status}: ${count} 个`);
    });
    console.log('');
    
    // 3. 检查每个市场的详细信息
    console.log('📋 市场详情:');
    allUnsettled.forEach((market, index) => {
      console.log(`\n${index + 1}. ${market.title}`);
      console.log(`   状态: ${market.status}`);
      console.log(`   结束时间: ${market.closingDate.toISOString()}`);
      console.log(`   是否已过期10分钟: ${market.closingDate <= tenMinutesAgo ? '✅ 是' : '❌ 否'}`);
      console.log(`   是否有赔率数据: ${market.outcomePrices ? '✅ 是' : '❌ 否'}`);
    });
    
    // 4. 检查当前结算扫描器的查询条件
    const openMarkets = await prisma.market.count({
      where: {
        isFactory: true,
        status: MarketStatus.OPEN, // 当前结算扫描器的查询条件
        closingDate: {
          lte: tenMinutesAgo,
        },
        resolvedOutcome: null,
      },
    });
    
    console.log(`\n🔍 当前结算扫描器能查询到的市场数量（status=OPEN）: ${openMarkets} 个`);
    console.log(`⚠️  结算监控中心显示的市场数量（所有非RESOLVED状态）: ${allUnsettled.length} 个`);
    console.log(`\n💡 问题：结算扫描器只查询 OPEN 状态，但很多市场可能是 CLOSED 或其他状态！`);
    
  } catch (error: any) {
    console.error('❌ 检查失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMarketStatus();
