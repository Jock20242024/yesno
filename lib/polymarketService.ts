/**
 * Polymarket 市场数据采集服务
 * 从 Polymarket Gamma API 抓取活跃市场数据并同步到本地数据库
 */

import { prisma } from '@/lib/prisma';

export interface PolymarketMarket {
  id: string;
  title?: string;
  question?: string;
  outcomes?: string[];
  liquidityNum?: number;
  volumeNum?: number;
  startDateIso?: string;
  endDateIso?: string;
  tags?: string[];
  closed?: boolean;
  imageUrl?: string;
  description?: string;
  yes_price?: number;
  no_price?: number;
  icon?: string;
}

export interface PolymarketApiResponse {
  markets: PolymarketMarket[];
  count?: number;
}

/**
 * 从 Polymarket Gamma API 获取活跃市场列表
 * @param limit 每页数量（默认 100）
 * @param offset 偏移量（默认 0）
 */
export async function fetchPolymarketMarkets(
  limit: number = 100,
  offset: number = 0
): Promise<PolymarketMarket[]> {
  try {
    const url = new URL('https://gamma-api.polymarket.com/markets');
    url.searchParams.set('closed', 'false'); // 只获取活跃市场
    url.searchParams.set('limit', limit.toString());
    url.searchParams.set('offset', offset.toString());
    url.searchParams.set('order', 'id');
    url.searchParams.set('ascending', 'false'); // 最新的在前

    console.log('📡 [Polymarket] 正在获取市场数据:', url.toString());

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 60 }, // 缓存 60 秒
    });

    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Polymarket API 返回数组格式
    const markets: PolymarketMarket[] = Array.isArray(data) ? data : [];
    
    console.log(`✅ [Polymarket] 成功获取 ${markets.length} 个市场`);
    
    return markets;
  } catch (error) {
    console.error('❌ [Polymarket] 获取市场数据失败:', error);
    throw error;
  }
}

/**
 * 将 Polymarket 分类映射到本地分类
 * @param tags Polymarket 标签数组
 */
function mapPolymarketCategory(tags: string[] = []): string | null {
  // 映射规则：根据 Polymarket 的 tags 匹配本地分类
  const categoryMap: Record<string, string> = {
    'crypto': 'crypto',
    'cryptocurrency': 'crypto',
    'bitcoin': 'crypto',
    'ethereum': 'crypto',
    'politics': 'politics',
    'political': 'politics',
    'election': 'politics',
    'sports': 'sports',
    'sport': 'sports',
    'nba': 'sports',
    'football': 'sports',
    'technology': 'technology',
    'tech': 'technology',
    'ai': 'technology',
    'finance': 'finance',
    'financial': 'finance',
    'stock': 'finance',
    'economy': 'finance',
  };

  // 遍历 tags，找到第一个匹配的分类
  for (const tag of tags) {
    const lowerTag = tag.toLowerCase();
    if (categoryMap[lowerTag]) {
      return categoryMap[lowerTag];
    }
  }

  return null; // 如果没有匹配，返回 null（使用默认分类或"未分类"）
}

/**
 * 将 Polymarket 市场数据同步到本地数据库（Upsert）
 * @param polymarketMarket Polymarket 市场数据
 */
