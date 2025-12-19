import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = "force-dynamic";

/**
 * 获取激活的全局指标（公开 API）
 * GET /api/stats
 * 
 * 返回所有 isActive: true 的指标，按 sortOrder 排序
 * 指标值会从采集源实时计算（如果指标标签匹配）
 */
export async function GET() {
  try {
    // 获取所有激活的全局指标
    const stats = await prisma.globalStat.findMany({
      where: {
        isActive: true,
      },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    // 从采集源实时计算统计数据
    let calculatedStats: any = {};
    try {
      // 获取所有激活的采集源
      const activeSources = await prisma.dataSource.findMany({
        where: {
          status: 'ACTIVE',
        },
      });

      // 计算总和（考虑权重系数）
      let totalVolume24h = 0;
      let totalMarkets = 0;

      for (const source of activeSources) {
        const weightedValue = source.itemsCount * source.multiplier;
        
        if (source.sourceName === 'Polymarket') {
          // Polymarket 的 itemsCount 是市场数量，可以估算交易量
          totalVolume24h += weightedValue * 1000000; // 假设每个市场平均 100万交易量
          totalMarkets += source.itemsCount;
        }
      }

      // 获取已发布的本地市场数量
      const localMarkets = await prisma.market.count({
        where: {
          reviewStatus: 'PUBLISHED',
          status: 'OPEN',
        },
      });

      totalMarkets += localMarkets;

      // 计算 24H 活跃交易者
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const activeTraders = await prisma.order.groupBy({
        by: ['userId'],
        where: {
          createdAt: {
            gte: last24Hours,
          },
        },
      });

      calculatedStats = {
        volume24h: totalVolume24h,
        totalMarkets,
        activeTraders24h: activeTraders.length,
      };
    } catch (error) {
      console.warn('⚠️ [Stats API] 计算统计数据失败，使用默认值:', error);
    }

    // 映射实时计算的数据到对应指标
    const statsWithCalculated = stats.map(stat => {
      let value = stat.value;

      // 根据 label 匹配实时计算的数据
      if (calculatedStats) {
        if (stat.label.includes('24H 交易量') || stat.label.includes('交易量')) {
          value = calculatedStats.volume24h || stat.value;
        } else if (stat.label.includes('进行中事件') || stat.label.includes('事件')) {
          value = calculatedStats.totalMarkets || stat.value;
        } else if (stat.label.includes('活跃交易者')) {
          value = calculatedStats.activeTraders24h || stat.value;
        }
      }

      return {
        id: stat.id,
        label: stat.label,
        value,
        unit: stat.unit,
        icon: stat.icon,
        sortOrder: stat.sortOrder,
        isActive: stat.isActive,
      };
    });

    return NextResponse.json({
      success: true,
      data: statsWithCalculated,
    });
  } catch (error) {
    console.error('❌ [Stats API] 获取全局指标失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取数据失败',
      },
      { status: 500 }
    );
  }
}
