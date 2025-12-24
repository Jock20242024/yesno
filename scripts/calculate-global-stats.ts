/**
 * 全网数据计算脚本（独立脚本）
 * 
 * 🔥 物理隔离：此脚本只负责计算并更新 GlobalStat 表中的指标
 * 与市场抓取脚本（polymarketAdapter.ts）完全分离
 * 
 * 运行方式：
 * - 单次运行: npx tsx scripts/calculate-global-stats.ts
 * - 通过 API: POST /api/admin/stats/calculate (需要创建此 API)
 */

import { prisma } from '@/lib/prisma';

/**
 * 计算并更新全局统计数据
 */
async function calculateGlobalStats() {
  try {
    console.log(`🔄 [Global Stats Calc] ========== 开始计算全局统计数据 ==========`);
    console.log(`⏰ [Global Stats Calc] 执行时间: ${new Date().toISOString()}`);

    // 1. 计算 24H 交易量（Top 100 市场的总交易量）
    const topMarkets = await prisma.market.findMany({
      where: {
        status: { in: ['OPEN', 'PENDING_REVIEW'] },
        isActive: true,
      },
      orderBy: {
        totalVolume: 'desc',
      },
      take: 100,
      select: {
        totalVolume: true,
      },
    });

    const totalVolume24h = topMarkets.reduce((sum, m) => sum + (m.totalVolume || 0), 0);
    console.log(`📊 [Global Stats Calc] Top 100 市场总交易量: $${totalVolume24h.toLocaleString()}`);

    // 2. 计算 TVL（从外部交易量估算）
    const marketsWithVolume = await prisma.market.findMany({
      where: {
        source: 'POLYMARKET',
        status: { in: ['OPEN', 'PENDING_REVIEW'] },
        isActive: true,
      },
      select: {
        externalVolume: true,
      },
      take: 100,
    });

    const totalTVL = marketsWithVolume.reduce((sum, m) => sum + ((m.externalVolume || 0) * 1.5), 0);
    console.log(`📊 [Global Stats Calc] 估算 TVL: $${totalTVL.toLocaleString()}`);

    // 3. 计算活跃人数
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeTraders = await prisma.order.groupBy({
      by: ['userId'],
      where: {
        createdAt: {
          gte: last24Hours,
        },
      },
    });

    const localActiveUsers = activeTraders.length;
    const externalActiveUsersEstimate = Math.round(totalVolume24h / 10000);
    const totalActiveUsers = localActiveUsers + externalActiveUsersEstimate;
    console.log(`📊 [Global Stats Calc] 活跃人数: ${totalActiveUsers.toLocaleString()} (本地: ${localActiveUsers}, 外部估算: ${externalActiveUsersEstimate})`);

    // 4. 计算全网持仓量
    const topMarketsForPositions = await prisma.market.findMany({
      where: {
        status: { in: ['OPEN', 'PENDING_REVIEW'] },
        isActive: true,
      },
      orderBy: {
        totalVolume: 'desc',
      },
      take: 100,
      select: {
        totalYes: true,
        totalNo: true,
      },
    });

    const totalPositions = topMarketsForPositions.reduce(
      (sum, m) => sum + (m.totalYes || 0) + (m.totalNo || 0),
      0
    );
    console.log(`📊 [Global Stats Calc] 全网持仓量: ${totalPositions.toLocaleString()}`);

    // 5. 🔥 更新 GlobalStat（防重建逻辑：只在指标存在且启用时才更新）
    const updateResults: any = {};

    // 更新 24H 交易量
    const volumeStat = await prisma.globalStat.findFirst({
      where: {
        OR: [
          { label: { contains: '24H 交易量' } },
          { label: { contains: '交易量' } },
        ],
      },
    });

    if (volumeStat && volumeStat.isActive && volumeStat.overrideValue === null) {
      await prisma.globalStat.update({
        where: { id: volumeStat.id },
        data: { value: totalVolume24h },
      });
      updateResults.volume24h = totalVolume24h;
      console.log(`✅ [Global Stats Calc] 已更新 24H 交易量: $${totalVolume24h.toLocaleString()}`);
    } else if (!volumeStat) {
      console.log(`⚠️ [Global Stats Calc] 24H 交易量指标不存在，跳过更新（不自动创建）`);
    }

    // 更新 TVL
    const tvlStat = await prisma.globalStat.findFirst({
      where: {
        OR: [
          { label: { contains: 'TVL' } },
          { label: { contains: '总锁仓量' } },
          { label: { contains: '锁仓量' } },
        ],
      },
    });

    if (tvlStat && tvlStat.isActive && tvlStat.overrideValue === null) {
      await prisma.globalStat.update({
        where: { id: tvlStat.id },
        data: { value: totalTVL },
      });
      updateResults.tvl = totalTVL;
      console.log(`✅ [Global Stats Calc] 已更新 TVL: $${totalTVL.toLocaleString()}`);
    } else if (!tvlStat) {
      console.log(`⚠️ [Global Stats Calc] TVL 指标不存在，跳过更新（不自动创建）`);
    }

    // 更新活跃人数
    const activeUsersStat = await prisma.globalStat.findFirst({
      where: {
        OR: [
          { label: { contains: '活跃交易者' } },
          { label: { contains: '活跃人数' } },
          { label: { contains: '24H 活跃' } },
        ],
      },
    });

    if (activeUsersStat && activeUsersStat.isActive && activeUsersStat.overrideValue === null) {
      await prisma.globalStat.update({
        where: { id: activeUsersStat.id },
        data: { value: totalActiveUsers },
      });
      updateResults.activeUsers = totalActiveUsers;
      console.log(`✅ [Global Stats Calc] 已更新活跃人数: ${totalActiveUsers.toLocaleString()}`);
    } else if (!activeUsersStat) {
      console.log(`⚠️ [Global Stats Calc] 活跃人数指标不存在，跳过更新（不自动创建）`);
    }

    // 更新全网持仓量
    const positionsStat = await prisma.globalStat.findFirst({
      where: {
        OR: [
          { label: { contains: '全网持仓' } },
          { label: { contains: '持仓量' } },
        ],
      },
    });

    if (positionsStat && positionsStat.isActive && positionsStat.overrideValue === null) {
      await prisma.globalStat.update({
        where: { id: positionsStat.id },
        data: { value: totalPositions },
      });
      updateResults.positions = totalPositions;
      console.log(`✅ [Global Stats Calc] 已更新全网持仓量: ${totalPositions.toLocaleString()}`);
    } else if (!positionsStat) {
      console.log(`⚠️ [Global Stats Calc] 全网持仓量指标不存在，跳过更新（不自动创建）`);
    }

    // 6. 更新 ScraperTask 状态
    const taskName = 'GlobalStats_Calc';
    try {
      await prisma.scraperTask.upsert({
        where: { name: taskName },
        create: {
          name: taskName,
          lastRunTime: new Date(),
          status: 'NORMAL',
          message: `成功计算并更新 ${Object.keys(updateResults).length} 个指标`,
          frequency: 10,
        },
        update: {
          lastRunTime: new Date(),
          status: 'NORMAL',
          message: `成功计算并更新 ${Object.keys(updateResults).length} 个指标`,
        },
      });
      console.log(`✅ [Global Stats Calc] 已更新 ScraperTask: ${taskName}`);
    } catch (error) {
      console.warn(`⚠️ [Global Stats Calc] 更新 ScraperTask 失败:`, error);
    }

    console.log(`✅ [Global Stats Calc] ========== 计算完成 ==========`);
    return {
      success: true,
      updateResults,
      stats: {
        volume24h: totalVolume24h,
        tvl: totalTVL,
        activeUsers: totalActiveUsers,
        positions: totalPositions,
      },
    };
  } catch (error) {
    console.error(`❌ [Global Stats Calc] 计算失败:`, error);
    
    // 更新 ScraperTask 状态为异常
    const taskName = 'GlobalStats_Calc';
    try {
      await prisma.scraperTask.upsert({
        where: { name: taskName },
        create: {
          name: taskName,
          lastRunTime: new Date(),
          status: 'ABNORMAL',
          message: error instanceof Error ? error.message : String(error),
          frequency: 10,
        },
        update: {
          lastRunTime: new Date(),
          status: 'ABNORMAL',
          message: error instanceof Error ? error.message : String(error),
        },
      });
    } catch (updateError) {
      console.error(`❌ [Global Stats Calc] 更新 ScraperTask 失败:`, updateError);
    }
    
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    await calculateGlobalStats();
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ [Global Stats Calc] 脚本执行失败:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
