/**
 * 脚本 B：全网数据计算
 * 
 * 🔥 核心职责：只负责计算宏观数据，不准修改具体的市场状态，不准往审核中心搬货
 * 
 * 功能：
 * 1. 抓取 Polymarket API 获取全量活跃市场
 * 2. 计算全网统计数据：
 *    - 进行中事件：统计全网真实的活跃事件总数（去重后）
 *    - 24H 交易量：计算所有市场的总交易量
 *    - 总锁仓量 (TVL)：计算所有市场的总流动性
 *    - 24H 活跃交易者：估算活跃交易者数量
 * 3. 更新 GlobalStat 表：直接写入中文标签对应的指标
 * 4. 防破坏逻辑：如果该指标在数据库中不存在或被禁用，脚本禁止创建或更新它
 * 5. 更新监控状态：更新 ScraperTask 表中 name === 'GlobalStats_Calc' 的记录
 * 
 * 运行方式：
 * - 单次运行: npx tsx scripts/scrapers/calculate-global-stats.ts
 * - 可通过 cron 定时触发
 */

import { prisma } from '@/lib/prisma';

/**
 * Polymarket API 返回的市场数据结构
 */
interface PolymarketMarket {
  id: string;
  question?: string;
  title?: string;
  slug?: string;
  closed?: boolean;
  volume?: string;
  volumeNum?: number;
  liquidity?: string;
  liquidityNum?: number;
  [key: string]: any;
}

/**
 * 从 Polymarket Gamma API 获取全量活跃市场数据
 */
async function fetchPolymarketMarkets(): Promise<PolymarketMarket[]> {
  const url = new URL('https://gamma-api.polymarket.com/markets');
  
  // 🔥 全量拉取模式：只获取活跃市场（未关闭的）
  url.searchParams.set('closed', 'false');
  url.searchParams.set('limit', '1000'); // 获取最多 1000 条
  url.searchParams.set('offset', '0');
  url.searchParams.set('order', 'volume');
  url.searchParams.set('ascending', 'false');

  const apiUrl = url.toString();
  console.log(`📡 [Global Stats Calc] 开始请求 Polymarket API: ${apiUrl}`);

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const markets = Array.isArray(data) ? data : [];
    
    console.log(`✅ [Global Stats Calc] 成功获取 ${markets.length} 条市场数据`);
    
    return markets;
  } catch (error) {
    console.error(`❌ [Global Stats Calc] 获取 Polymarket 数据失败:`, error);
    throw error;
  }
}

/**
 * 计算全网统计数据
 */
function calculateGlobalStats(markets: PolymarketMarket[]): {
  activeMarketsCount: number;
  totalVolume24h: number;
  totalTVL: number;
  activeTradersEstimate: number;
} {
  // 过滤已关闭的市场
  const activeMarkets = markets.filter(market => {
    if (!market.id) return false;
    if (market.closed === true) return false;
    return true;
  });

  // 使用 Set 去重（基于 market.id）
  const uniqueIds = new Set<string>();
  activeMarkets.forEach(market => {
    if (market.id) {
      uniqueIds.add(market.id);
    }
  });

  const activeMarketsCount = uniqueIds.size;
  
  // 计算总交易量（24H 交易量）
  let totalVolume24h = 0;
  activeMarkets.forEach(market => {
    if (market.volumeNum !== undefined && market.volumeNum > 0) {
      totalVolume24h += market.volumeNum;
    } else if (market.volume) {
      const volumeNum = parseFloat(market.volume);
      if (!isNaN(volumeNum) && volumeNum > 0) {
        totalVolume24h += volumeNum;
      }
    }
  });

  // 计算总锁仓量 (TVL)
  let totalTVL = 0;
  activeMarkets.forEach(market => {
    if (market.liquidityNum !== undefined && market.liquidityNum > 0) {
      totalTVL += market.liquidityNum;
    } else if (market.liquidity) {
      const liquidityNum = parseFloat(market.liquidity);
      if (!isNaN(liquidityNum) && liquidityNum > 0) {
        totalTVL += liquidityNum;
      }
    }
  });

  // 估算活跃交易者数量（基于交易量，假设每 $10,000 交易量对应 1 个活跃用户）
  const activeTradersEstimate = Math.round(totalVolume24h / 10000);

  console.log(`📊 [Global Stats Calc] 计算结果:`);
  console.log(`  进行中事件: ${activeMarketsCount.toLocaleString()}`);
  console.log(`  24H 交易量: $${totalVolume24h.toLocaleString()}`);
  console.log(`  总锁仓量 (TVL): $${totalTVL.toLocaleString()}`);
  console.log(`  24H 活跃交易者（估算）: ${activeTradersEstimate.toLocaleString()}`);
  
  return {
    activeMarketsCount,
    totalVolume24h,
    totalTVL,
    activeTradersEstimate,
  };
}

