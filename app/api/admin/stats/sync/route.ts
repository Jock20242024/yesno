/**
 * 管理后台 - 同步全局统计数据 API
 * POST /api/admin/stats/sync
 * 
 * 触发全局统计数据的同步（调用轻量级的同步逻辑）
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/lib/authExport";
import { prisma } from '@/lib/prisma';

export const dynamic = "force-dynamic";

/**
 * 从 Polymarket API 抓取全局统计数据（轻量级版本，仅同步全局指标）
 */
async function fetchGlobalStats() {
  try {
    const url = new URL('https://gamma-api.polymarket.com/markets');
    url.searchParams.set('closed', 'false');
    url.searchParams.set('limit', '1000');
    url.searchParams.set('offset', '0');
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.status} ${response.statusText}`);
    }

    const markets = await response.json();
    
    if (!Array.isArray(markets)) {
      throw new Error('Invalid API response: expected array');
    }

    // 聚合统计数据
    let totalVolume24h = 0;
    let totalLiquidity = 0;
    let activeMarketsCount = 0;

    for (const market of markets) {
      if (market.volumeNum !== undefined && market.volumeNum > 0) {
        totalVolume24h += market.volumeNum;
      } else if (market.volume) {
        const vol = parseFloat(market.volume);
        if (!isNaN(vol) && vol > 0) {
          totalVolume24h += vol;
        }
      }

      if (market.liquidityNum !== undefined && market.liquidityNum > 0) {
        totalLiquidity += market.liquidityNum;
      } else if (market.liquidity) {
        const liq = parseFloat(market.liquidity);
        if (!isNaN(liq) && liq > 0) {
          totalLiquidity += liq;
        }
      }

      if (market.closed !== true) {
        activeMarketsCount++;
      }
    }

    if (totalLiquidity === 0 && totalVolume24h > 0) {
      totalLiquidity = totalVolume24h * 1.5;
    }

    return {
      totalVolume24h,
      totalLiquidity,
      activeMarketsCount,
    };
  } catch (error) {
    console.error('❌ [Stats Sync API] 抓取数据失败:', error);
    throw error;
  }
}

/**
 * POST /api/admin/stats/sync
 * 触发全局统计数据同步
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

    // 抓取统计数据
    const stats = await fetchGlobalStats();

    // 更新数据库
    const updateResults: any = {};

    // 更新 24H 交易量
    const volumeStat = await prisma.global_stats.findFirst({
      where: {
        OR: [
          { label: { contains: '24H 交易量' } },
          { label: { contains: '交易量' } },
        ],
        isActive: true,
      },
    });

    if (volumeStat && volumeStat.overrideValue === null) {
      await prisma.global_stats.update({
        where: { id: volumeStat.id },
        data: { value: stats.totalVolume24h },
      });
      updateResults.volume24h = stats.totalVolume24h;
    }

    // 更新 TVL
    const tvlStat = await prisma.global_stats.findFirst({
      where: {
        OR: [
          { label: { contains: 'TVL' } },
          { label: { contains: '总锁仓量' } },
          { label: { contains: '锁仓量' } },
        ],
        isActive: true,
      },
    });

    if (tvlStat && tvlStat.overrideValue === null) {
      await prisma.global_stats.update({
        where: { id: tvlStat.id },
        data: { value: stats.totalLiquidity },
      });
      updateResults.tvl = stats.totalLiquidity;
    }

    // 🔥 修复指标自动重建问题：只在指标存在且启用时才更新
    const externalMarketsStat = await prisma.global_stats.findFirst({
      where: {
        label: 'external_active_markets_count',
      },
    });

    if (externalMarketsStat && externalMarketsStat.isActive) {
      // ✅ 只有在指标存在且处于"启用"状态时，才更新数值
      await prisma.global_stats.update({
        where: { id: externalMarketsStat.id },
        data: { value: stats.activeMarketsCount },
      });
      updateResults.externalActiveMarkets = stats.activeMarketsCount;

    } else if (!externalMarketsStat) {
      // 🔥 如果数据库里没有这个指标（用户删除了），脚本就不再管它，不再自动创建

    } else {
      // 指标存在但被禁用

    }

    return NextResponse.json({
      success: true,
      message: '全局统计数据同步成功',
      data: {
        volume24h: stats.totalVolume24h,
        tvl: stats.totalLiquidity,
        externalActiveMarkets: stats.activeMarketsCount,
        updated: updateResults,
      },
    });
  } catch (error) {
    console.error('❌ [Stats Sync API] 同步失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '同步失败',
      },
      { status: 500 }
    );
  }
}