export async function upsertMarketFromPolymarket(
  polymarketMarket: PolymarketMarket
): Promise<void> {
  try {
    if (!polymarketMarket.id) {
      console.warn('⚠️ [Polymarket] 市场数据缺少 ID，跳过:', polymarketMarket);
      return;
    }

    // 获取或创建分类（结合标签和标题进行智能匹配）
    let categoryId: string | null = null;
    const categorySlug = mapPolymarketCategory(
      polymarketMarket.tags || [],
      polymarketMarket.title || polymarketMarket.question || ''
    ) || 'all';
    
    if (categorySlug !== 'all') {
      const category = await prisma.category.findFirst({
        where: { slug: categorySlug, status: 'ACTIVE' },
      });
      
      if (category) {
        categoryId = category.id;
      } else {
        // 如果分类不存在，创建默认分类（或使用"未分类"）
        console.warn(`⚠️ [Polymarket] 分类 ${categorySlug} 不存在，使用默认分类`);
      }
    }

    // 计算 Yes/No 概率
    // 注意：Polymarket API 可能不直接提供 yes_price/no_price，需要从 outcomes 或 liquidity 计算
    // 这里使用简化的默认值，实际使用时需要根据 API 响应结构调整
    let yesProbability = 50;
    let noProbability = 50;
    
    if (polymarketMarket.yes_price !== undefined && polymarketMarket.no_price !== undefined) {
      // 如果直接提供了价格
      yesProbability = Math.round(polymarketMarket.yes_price * 100);
      noProbability = Math.round(polymarketMarket.no_price * 100);
    } else if (polymarketMarket.yes_price !== undefined) {
      // 如果只提供了 yes_price
      yesProbability = Math.round(polymarketMarket.yes_price * 100);
      noProbability = 100 - yesProbability;
    }

    // 解析日期
    const endDate = polymarketMarket.endDateIso 
      ? new Date(polymarketMarket.endDateIso)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 默认 30 天后

    // 准备市场数据
    const marketData = {
      title: polymarketMarket.title || polymarketMarket.question || '未命名市场',
      description: polymarketMarket.description || '',
      closingDate: endDate,
      totalVolume: polymarketMarket.volumeNum || 0,
      yesProbability,
      noProbability,
      // 根据交易量决定是否热门（交易量 > 10000 视为热门）
      isHot: (polymarketMarket.volumeNum || 0) > 10000,
      externalId: polymarketMarket.id,
      externalSource: 'polymarket',
      status: polymarketMarket.closed ? 'CLOSED' : 'OPEN',
    };

    // 使用 upsert 逻辑：基于 externalId 和 externalSource 的唯一组合
    // 智能更新逻辑：
    // 1. 新事件：设为 PENDING（待审核）
    // 2. 已拒绝事件：如果状态为 REJECTED，直接跳过
    // 3. 已发布事件：仅更新交易量和概率，保持 PUBLISHED 状态
    const existingMarket = await prisma.market.findFirst({
      where: {
        externalId: polymarketMarket.id,
        externalSource: 'polymarket',
      },
      include: {
        categories: true,
      },
    });

    let market;
    if (existingMarket) {
      // 如果已拒绝，直接跳过
      if (existingMarket.reviewStatus === 'REJECTED') {
        console.log(`⏭️ [Polymarket] 市场已拒绝，跳过: ${existingMarket.title} (${existingMarket.id})`);
        return;
      }

      // 如果已发布，只更新交易量和概率，保持 PUBLISHED 状态
      if (existingMarket.reviewStatus === 'PUBLISHED') {
        market = await prisma.market.update({
          where: { id: existingMarket.id },
          data: {
            totalVolume: marketData.totalVolume,
            yesProbability: marketData.yesProbability,
            noProbability: marketData.noProbability,
            // 保持 reviewStatus 为 PUBLISHED
          },
        });
        console.log(`🔄 [Polymarket] 更新已发布市场（交易量和概率）: ${market.title} (${market.id})`);
      } else {
        // 如果状态是 PENDING 或其他，更新所有数据（包括 reviewStatus 保持为 PENDING）
        market = await prisma.market.update({
          where: { id: existingMarket.id },
          data: {
            ...marketData,
            reviewStatus: 'PENDING', // 确保保持待审核状态
          },
        });
        console.log(`🔄 [Polymarket] 更新待审核市场: ${market.title} (${market.id})`);
      }
    } else {
      // 创建新市场，状态设为 PENDING（待审核）
      market = await prisma.market.create({
        data: {
          ...marketData,
          reviewStatus: 'PENDING', // 新事件默认为待审核
        },
      });
      console.log(`➕ [Polymarket] 创建新市场（待审核）: ${market.title} (${market.id})`);
    }

    // 处理分类关联：如果分类存在，确保关联已建立
    if (categoryId) {
      const existingRelation = await prisma.marketCategory.findFirst({
        where: {
          marketId: market.id,
          categoryId: categoryId,
        },
      });

      if (!existingRelation) {
        await prisma.marketCategory.create({
          data: {
            marketId: market.id,
            categoryId: categoryId,
          },
        });
        console.log(`🔗 [Polymarket] 关联分类: ${categorySlug} -> ${market.title}`);
      }
    }

  } catch (error) {
    console.error('❌ [Polymarket] 同步市场失败:', error);
    throw error;
  }
}

/**
 * 批量同步 Polymarket 市场数据
 * @param limit 每次获取的数量（默认 100）
 */
export async function syncPolymarketMarkets(limit: number = 100): Promise<{
  success: boolean;
  created: number;
  updated: number;
  errors: number;
}> {
  const stats = {
    success: false,
    created: 0,
    updated: 0,
    errors: 0,
  };

  try {
    console.log('🚀 [Polymarket] 开始批量同步市场数据...');
    
    // 获取 Polymarket 市场列表
    const markets = await fetchPolymarketMarkets(limit, 0);

    // 逐个同步到数据库
    for (const market of markets) {
      try {
        // 检查是否已存在（用于统计）
        const existing = await prisma.market.findFirst({
          where: {
            externalId: market.id,
            externalSource: 'polymarket',
          },
        });

        const wasNew = !existing;
        
        // 执行 upsert（内部会判断更新或创建）
        await upsertMarketFromPolymarket(market);

        if (wasNew) {
          stats.created++;
        } else {
          stats.updated++;
        }
      } catch (error) {
        console.error(`❌ [Polymarket] 同步市场失败 (ID: ${market.id}):`, error);
        stats.errors++;
      }
    }

    stats.success = true;
    console.log(`✅ [Polymarket] 同步完成: 创建 ${stats.created}, 更新 ${stats.updated}, 错误 ${stats.errors}`);

    return stats;
  } catch (error) {
    console.error('❌ [Polymarket] 批量同步失败:', error);
    throw error;
  }
}
