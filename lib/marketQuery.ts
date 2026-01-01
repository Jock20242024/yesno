/**
 * 🚀 市场查询统一过滤器
 * 整个系统唯一的准入真理
 * 所有市场查询接口必须基于此过滤器
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * 🚀 基础市场过滤器
 * 所有市场查询的基础条件，确保只返回可显示的市场
 */
export const BASE_MARKET_FILTER = {
  isActive: true,
  status: 'OPEN' as const,
  reviewStatus: 'PUBLISHED' as const,
};

// 🚀 缓存热门分类的 UUID（避免每次查询都查数据库）
let cachedHotCategoryId: string | null = null;

/**
 * 获取热门分类的 UUID（带缓存）
 */
async function getHotCategoryId(): Promise<string | null> {
  if (cachedHotCategoryId) {
    return cachedHotCategoryId;
  }

  try {
    const hotCategory = await prisma.categories.findFirst({
      where: {
        OR: [
          { slug: '-1' },
          { slug: 'hot' },
          { name: { contains: '热门' } },
        ],
      },
      select: { id: true },
    });

    if (hotCategory) {
      cachedHotCategoryId = hotCategory.id;
      return hotCategory.id;
    }
  } catch (error) {
    console.error('❌ [marketQuery] 获取热门分类ID失败:', error);
  }

  return null;
}

/**
 * 构建热门市场查询条件
 * @param baseFilter 基础过滤器（默认使用 BASE_MARKET_FILTER）
 * @returns Prisma Where 条件
 * 
 * 🚀 物理收紧：热门列表的唯一标准是 isHot: true
 * 彻底废除"只要分类是热门就是热门"的逻辑
 * 一个市场可以属于任何分类，只要 isHot: true，它就出现在热门里
 * 如果 isHot: false，即便它分类填错了被填成了热门，它也不准出现在前端热门列表里
 */
export async function buildHotMarketFilter(baseFilter = BASE_MARKET_FILTER): Promise<Prisma.marketsWhereInput> {
  // 🚀 唯一标准：必须物理勾选了 isHot
  return {
    ...baseFilter,
    isHot: true, // 🚀 物理收紧：热门只由 isHot 标签决定，与它在哪个分类无关
  };
}

/**
 * 🚀 同步版本（用于兼容性，但会查询数据库）
 * 注意：这个函数会阻塞，建议使用异步版本
 * 
 * 🚀 物理收紧：热门列表的唯一标准是 isHot: true
 */
export function buildHotMarketFilterSync(baseFilter = BASE_MARKET_FILTER): Prisma.marketsWhereInput {
  // 🚀 唯一标准：必须物理勾选了 isHot
  return {
    ...baseFilter,
    isHot: true, // 🚀 物理收紧：热门只由 isHot 标签决定，与它在哪个分类无关
  };
}

/**
 * 构建分类市场查询条件
 * @param categoryId 分类 ID
 * @param baseFilter 基础过滤器（默认使用 BASE_MARKET_FILTER）
 * @returns Prisma Where 条件
 */
export function buildCategoryMarketFilter(
  categoryId: string,
  baseFilter = BASE_MARKET_FILTER
): Prisma.marketsWhereInput {
  return {
    ...baseFilter,
    market_categories: {
      some: {
        categoryId: categoryId
      }
    }
  };
}

/**
 * 构建通用市场查询条件（支持分类和热门）
 * @param options 查询选项
 * @returns Prisma Where 条件
 */
export async function buildMarketFilter(options: {
  categoryId?: string;
  isHot?: boolean;
  baseFilter?: typeof BASE_MARKET_FILTER;
}): Promise<Prisma.marketsWhereInput> {
  const { categoryId, isHot, baseFilter = BASE_MARKET_FILTER } = options;

  // 热门查询
  if (isHot || categoryId === '-1' || categoryId === 'hot') {
    return await buildHotMarketFilter(baseFilter);
  }

  // 分类查询
  if (categoryId) {
    return buildCategoryMarketFilter(categoryId, baseFilter);
  }

  // 默认：返回基础过滤器
  return baseFilter;
}
