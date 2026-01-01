/**
 * 全网数据计算 API
 * POST /api/admin/stats/calculate
 * 
 * 🔥 物理隔离：此 API 只负责计算并更新 GlobalStat 表中的指标
 * 与市场抓取脚本完全分离
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { auth } from "@/lib/authExport";
import { prisma } from '@/lib/prisma';

export const dynamic = "force-dynamic";

/**
 * 计算并更新全局统计数据（从独立脚本提取的逻辑）
 */
async function calculateGlobalStats() {
  try {

    // 1. 计算 24H 交易量（Top 100 市场的总交易量）
    const topMarkets = await prisma.markets.findMany({
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

    // 2. 计算 TVL
    const marketsWithVolume = await prisma.markets.findMany({
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

    // 3. 计算活跃人数
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeTraders = await prisma.orders.groupBy({
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

    // 4. 计算全网持仓量
    const topMarketsForPositions = await prisma.markets.findMany({
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

    // 5. 🔥 更新 GlobalStat（防重建逻辑：只在指标存在且启用时才更新）
    const updateResults: any = {};

    // 更新 24H 交易量
    const volumeStat = await prisma.global_stats.findFirst({
      where: {
        OR: [
          { label: { contains: '24H 交易量' } },
          { label: { contains: '交易量' } },
        ],
      },
    });

    if (volumeStat && volumeStat.isActive && volumeStat.overrideValue === null) {
      await prisma.global_stats.update({
        where: { id: volumeStat.id },
        data: { value: totalVolume24h },
      });
      updateResults.volume24h = totalVolume24h;
    } else if (!volumeStat) {

    }

    // 更新 TVL
    const tvlStat = await prisma.global_stats.findFirst({
      where: {
        OR: [
          { label: { contains: 'TVL' } },
          { label: { contains: '总锁仓量' } },
          { label: { contains: '锁仓量' } },
        ],
      },
    });

    if (tvlStat && tvlStat.isActive && tvlStat.overrideValue === null) {
      await prisma.global_stats.update({
        where: { id: tvlStat.id },
        data: { value: totalTVL },
      });
      updateResults.tvl = totalTVL;
    } else if (!tvlStat) {

    }

    // 更新活跃人数
    const activeUsersStat = await prisma.global_stats.findFirst({
      where: {
        OR: [
          { label: { contains: '活跃交易者' } },
          { label: { contains: '活跃人数' } },
          { label: { contains: '24H 活跃' } },
        ],
      },
    });

    if (activeUsersStat && activeUsersStat.isActive && activeUsersStat.overrideValue === null) {
      await prisma.global_stats.update({
        where: { id: activeUsersStat.id },
        data: { value: totalActiveUsers },
      });
      updateResults.activeUsers = totalActiveUsers;
    } else if (!activeUsersStat) {

    }

    // 更新全网持仓量
    const positionsStat = await prisma.global_stats.findFirst({
      where: {
        OR: [
          { label: { contains: '全网持仓' } },
          { label: { contains: '持仓量' } },
        ],
      },
    });

    if (positionsStat && positionsStat.isActive && positionsStat.overrideValue === null) {
      await prisma.global_stats.update({
        where: { id: positionsStat.id },
        data: { value: totalPositions },
      });
      updateResults.positions = totalPositions;
    } else if (!positionsStat) {

    }

    // 6. 更新 ScraperTask 状态
    const taskName = 'GlobalStats_Calc';
    try {
      await prisma.scraper_tasks.upsert({
        where: { name: taskName },
        create: {
          id: randomUUID(),
          updatedAt: new Date(),
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
    } catch (error) {
      console.warn(`⚠️ [Global Stats Calculate API] 更新 ScraperTask 失败:`, error);
    }

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
    console.error(`❌ [Global Stats Calculate API] 计算失败:`, error);
    
    // 更新 ScraperTask 状态为异常
    const taskName = 'GlobalStats_Calc';
    try {
      await prisma.scraper_tasks.upsert({
        where: { name: taskName },
        create: {
          id: randomUUID(),
          updatedAt: new Date(),
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
      console.error(`❌ [Global Stats Calculate API] 更新 ScraperTask 失败:`, updateError);
    }
    
    throw error;
  }
}

/**
 * POST /api/admin/stats/calculate
 * 执行全网数据计算
 */
export async function POST(request: NextRequest) {
  try {
    // 权限校验
    const session = await auth();
    
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const userRole = (session.user as any).role;
    const userEmail = session.user.email;
    const adminEmail = 'yesno@yesno.com';
    
    if (userRole !== 'ADMIN' && userEmail !== adminEmail) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const result = await calculateGlobalStats();
    
    return NextResponse.json({
      success: true,
      message: '全局统计数据计算成功',
      data: result.stats,
      updated: result.updateResults,
    });
  } catch (error) {
    console.error('❌ [Global Stats Calculate API] 计算失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '计算失败',
      },
      { status: 500 }
    );
  }
}
