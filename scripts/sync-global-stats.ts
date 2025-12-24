/**
 * 全局统计数据同步脚本
 * 从 Polymarket API 抓取全局统计数据并存入 GlobalStat 表
 * 
 * 运行方式：
 * - 单次运行: npx ts-node scripts/sync-global-stats.ts
 * - 监控模式: npx ts-node scripts/sync-global-stats.ts --watch
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 从 Polymarket API 抓取全局统计数据
 */
async function fetchGlobalStats() {
  try {
    console.log('📡 [Global Stats Sync] 开始请求 Polymarket API...');
    
    // 请求 Polymarket markets API，获取所有活跃市场（用于聚合统计）
    const url = new URL('https://gamma-api.polymarket.com/markets');
    url.searchParams.set('closed', 'false');
    url.searchParams.set('limit', '1000'); // 获取更多数据以进行准确统计
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

    console.log(`✅ [Global Stats Sync] 成功获取 ${markets.length} 个市场数据`);

    // 聚合统计数据
    let totalVolume24h = 0;
    let totalLiquidity = 0;
    let activeMarketsCount = 0;

    for (const market of markets) {
      // 计算 24H 交易量
      if (market.volumeNum !== undefined && market.volumeNum > 0) {
        totalVolume24h += market.volumeNum;
      } else if (market.volume) {
        const vol = parseFloat(market.volume);
        if (!isNaN(vol) && vol > 0) {
          totalVolume24h += vol;
        }
      }

      // 计算总流动性（TVL）
      if (market.liquidityNum !== undefined && market.liquidityNum > 0) {
        totalLiquidity += market.liquidityNum;
      } else if (market.liquidity) {
        const liq = parseFloat(market.liquidity);
        if (!isNaN(liq) && liq > 0) {
          totalLiquidity += liq;
        }
      }

      // 统计活跃市场数（未关闭的市场）
      if (market.closed !== true) {
        activeMarketsCount++;
      }
    }

    // 如果没有从 API 获取到 liquidity，使用 volume 的 1.5 倍作为估算
    if (totalLiquidity === 0 && totalVolume24h > 0) {
      totalLiquidity = totalVolume24h * 1.5;
      console.log(`⚠️ [Global Stats Sync] API 未返回 liquidity，使用估算值: ${totalLiquidity.toLocaleString()}`);
    }

    console.log(`📊 [Global Stats Sync] 统计数据聚合结果:`);
    console.log(`   24H 交易量: $${totalVolume24h.toLocaleString()}`);
    console.log(`   总流动性 (TVL): $${totalLiquidity.toLocaleString()}`);
    console.log(`   活跃市场数: ${activeMarketsCount.toLocaleString()}`);

    return {
      totalVolume24h,
      totalLiquidity,
      activeMarketsCount,
    };
  } catch (error) {
    console.error('❌ [Global Stats Sync] 抓取数据失败:', error);
    throw error;
  }
}

/**
 * 更新 GlobalStat 表中的统计数据
 */
async function updateGlobalStats(stats: {
  totalVolume24h: number;
  totalLiquidity: number;
  activeMarketsCount: number;
}) {
  try {
    // 更新 24H 交易量
    const volumeStat = await prisma.globalStat.findFirst({
      where: {
        OR: [
          { label: { contains: '24H 交易量' } },
          { label: { contains: '交易量' } },
        ],
        isActive: true,
      },
    });

    if (volumeStat && volumeStat.overrideValue === null) {
      // 只有当没有手动覆盖时才更新
      await prisma.globalStat.update({
        where: { id: volumeStat.id },
        data: { value: stats.totalVolume24h },
      });
      console.log(`✅ [Global Stats Sync] 已更新 24H 交易量: $${stats.totalVolume24h.toLocaleString()}`);
    }

    // 更新 TVL
    const tvlStat = await prisma.globalStat.findFirst({
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
      await prisma.globalStat.update({
        where: { id: tvlStat.id },
        data: { value: stats.totalLiquidity },
      });
      console.log(`✅ [Global Stats Sync] 已更新 TVL: $${stats.totalLiquidity.toLocaleString()}`);
    }

    // 🔥 修复指标自动重建问题：只在指标存在且启用时才更新
    const externalMarketsStat = await prisma.globalStat.findFirst({
      where: {
        label: 'external_active_markets_count',
      },
    });

    if (externalMarketsStat && externalMarketsStat.isActive) {
      // ✅ 只有在指标存在且处于"启用"状态时，才更新数值
      await prisma.globalStat.update({
        where: { id: externalMarketsStat.id },
        data: { value: stats.activeMarketsCount },
      });
      console.log(`✅ [Global Stats Sync] 已更新 external_active_markets_count: ${stats.activeMarketsCount.toLocaleString()}`);
    } else if (!externalMarketsStat) {
      // 🔥 如果数据库里没有这个指标（用户删除了），脚本就不再管它，不再自动创建
      console.log(`⚠️ [Global Stats Sync] external_active_markets_count 指标不存在，跳过更新（不自动创建）`);
    } else {
      // 指标存在但被禁用
      console.log(`⚠️ [Global Stats Sync] external_active_markets_count 指标已禁用，跳过更新`);
    }

    return {
      volumeUpdated: !!volumeStat,
      tvlUpdated: !!tvlStat,
      activeMarketsUpdated: true,
      externalActiveMarkets: stats.activeMarketsCount,
    };
  } catch (error) {
    console.error('❌ [Global Stats Sync] 更新数据库失败:', error);
    throw error;
  }
}

/**
 * 执行一次同步
 */
async function syncOnce() {
  try {
    console.log(`\n🕒 [${new Date().toLocaleTimeString()}] 开始同步全局统计数据...`);
    
    const stats = await fetchGlobalStats();
    await updateGlobalStats(stats);
    
    console.log(`✅ [${new Date().toLocaleTimeString()}] 同步完成！\n`);
  } catch (error) {
    console.error(`❌ [${new Date().toLocaleTimeString()}] 同步失败:`, error);
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  const isWatchMode = args.includes('--watch');

  if (isWatchMode) {
    console.log('🔄 [Global Stats Sync] 监控模式已启动（每 5 分钟同步一次）');
    console.log('💡 按 Ctrl+C 停止监控\n');

    // 立即执行一次
    await syncOnce();

    // 每 5 分钟执行一次
    const interval = setInterval(async () => {
      try {
        await syncOnce();
      } catch (error) {
        console.error('❌ [Global Stats Sync] 监控模式同步失败:', error);
        // 继续运行，不中断监控
      }
    }, 5 * 60 * 1000); // 5 分钟 = 300000 毫秒

    // 优雅退出
    process.on('SIGINT', () => {
      console.log('\n\n👋 [Global Stats Sync] 正在停止监控...');
      clearInterval(interval);
      prisma.$disconnect().then(() => {
        console.log('✅ [Global Stats Sync] 已断开数据库连接');
        process.exit(0);
      });
    });
  } else {
    // 单次运行
    await syncOnce();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('❌ [Global Stats Sync] 脚本执行失败:', error);
  process.exit(1);
});
