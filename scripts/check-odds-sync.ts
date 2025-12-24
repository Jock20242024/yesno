/**
 * 检查赔率同步状态的诊断脚本
 * 排查为什么市场没有 outcomePrices
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function checkOddsSync() {
  try {
    console.log('🔍 检查赔率同步状态...\n');
    
    // 1. 查询所有已结束但未结算的工厂市场
    const now = new Date();
    const unsettledMarkets = await prisma.market.findMany({
      where: {
        isFactory: true,
        isActive: true,
        closingDate: {
          lte: now,
        },
        resolvedOutcome: null,
        status: {
          not: 'RESOLVED',
        },
      },
      select: {
        id: true,
        title: true,
        status: true,
        closingDate: true,
        outcomePrices: true,
        externalId: true,
        isFactory: true,
      },
      take: 20,
    });
    
    console.log(`📊 总共找到 ${unsettledMarkets.length} 个待结算市场（前20个）\n`);
    
    // 2. 统计
    const withOdds = unsettledMarkets.filter(m => m.outcomePrices);
    const withoutOdds = unsettledMarkets.filter(m => !m.outcomePrices);
    const withExternalId = unsettledMarkets.filter(m => m.externalId);
    const withoutExternalId = unsettledMarkets.filter(m => !m.externalId);
    
    console.log('📈 统计数据:');
    console.log(`  - 有赔率数据: ${withOdds.length} 个`);
    console.log(`  - 没有赔率数据: ${withoutOdds.length} 个`);
    console.log(`  - 有 externalId: ${withExternalId.length} 个`);
    console.log(`  - 没有 externalId: ${withoutExternalId.length} 个\n`);
    
    // 3. 检查没有赔率数据的市场详情
    if (withoutOdds.length > 0) {
      console.log('❌ 没有赔率数据的市场（前10个）:');
      withoutOdds.slice(0, 10).forEach((market, index) => {
        const hoursAgo = (now.getTime() - market.closingDate.getTime()) / (1000 * 60 * 60);
        console.log(`\n${index + 1}. ${market.title}`);
        console.log(`   结束时间: ${market.closingDate.toISOString()}`);
        console.log(`   已过期: ${hoursAgo.toFixed(1)} 小时前`);
        console.log(`   externalId: ${market.externalId ? '✅ 有' : '❌ 无'}`);
        console.log(`   状态: ${market.status}`);
      });
    }
    
    // 4. 检查最近的工厂市场是否有赔率
    const recentMarkets = await prisma.market.findMany({
      where: {
        isFactory: true,
        isActive: true,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // 最近24小时创建的
        },
      },
      select: {
        id: true,
        title: true,
        outcomePrices: true,
        externalId: true,
        createdAt: true,
      },
      take: 10,
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    console.log(`\n📊 最近24小时创建的工厂市场（前10个）:`);
    recentMarkets.forEach((market, index) => {
      console.log(`\n${index + 1}. ${market.title}`);
      console.log(`   创建时间: ${market.createdAt.toISOString()}`);
      console.log(`   赔率数据: ${market.outcomePrices ? '✅ 有' : '❌ 无'}`);
      console.log(`   externalId: ${market.externalId ? '✅ 有' : '❌ 无'}`);
    });
    
    // 5. 建议
    console.log(`\n💡 诊断建议:`);
    if (withoutOdds.length > 0) {
      console.log(`  1. 有 ${withoutOdds.length} 个市场没有赔率数据，无法自动结算`);
      console.log(`  2. 这些市场可能是旧数据，需要等待 OddsRobot 同步`);
      console.log(`  3. 或者这些市场无法匹配到 Polymarket，无法获取赔率`);
      console.log(`  4. 建议：对于已过期超过1小时的市场，可以考虑手动结算或删除`);
    }
    if (withoutExternalId.length > withoutOdds.length) {
      console.log(`  5. 有市场缺少 externalId，可能无法同步赔率`);
    }
    
  } catch (error: any) {
    console.error('❌ 检查失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkOddsSync();
