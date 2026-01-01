/**
 * 🔍 赔率同步诊断脚本
 * 
 * 检查内容：
 * 1. 赔率机器人（OddsRobot）运行状态
 * 2. 工厂市场的 externalId 绑定情况
 * 3. 数据库中的 outcomePrices 字段数据
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

// 加载环境变量
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function diagnoseOddsSync() {
  try {
    console.log('🔍 [Odds Sync Diagnosis] 开始诊断赔率同步状态...\n');
    console.log('='.repeat(60));
    console.log('');

    // 1. 检查赔率机器人运行状态
    console.log('📊 [1] 检查赔率机器人运行状态...\n');
    try {
      const scraperTask = await prisma.scraper_tasks.findUnique({
        where: { name: 'OddsRobot' },
      });

      if (scraperTask) {
        const lastRunTime = scraperTask.lastRunTime ? new Date(scraperTask.lastRunTime) : null;
        const now = new Date();
        const timeSinceLastRun = lastRunTime ? Math.floor((now.getTime() - lastRunTime.getTime()) / 1000) : null;

        console.log(`  ✅ 找到赔率机器人记录:`);
        console.log(`     - 名称: ${scraperTask.name}`);
        console.log(`     - 状态: ${scraperTask.status}`);
        console.log(`     - 最后运行时间: ${lastRunTime ? lastRunTime.toISOString() : '未知'}`);
        if (timeSinceLastRun !== null) {
          const minutes = Math.floor(timeSinceLastRun / 60);
          const seconds = timeSinceLastRun % 60;
          console.log(`     - 距离上次运行: ${minutes} 分 ${seconds} 秒`);
          
          if (timeSinceLastRun > 120) {
            console.log(`     ⚠️  警告: 超过 2 分钟未运行，可能已停止`);
          } else {
            console.log(`     ✅ 正常运行中（30秒周期内）`);
          }
        }
        console.log(`     - 消息: ${scraperTask.message || '无'}`);
        console.log('');
      } else {
        console.log(`  ❌ 未找到赔率机器人记录（可能从未运行过）\n`);
      }
    } catch (error: any) {
      console.error(`  ❌ 查询失败: ${error.message}\n`);
    }

    // 2. 检查工厂市场的 externalId 绑定情况
    console.log('📊 [2] 检查工厂市场的 externalId 绑定情况...\n');
    try {
      // 查询所有工厂市场
      const factoryMarkets = await prisma.market.findMany({
        where: {
          isFactory: true,
          isActive: true,
          status: { notIn: ['RESOLVED', 'CANCELED'] },
        },
        select: {
          id: true,
          title: true,
          symbol: true,
          externalId: true,
          status: true,
          closingDate: true,
        },
        take: 50, // 只检查前50个，避免数据太多
      });

      const totalFactory = factoryMarkets.length;
      const withExternalId = factoryMarkets.filter(m => m.externalId).length;
      const withoutExternalId = totalFactory - withExternalId;

      console.log(`  📈 统计结果:`);
      console.log(`     - 总工厂市场数（活跃）: ${totalFactory}`);
      console.log(`     - 已绑定 externalId: ${withExternalId} (${totalFactory > 0 ? ((withExternalId / totalFactory) * 100).toFixed(1) : 0}%)`);
      console.log(`     - 未绑定 externalId: ${withoutExternalId} (${totalFactory > 0 ? ((withoutExternalId / totalFactory) * 100).toFixed(1) : 0}%)\n`);

      // 显示未绑定的市场（最多10个）
      const unboundMarkets = factoryMarkets.filter(m => !m.externalId).slice(0, 10);
      if (unboundMarkets.length > 0) {
        console.log(`  📋 未绑定 externalId 的市场示例（前 ${Math.min(10, unboundMarkets.length)} 个）:`);
        unboundMarkets.forEach((market, index) => {
          const symbol = market.symbol || '未知';
          const isExpired = new Date(market.closingDate) < new Date();
          console.log(`     ${index + 1}. ${market.title}`);
          console.log(`        Symbol: ${symbol}, Status: ${market.status}, 已过期: ${isExpired ? '是' : '否'}`);
        });
        console.log('');
      }

      // 显示 ETH 市场的绑定情况
      const ethMarkets = factoryMarkets.filter(m => 
        (m.symbol || '').includes('ETH') || 
        (m.title || '').includes('ETH') || 
        (m.title || '').includes('以太坊')
      );
      const ethWithExternalId = ethMarkets.filter(m => m.externalId).length;
      console.log(`  🔷 ETH 市场统计:`);
      console.log(`     - ETH 市场总数: ${ethMarkets.length}`);
      console.log(`     - 已绑定 externalId: ${ethWithExternalId} / ${ethMarkets.length}`);
      console.log(`     - 未绑定: ${ethMarkets.length - ethWithExternalId} / ${ethMarkets.length}\n`);
    } catch (error: any) {
      console.error(`  ❌ 查询失败: ${error.message}\n`);
    }

    // 3. 检查 outcomePrices 字段数据
    console.log('📊 [3] 检查数据库中的 outcomePrices 字段数据...\n');
    try {
      // 查询有 externalId 的工厂市场
      const marketsWithExternalId = await prisma.market.findMany({
        where: {
          isFactory: true,
          isActive: true,
          externalId: { not: null },
          status: { notIn: ['RESOLVED', 'CANCELED'] },
        },
        select: {
          id: true,
          title: true,
          symbol: true,
          externalId: true,
          outcomePrices: true,
          status: true,
        },
        take: 50,
      });

      const totalWithExternalId = marketsWithExternalId.length;
      const withOutcomePrices = marketsWithExternalId.filter(m => m.outcomePrices).length;
      const withoutOutcomePrices = totalWithExternalId - withOutcomePrices;

      console.log(`  📈 统计结果（有 externalId 的市场）:`);
      console.log(`     - 总数: ${totalWithExternalId}`);
      console.log(`     - 有 outcomePrices: ${withOutcomePrices} (${totalWithExternalId > 0 ? ((withOutcomePrices / totalWithExternalId) * 100).toFixed(1) : 0}%)`);
      console.log(`     - 无 outcomePrices: ${withoutOutcomePrices} (${totalWithExternalId > 0 ? ((withoutOutcomePrices / totalWithExternalId) * 100).toFixed(1) : 0}%)\n`);

      // 显示有 outcomePrices 的市场示例（解析并显示）
      const marketsWithOdds = marketsWithExternalId.filter(m => m.outcomePrices).slice(0, 5);
      if (marketsWithOdds.length > 0) {
        console.log(`  ✅ 有赔率数据的市场示例（前 5 个）:`);
        marketsWithOdds.forEach((market, index) => {
          try {
            const parsed = typeof market.outcomePrices === 'string' 
              ? JSON.parse(market.outcomePrices) 
              : market.outcomePrices;
            
            let yesPrice: number | null = null;
            let noPrice: number | null = null;

            if (Array.isArray(parsed) && parsed.length >= 2) {
              yesPrice = parseFloat(String(parsed[0]));
              noPrice = parseFloat(String(parsed[1]));
            } else if (typeof parsed === 'object' && parsed !== null) {
              yesPrice = parsed.YES ? parseFloat(String(parsed.YES)) : parsed.yes ? parseFloat(String(parsed.yes)) : null;
              noPrice = parsed.NO ? parseFloat(String(parsed.NO)) : parsed.no ? parseFloat(String(parsed.no)) : null;
            }

            console.log(`     ${index + 1}. ${market.title}`);
            console.log(`        Symbol: ${market.symbol || '未知'}`);
            if (yesPrice !== null && noPrice !== null) {
              console.log(`        赔率: YES=${(yesPrice * 100).toFixed(1)}%, NO=${(noPrice * 100).toFixed(1)}%`);
            } else {
              console.log(`        赔率: 数据格式异常`);
            }
          } catch (e) {
            console.log(`     ${index + 1}. ${market.title}`);
            console.log(`        赔率: 解析失败`);
          }
        });
        console.log('');
      }

      // 显示无 outcomePrices 的市场示例
      const marketsWithoutOdds = marketsWithExternalId.filter(m => !m.outcomePrices).slice(0, 5);
      if (marketsWithoutOdds.length > 0) {
        console.log(`  ⚠️  无赔率数据的市场示例（前 5 个）:`);
        marketsWithoutOdds.forEach((market, index) => {
          console.log(`     ${index + 1}. ${market.title}`);
          console.log(`        Symbol: ${market.symbol || '未知'}, externalId: ${market.externalId}`);
        });
        console.log('');
      }
    } catch (error: any) {
      console.error(`  ❌ 查询失败: ${error.message}\n`);
    }

    // 4. 综合诊断结果和建议
    console.log('='.repeat(60));
    console.log('📋 [诊断总结与建议]\n');

    // 获取最新状态用于建议
    const scraperTask = await prisma.scraper_tasks.findUnique({
      where: { name: 'OddsRobot' },
    });
    
    const factoryMarkets = await prisma.market.findMany({
      where: {
        isFactory: true,
        isActive: true,
        status: { notIn: ['RESOLVED', 'CANCELED'] },
      },
    });

    const marketsWithExternalId = await prisma.market.findMany({
      where: {
        isFactory: true,
        isActive: true,
        externalId: { not: null },
        status: { notIn: ['RESOLVED', 'CANCELED'] },
      },
    });

    const marketsWithOdds = marketsWithExternalId.filter(m => m.outcomePrices);

    console.log('🔍 诊断结果:');
    console.log(`   1. 赔率机器人状态: ${scraperTask ? (scraperTask.status === 'NORMAL' ? '✅ 正常运行' : `⚠️  ${scraperTask.status}`) : '❌ 未运行'}`);
    console.log(`   2. externalId 绑定率: ${factoryMarkets.length > 0 ? ((marketsWithExternalId.length / factoryMarkets.length) * 100).toFixed(1) : 0}%`);
    console.log(`   3. 赔率数据同步率: ${marketsWithExternalId.length > 0 ? ((marketsWithOdds.length / marketsWithExternalId.length) * 100).toFixed(1) : 0}%\n`);

    console.log('💡 下一步建议:\n');

    if (!scraperTask || scraperTask.status !== 'NORMAL') {
      console.log('   1. ⚠️  赔率机器人未正常运行');
      console.log('      → 检查 cron scheduler 是否已启动');
      console.log('      → 检查服务器日志是否有错误');
      console.log('      → 确保 instrumentation.ts 已正确加载\n');
    }

    const bindingRate = factoryMarkets.length > 0 ? (marketsWithExternalId.length / factoryMarkets.length) : 0;
    if (bindingRate < 0.8) {
      console.log('   2. ⚠️  externalId 绑定率偏低');
      console.log('      → 检查 tryBindExternalId 函数是否正常工作');
      console.log('      → 检查 Polymarket API 是否可访问');
      console.log('      → 运行诊断脚本检查匹配逻辑\n');
    }

    const oddsRate = marketsWithExternalId.length > 0 ? (marketsWithOdds.length / marketsWithExternalId.length) : 0;
    if (oddsRate < 0.8) {
      console.log('   3. ⚠️  赔率数据同步率偏低');
      console.log('      → 确保赔率机器人正在运行');
      console.log('      → 检查 syncMarketOddsImmediately 函数是否正常工作');
      console.log('      → 检查 Polymarket API 返回的数据格式\n');
    }

    if (scraperTask && scraperTask.status === 'NORMAL' && bindingRate >= 0.8 && oddsRate >= 0.8) {
      console.log('   ✅ 所有系统运行正常！');
      console.log('      → 如果前端仍显示 50/50，请检查:');
      console.log('        1. 前端是否正确解析了 API 返回的 yesPercent/noPercent');
      console.log('        2. 浏览器缓存是否已清除');
      console.log('        3. API 返回的数据格式是否正确\n');
    }

  } catch (error: any) {
    console.error(`❌ [Odds Sync Diagnosis] 诊断失败: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行诊断
diagnoseOddsSync()
  .then(() => {
    console.log('✅ [Odds Sync Diagnosis] 诊断完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ [Odds Sync Diagnosis] 诊断失败:', error);
    process.exit(1);
  });