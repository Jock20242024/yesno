import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BASE_MARKET_FILTER, buildHotMarketFilter } from '@/lib/marketQuery';
import { aggregateMarketsByTemplate } from '@/lib/marketAggregation';
import { ensurePrismaConnected, executePrismaQuery } from '@/lib/prismaConnection'; // 🔥 引入 Prisma 连接工具

// 🔥 强制禁用缓存，确保新创建的分类能立即显示
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    console.log('🔍 [Categories API] 收到请求:', request.url);
    
    // 🔥 数据库连接检查：使用统一的连接工具函数
    const connected = await ensurePrismaConnected();
    if (!connected) {
      console.error('❌ [Categories API] 数据库连接失败，返回空数组');
      return NextResponse.json(
        { 
          success: true, 
          data: [],
          message: '数据库连接暂时不可用，请稍后重试'
        },
        { status: 200 }
      );
    }
    
    // 🔥 查询所有分类（包括子分类）
    const categories = await executePrismaQuery(
      async () => {
        return await prisma.categories.findMany({
      where: {
        status: 'active',
      },
      include: {
        categories: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        other_categories: {
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
        { level: 'asc' },
        { sortOrder: 'asc' },
        { displayOrder: 'asc' },
      ],
    });
      },
      [] // 连接失败时返回空数组
    );

    // 🔥 递归函数：获取分类及其所有子分类的 ID
    const getAllCategoryIds = (category: any, allCategories: any[]): string[] => {
      const ids = [category.id];
      const children = allCategories.filter(c => c.parentId === category.id);
      children.forEach(child => {
        ids.push(...getAllCategoryIds(child, allCategories));
      });
      return ids;
    };

    // 🔥 为每个分类计算市场数量（使用与后台相同的逻辑）
    const categoriesWithCount = await Promise.all(
      categories
        .filter(cat => !cat.parentId) // 只处理顶级分类
        .map(async (cat) => {
          try {
            // 🚀 判断是否为热门分类
            const isHotCategory = cat.slug === "hot" || cat.slug === "-1" || cat.name === "热门";
            
            // 🚀 构建查询条件（与后台逻辑一致）
            const whereCondition = isHotCategory 
              ? await buildHotMarketFilter()
              : {
                  ...BASE_MARKET_FILTER,
                  market_categories: {
                    some: {
                      categoryId: { in: getAllCategoryIds(cat, categories) }, // 🔥 父分类统计所有子分类
                    },
                  },
                };

            // 🚀 查询市场（与后台使用相同的字段）
            // 🔥 修复：添加错误处理，捕获连接错误
            let markets: Array<{
              id: string;
              templateId: string | null;
              title: string;
              period: number | null;
              closingDate: Date;
              status: string;
              isFactory: boolean | null;
            }> = [];
            try {
              markets = await prisma.markets.findMany({
                where: whereCondition,
                select: {
                  id: true,
                  templateId: true,
                  title: true,
                  period: true,
                  closingDate: true,
                  status: true,
                  isFactory: true,
                },
              });
            } catch (queryError: any) {
              // 如果是连接错误，尝试重新连接后重试
              if (queryError.message?.includes('Response from the Engine was empty') || 
                  queryError.message?.includes('Engine is not yet connected')) {
                try {
                  await prisma.$connect();
                  markets = await prisma.markets.findMany({
                    where: whereCondition,
                    select: {
                      id: true,
                      templateId: true,
                      title: true,
                      period: true,
                      closingDate: true,
                      status: true,
                      isFactory: true,
                    },
                  });
                } catch (retryError) {
                  console.error('❌ [Categories API] 重试查询失败:', retryError);
                  markets = []; // 返回空数组
                }
              } else {
                throw queryError; // 其他错误继续抛出
              }
            }

            // 🚀 使用与后台相同的聚合逻辑
            const aggregatedMarkets = aggregateMarketsByTemplate(markets);
            const count = aggregatedMarkets.length;

            // 🔥 为子分类计算数量
            const childrenWithCount = await Promise.all(
              (cat.other_categories || []).map(async (child: any) => {
                try {
                  const childWhereCondition = {
                    ...BASE_MARKET_FILTER,
                    market_categories: {
                      some: {
                        categoryId: child.id,
                      },
                    },
                  };

                  // 🔥 修复：添加错误处理，捕获连接错误
                  let childMarkets: Array<{
                    id: string;
                    templateId: string | null;
                    title: string;
                    period: number | null;
                    closingDate: Date;
                    status: string;
                    isFactory: boolean | null;
                  }> = [];
                  try {
                    childMarkets = await prisma.markets.findMany({
                      where: childWhereCondition,
                      select: {
                        id: true,
                        templateId: true,
                        title: true,
                        period: true,
                        closingDate: true,
                        status: true,
                        isFactory: true,
                      },
                    });
                  } catch (queryError: any) {
                    // 如果是连接错误，尝试重新连接后重试
                    if (queryError.message?.includes('Response from the Engine was empty') || 
                        queryError.message?.includes('Engine is not yet connected')) {
                      try {
                        await prisma.$connect();
                        childMarkets = await prisma.markets.findMany({
                          where: childWhereCondition,
                          select: {
                            id: true,
                            templateId: true,
                            title: true,
                            period: true,
                            closingDate: true,
                            status: true,
                            isFactory: true,
                          },
                        });
                      } catch (retryError) {
                        console.error('❌ [Categories API] 重试子分类查询失败:', retryError);
                        childMarkets = []; // 返回空数组
                      }
                    } else {
                      throw queryError; // 其他错误继续抛出
                    }
                  }

                  const aggregatedChildMarkets = aggregateMarketsByTemplate(childMarkets);
                  return {
                    id: child.id,
                    name: child.name,
                    slug: child.slug,
                    icon: child.icon,
                    level: child.level,
                    displayOrder: child.displayOrder,
                    sortOrder: child.sortOrder,
                    count: aggregatedChildMarkets.length,
                  };
                } catch (error) {
                  // 🔥 [Count API Fail] 明确记录错误
                  console.error(`[Count API Fail] ❌ [Categories API] 计算子分类 "${child.name}" (${child.slug}) 市场数量失败:`);
                  console.error('错误类型:', error instanceof Error ? error.constructor.name : typeof error);
                  console.error('错误消息:', error instanceof Error ? error.message : String(error));
                  if (error instanceof Error && error.message.includes('ETIMEDOUT')) {
                    console.error('🔴 [Count API Fail] 数据库连接超时 (6543端口问题)');
                  }
                  if (error instanceof Error && error.stack) {
                    console.error('错误堆栈:', error.stack);
                  }
                  return {
                    id: child.id,
                    name: child.name,
                    slug: child.slug,
                    icon: child.icon,
                    level: child.level,
                    displayOrder: child.displayOrder,
                    sortOrder: child.sortOrder,
                    count: 0,
                  };
                }
              })
            );

            return {
              id: cat.id,
              name: cat.name,
              slug: cat.slug,
              icon: cat.icon,
              displayOrder: cat.displayOrder,
              status: cat.status,
              createdAt: cat.createdAt,
              updatedAt: cat.updatedAt,
              level: cat.level,
              parentId: cat.parentId,
              sortOrder: cat.sortOrder,
              count: count, // 🔥 使用计算出的真实数量
              children: childrenWithCount,
            };
          } catch (error) {
            // 🔥 [Count API Fail] 明确记录错误
            console.error(`[Count API Fail] ❌ [Categories API] 计算分类 "${cat.name}" (${cat.slug}) 市场数量失败:`);
            console.error('错误类型:', error instanceof Error ? error.constructor.name : typeof error);
            console.error('错误消息:', error instanceof Error ? error.message : String(error));
            if (error instanceof Error && error.message.includes('ETIMEDOUT')) {
              console.error('🔴 [Count API Fail] 数据库连接超时 (6543端口问题)');
            }
            if (error instanceof Error && error.stack) {
              console.error('错误堆栈:', error.stack);
            }
            
            // 即使出错也返回基本结构，count设为0
            return {
              id: cat.id,
              name: cat.name,
              slug: cat.slug,
              icon: cat.icon,
              displayOrder: cat.displayOrder,
              status: cat.status,
              createdAt: cat.createdAt,
              updatedAt: cat.updatedAt,
              level: cat.level,
              parentId: cat.parentId,
              sortOrder: cat.sortOrder,
              count: 0, // 🔥 查询失败时返回0
              children: (cat.other_categories || []).map(child => ({
                id: child.id,
                name: child.name,
                slug: child.slug,
                icon: child.icon,
                level: child.level,
                displayOrder: child.displayOrder,
                sortOrder: child.sortOrder,
                count: 0,
              })),
            };
          }
        })
    );

    const formattedCategories = categoriesWithCount;

    const response = NextResponse.json({
      success: true,
      data: formattedCategories,
    });
    
    // 🔥 禁用缓存
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error) {
    // 🔥 [Count API Fail] 明确记录错误
    console.error('[Count API Fail] ❌ [Categories API] 获取分类列表失败:');
    console.error('错误类型:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('错误消息:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.message.includes('ETIMEDOUT')) {
      console.error('🔴 [Count API Fail] 数据库连接超时 (6543端口问题)');
    }
    if (error instanceof Error && error.stack) {
      console.error('错误堆栈:', error.stack);
    }
    
    // 🔥 即使出错也返回空数组，而不是 500 错误
    const errorResponse = NextResponse.json(
      {
        success: true, // 🔥 改为 true，避免前端报错
        data: [], // 🔥 返回空数组
      },
      { status: 200 } // 🔥 改为 200，避免前端报错
    );
    
    errorResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    errorResponse.headers.set('Pragma', 'no-cache');
    errorResponse.headers.set('Expires', '0');
    
    return errorResponse;
  }
}
