import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BASE_MARKET_FILTER, buildHotMarketFilter, buildCategoryMarketFilter } from '@/lib/marketQuery'; // 🚀 统一过滤器
import dayjs from '@/lib/dayjs';
import { aggregateMarketsByTemplate } from '@/lib/marketAggregation'; // 🔥 使用公共聚合函数

/**
 * 公开 API - 获取分类列表
 * GET /api/categories
 * 
 * 返回所有启用的分类，按 displayOrder 排序
 * 前端导航栏使用此 API
 * 注意：这是公开 API，不需要权限验证
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📋 [Categories API] 开始获取分类列表...');
    
    // 获取所有启用的分类，包含父子关系，按 level 和 displayOrder 排序
    const categories = await prisma.category.findMany({
      where: {
        status: 'active',
      },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        children: {
          where: {
            status: 'active',
          },
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
            level: true,
            displayOrder: true,
            sortOrder: true,
            children: {
              where: {
                status: 'active',
              },
              select: {
                id: true,
                name: true,
                slug: true,
                icon: true,
                level: true,
                displayOrder: true,
                sortOrder: true,
              },
              orderBy: [
                { sortOrder: 'asc' },
                { displayOrder: 'asc' },
              ],
            },
          },
          orderBy: [
            { sortOrder: 'asc' }, // 🔥 优先按 sortOrder 升序排序
            { displayOrder: 'asc' }, // 备用排序
          ],
        },
      },
      orderBy: [
        { level: 'asc' },
        { sortOrder: 'asc' },
        { displayOrder: 'asc' }, // 备用排序
      ],
    });

    console.log(`✅ [Categories API] 成功获取 ${categories.length} 个分类:`, categories.map(c => c.name));

    // 🔥 递归函数：获取分类及其所有子分类的 ID
    const getAllCategoryIds = (category: any): string[] => {
      const ids = [category.id];
      if (category.children && category.children.length > 0) {
        category.children.forEach((child: any) => {
          ids.push(...getAllCategoryIds(child));
        });
      }
      return ids;
    };

    // 🔥 使用公共聚合函数（已在文件顶部导入）

    // 🔥 递归函数：为分类及其子分类添加 count
    // 物理重写：严禁直接使用 count()，必须基于聚合后的唯一市场数量
    const addCountToCategory = async (category: any): Promise<any> => {
      // 先递归处理子分类，获取子分类的 count
      const childrenWithCount = category.children && category.children.length > 0
        ? await Promise.all(category.children.map((child: any) => addCountToCategory(child)))
        : undefined;

      // 获取当前分类及其所有子分类的 ID
      const categoryIds = getAllCategoryIds(category);

      // 🚀 核心修复：判断是否为热门分类（categoryId === "-1" 或 slug === "hot"）
      const isHotCategory = category.id === "-1" || category.slug === "hot" || category.name === "热门";
      
      // 🚀 物理重写：使用递归查询条件（包含父分类及其所有子分类）
      // 热门分类：使用统一的 buildHotMarketFilter 函数（动态获取真实UUID）
      // 非热门分类：使用 BASE_MARKET_FILTER + categoryIds（包含所有子分类）
      const whereCondition = isHotCategory 
        ? await buildHotMarketFilter()
        : {
            ...BASE_MARKET_FILTER,
            categories: {
              some: {
                categoryId: { in: categoryIds }, // 🚀 修复：使用递归的categoryIds，包含父分类及其所有子分类
              }
            }
          };

      // 🚀 物理重写统计逻辑：
      // 1. 先 findMany 获取所有符合 BASE_MARKET_FILTER 的市场记录
      // 2. 执行 aggregateMarketsByTemplate 聚合
      // 3. 返回聚合后的 Array.length
      // 🚀 关键修复：必须查询与前端相同的字段，以便进行相同的时间过滤
      const marketsForAggregation = await prisma.market.findMany({
        where: whereCondition,
        select: {
          id: true,
          templateId: true,
          title: true,
          period: true,
          closingDate: true,
          status: true,
          isFactory: true,
          isActive: true, // 🚀 添加 isActive 字段，用于聚合函数中的过滤
        },
      });
      
      // 🚀 关键修复：前端统计必须使用与前端显示相同的聚合逻辑
      // 使用 aggregateMarketsByTemplate 而不是 countUniqueMarketSeries
      // 这样可以确保统计数量与前端显示数量完全一致（包括时间过滤）
      const { aggregateMarketsByTemplate } = await import('@/lib/marketAggregation');
      const aggregatedMarkets = aggregateMarketsByTemplate(marketsForAggregation);
      const uniqueMarketCount = aggregatedMarkets.length;
      
      console.log(`📊 [Categories API] 分类 "${category.name}" 聚合统计:`, {
        rawMarketsCount: marketsForAggregation.length,
        aggregatedCount: uniqueMarketCount,
        categoryIds: categoryIds,
      });
      
      // 🔥 验证：打印统计详情（用于调试，使用聚合后的数据进行验证）
      const aggregatedMarketsWithTemplate = aggregatedMarkets.filter((m: any) => m.templateId);
      const aggregatedIndependentMarkets = aggregatedMarkets.filter((m: any) => !m.templateId);
      const uniqueTemplateIds = new Set(aggregatedMarketsWithTemplate.map((m: any) => m.templateId));
      
      console.log(`📊 [Categories API] 分类 "${category.name}" 最终统计:`, {
        rawMarketsFromDB: marketsForAggregation.length,
        aggregatedUniqueCount: uniqueMarketCount,
        uniqueTemplateSeries: uniqueTemplateIds.size,
        independentMarkets: aggregatedIndependentMarkets.length,
        formula: `${uniqueTemplateIds.size} (聚合系列) + ${aggregatedIndependentMarkets.length} (独立市场) = ${uniqueMarketCount}`,
      });

      // 🚀 修复：直接使用 uniqueMarketCount，它已经通过 getAllCategoryIds 正确计算了父分类及其所有子分类聚合后的唯一系列总数
      // 不需要再用子分类count之和去覆盖，因为 uniqueMarketCount 已经包含了所有数据
      const marketCount = uniqueMarketCount;

      // 🔥 确保返回的 count 字段始终是 number 类型，不会是 undefined
      return {
        ...category,
        count: marketCount || 0, // 确保 count 始终是数字
        children: childrenWithCount,
      };
    };

    // 🔥 为所有分类添加市场数量
    const categoriesWithCount = await Promise.all(
      categories.map(category => addCountToCategory(category))
    );

    // 🔥 确保所有分类都有 count 字段（递归处理子分类）
    const ensureCountField = (category: any): any => {
      const count = typeof category.count === 'number' ? category.count : 0;
      return {
        ...category,
        count, // 确保 count 字段始终是 number 类型
        children: category.children ? category.children.map(ensureCountField) : undefined,
      };
    };

    const finalCategories = categoriesWithCount.map(ensureCountField);

    // 🔥 数据源头查证：物理验证 API 返回的数据结构
    if (finalCategories.length > 0) {
      console.log('📡 [Categories API] API 发送给前端的数据样例:', JSON.stringify(finalCategories[0], null, 2));
      console.log('📡 [Categories API] 第一个分类的 count 字段:', finalCategories[0].count, '类型:', typeof finalCategories[0].count);
    }

    // 🔥 调试日志：验证 count 字段是否正确返回
    console.log('📊 [Categories API] 返回的分类数据（前3个）:', 
      finalCategories.slice(0, 3).map(cat => ({
        name: cat.name,
        count: cat.count,
        hasChildren: !!cat.children,
        childrenCount: cat.children?.length || 0,
      }))
    );

    // 如果数据库为空，返回空数组（前端应该显示默认分类或提示）
    return NextResponse.json({
      success: true,
      data: finalCategories,
    });
  } catch (error) {
    console.error('❌ [Categories API] 获取分类列表失败:', error);
    // 开发环境下返回详细错误信息
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? (error instanceof Error ? error.message : '获取分类列表失败')
      : '获取分类列表失败';
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
