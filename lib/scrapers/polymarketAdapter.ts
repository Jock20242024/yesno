/**
 * Polymarket 采集适配器
 * 实现 ScraperEngine 接口，专门对接 Polymarket Gamma API
 */

import { ScraperEngine, ScrapeResult } from './engine';
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

/**
 * 将 Polymarket 分类映射到本地分类（基于标签和标题）
 */
function mapPolymarketCategory(tags: string[] = [], title: string = ''): string | null {
  const lowerTitle = title.toLowerCase();
  
  // 标签匹配
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

  for (const tag of tags) {
    const lowerTag = tag.toLowerCase();
    if (categoryMap[lowerTag]) {
      return categoryMap[lowerTag];
    }
  }

  // 标题关键词匹配
  const keywordMap: Record<string, string> = {
    'btc': 'crypto',
    'bitcoin': 'crypto',
    'ethereum': 'crypto',
    'eth': 'crypto',
    'crypto': 'crypto',
    'president': 'politics',
    'election': 'politics',
    'vote': 'politics',
    'nba': 'sports',
    'nfl': 'sports',
    'football': 'sports',
    'ai': 'technology',
    'tech': 'technology',
    'apple': 'technology',
    'stock': 'finance',
    'dow': 'finance',
    'sp500': 'finance',
  };

  for (const [keyword, category] of Object.entries(keywordMap)) {
    if (lowerTitle.includes(keyword)) {
      return category;
    }
  }

  return null;
}

/**
 * Polymarket 采集适配器
 */
export class PolymarketAdapter extends ScraperEngine {
  private limit: number;

  constructor(limit: number = 100) {
    super('Polymarket');
    this.limit = limit;
  }

  /**
   * 从 Polymarket Gamma API 获取原始数据
   */
  protected async fetch(): Promise<PolymarketMarket[]> {
    const url = new URL('https://gamma-api.polymarket.com/markets');
    url.searchParams.set('closed', 'false');
    url.searchParams.set('limit', this.limit.toString());
    url.searchParams.set('offset', '0');
    url.searchParams.set('order', 'id');
    url.searchParams.set('ascending', 'false');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  /**
   * 标准化 Polymarket 数据
   */
  protected normalize(rawData: PolymarketMarket[]): PolymarketMarket[] {
    // 过滤和清理数据
    return rawData.filter(market => {
      return market.id && (market.title || market.question);
    });
  }

  /**
   * 保存标准化后的数据到数据库
   */
  protected async save(normalizedData: PolymarketMarket[]): Promise<number> {
    let savedCount = 0;

    for (const marketData of normalizedData) {
      try {
        if (!marketData.id) continue;

        // 获取或创建分类
        let categoryId: string | null = null;
        const categorySlug = mapPolymarketCategory(
          marketData.tags || [],
          marketData.title || marketData.question || ''
        );

        if (categorySlug) {
          const category = await prisma.category.findFirst({
            where: { slug: categorySlug, status: 'ACTIVE' },
          });
          if (category) {
            categoryId = category.id;
          }
        }

        // 计算概率
        let yesProbability = 50;
        let noProbability = 50;
        
        if (marketData.yes_price !== undefined && marketData.no_price !== undefined) {
          yesProbability = Math.round(marketData.yes_price * 100);
          noProbability = Math.round(marketData.no_price * 100);
        } else if (marketData.yes_price !== undefined) {
          yesProbability = Math.round(marketData.yes_price * 100);
          noProbability = 100 - yesProbability;
        }

        // 解析日期
        const endDate = marketData.endDateIso
          ? new Date(marketData.endDateIso)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        // 检查是否已存在
        const existingMarket = await prisma.market.findFirst({
          where: {
            externalId: marketData.id,
            externalSource: 'polymarket',
          },
        });

        if (existingMarket) {
          // 如果已拒绝，跳过
          if (existingMarket.reviewStatus === 'REJECTED') {
            continue;
          }

          // 如果已发布，只更新交易量和概率
          if (existingMarket.reviewStatus === 'PUBLISHED') {
            await prisma.market.update({
              where: { id: existingMarket.id },
              data: {
                totalVolume: marketData.volumeNum || 0,
                yesProbability,
                noProbability,
              },
            });
            savedCount++;
            continue;
          }

          // 如果待审核，更新所有数据但保持 PENDING 状态
          await prisma.market.update({
            where: { id: existingMarket.id },
            data: {
              title: marketData.title || marketData.question || existingMarket.title,
              description: marketData.description || existingMarket.description,
              closingDate: endDate,
              totalVolume: marketData.volumeNum || 0,
              yesProbability,
              noProbability,
              isHot: (marketData.volumeNum || 0) > 10000,
              reviewStatus: 'PENDING',
            },
          });
        } else {
          // 创建新市场（状态为 PENDING）
          const market = await prisma.market.create({
            data: {
              title: marketData.title || marketData.question || '未命名市场',
              description: marketData.description || '',
              closingDate: endDate,
              totalVolume: marketData.volumeNum || 0,
              yesProbability,
              noProbability,
              isHot: (marketData.volumeNum || 0) > 10000,
              externalId: marketData.id,
              externalSource: 'polymarket',
              status: marketData.closed ? 'CLOSED' : 'OPEN',
              reviewStatus: 'PENDING',
              category: categorySlug || null,
              categorySlug: categorySlug || null,
            },
          });

          // 创建分类关联
          if (categoryId) {
            await prisma.marketCategory.create({
              data: {
                marketId: market.id,
                categoryId: categoryId,
              },
            });
          }

          savedCount++;
        }
      } catch (error) {
        console.error(`❌ [PolymarketAdapter] 保存市场失败 (ID: ${marketData.id}):`, error);
        // 继续处理下一个
      }
    }

    return savedCount;
  }
}