/**
 * 更新 GlobalStat 表中的指标
 * 
 * 🔥 核心要求：
 * 1. 只更新指定 label 的记录的 value 字段
 * 2. 防破坏逻辑：如果该指标在数据库中不存在或被禁用，脚本禁止创建或更新它
 */
async function updateGlobalStat(label: string, value: number): Promise<boolean> {
  try {
    const stat = await prisma.globalStat.findFirst({
      where: {
        label: label, // 🔥 精确匹配
      },
    });

    if (stat && stat.isActive) {
      // ✅ 只有在指标存在且处于"启用"状态时，才更新数值
      await prisma.globalStat.update({
        where: { id: stat.id },
        data: { value: value }, // 🔥 只更新 value 字段
      });
      console.log(`✅ [Global Stats Calc] 已更新 ${label}: ${value.toLocaleString()}`);
      return true;
    } else if (!stat) {
      // 🔥 防破坏逻辑：如果数据库里没有这个指标（用户删除了），脚本禁止创建，跳过更新
      console.log(`⚠️ [Global Stats Calc] ${label} 指标不存在，跳过更新（禁止自动创建）`);
      return false;
    } else {
      // 🔥 防破坏逻辑：指标存在但被禁用，脚本禁止更新
      console.log(`⚠️ [Global Stats Calc] ${label} 指标已禁用，跳过更新（禁止更新已禁用的指标）`);
      return false;
    }
  } catch (error) {
    console.error(`❌ [Global Stats Calc] 更新 GlobalStat ${label} 失败:`, error);
    return false;
  }
}

/**
 * 更新 ScraperTask 状态（使用 findUnique + update/create 代替 upsert）
 */
async function updateScraperTaskStatus(
  status: 'NORMAL' | 'ABNORMAL' | 'STOPPED',
  message?: string
): Promise<void> {
  const taskName = 'GlobalStats_Calc';
  try {
    const existing = await prisma.scraper_tasks.findUnique({
      where: { name: taskName },
    });

    if (existing) {
      await prisma.scraper_tasks.update({
        where: { name: taskName },
        data: {
          lastRunTime: new Date(),
          status,
          message: message || '运行完成',
        },
      });
    } else {
      await prisma.scraper_tasks.create({
        data: {
          name: taskName,
          lastRunTime: new Date(),
          status,
          message: message || '运行完成',
          frequency: 10,
        },
      });
    }
    console.log(`✅ [Global Stats Calc] 已更新 ScraperTask: ${taskName}, status: ${status}`);
  } catch (error) {
    console.warn(`⚠️ [Global Stats Calc] 更新 ScraperTask 失败:`, error);
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log(`\n🔄 [Global Stats Calc] ========== 开始执行脚本 B：全网数据计算 ==========`);
    console.log(`⏰ [Global Stats Calc] 执行时间: ${new Date().toISOString()}\n`);

    // 1. 抓取 Polymarket 全量数据
    const markets = await fetchPolymarketMarkets();

    // 2. 计算全网统计数据
    const stats = calculateGlobalStats(markets);

    // 3. 更新 GlobalStat 表中的各个指标（直接写入中文标签）
    const updateResults = {
      '进行中事件': await updateGlobalStat('进行中事件', stats.activeMarketsCount),
      '24H 交易量': await updateGlobalStat('24H 交易量', stats.totalVolume24h),
      '总锁仓量 (TVL)': await updateGlobalStat('总锁仓量 (TVL)', stats.totalTVL),
      '24H 活跃交易者': await updateGlobalStat('24H 活跃交易者', stats.activeTradersEstimate),
    };

    const successCount = Object.values(updateResults).filter(Boolean).length;
    const message = `成功更新 ${successCount}/4 个指标：进行中事件=${stats.activeMarketsCount}, 24H交易量=$${stats.totalVolume24h.toLocaleString()}, TVL=$${stats.totalTVL.toLocaleString()}, 活跃交易者=${stats.activeTradersEstimate}`;

    // 4. 更新 ScraperTask 状态
    await updateScraperTaskStatus('NORMAL', message);

    console.log(`\n✅ [Global Stats Calc] ========== 脚本执行成功 ==========`);
    console.log(`📊 [Global Stats Calc] 最终结果:`);
    console.log(`  进行中事件: ${stats.activeMarketsCount.toLocaleString()}`);
    console.log(`  24H 交易量: $${stats.totalVolume24h.toLocaleString()}`);
    console.log(`  总锁仓量 (TVL): $${stats.totalTVL.toLocaleString()}`);
    console.log(`  24H 活跃交易者: ${stats.activeTradersEstimate.toLocaleString()}\n`);

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ [Global Stats Calc] ========== 脚本执行失败 ==========`);
    console.error(`❌ [Global Stats Calc] 错误:`, error);
    
    // 更新 ScraperTask 状态为异常
    await updateScraperTaskStatus(
      'ABNORMAL',
      error instanceof Error ? error.message : String(error)
    );
    
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
