import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = "force-dynamic";

/**
 * 计算全局统计数据（从采集源实时计算）
 * GET /api/stats/calculate
 * 
 * 根据所有采集源的 itemsCount 和 multiplier 计算总和
 */
export async function GET(request: Request) {
  try {
    // 获取所有激活的采集源
    const activeSources = await prisma.data_sources.findMany({
      where: {
        status: 'ACTIVE',
      },
    });

    // 计算总和（考虑权重系数）
    let totalVolume24h = 0;
    let totalMarkets = 0;
    let totalActiveTraders = 0;

    for (const source of activeSources) {
      // 假设每个采集源的 itemsCount 代表交易量（可以扩展更复杂的计算逻辑）
      const weightedValue = source.itemsCount * source.multiplier;
      
      // 根据采集源名称进行不同的计算
      if (source.sourceName === 'Polymarket') {
        // Polymarket 的 itemsCount 是市场数量，可以估算交易量
        totalVolume24h += weightedValue * 1000000; // 假设每个市场平均 100万交易量
        totalMarkets += source.itemsCount;
      }
      
      // 可以扩展更多采集源的计算逻辑
    }

    // 获取已发布的本地市场数量
    const localMarkets = await prisma.markets.count({
      where: {
        reviewStatus: 'PUBLISHED',
        status: 'OPEN',
      },
    });

    totalMarkets += localMarkets;

    // 计算 24H 活跃交易者（可以根据订单数量估算）
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeTraders = await prisma.orders.groupBy({
      by: ['userId'],
      where: {
        createdAt: {
          gte: last24Hours,
        },
      },
    });

    totalActiveTraders = activeTraders.length;

    return NextResponse.json({
      success: true,
      data: {
        volume24h: totalVolume24h,
        totalMarkets,
        activeTraders24h: totalActiveTraders,
        // 可以扩展更多统计指标
      },
    });
  } catch (error) {
    console.error('❌ [Stats Calculate] 计算统计数据失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '计算失败',
      },
      { status: 500 }
    );
  }
}
