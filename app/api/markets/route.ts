import { NextResponse } from 'next/server';
import { DBService } from '@/lib/mockData';
import { MarketStatus } from '@/types/data';

/**
 * 市场列表 API
 * GET /api/markets
 * 
 * 返回所有市场的列表
 * 支持查询参数：
 * - category: 分类筛选
 * - status: 状态筛选 (OPEN, RESOLVED, CLOSED)
 * - search: 搜索关键词
 * - page: 页码
 * - pageSize: 每页数量
 */
export async function GET(request: Request) {
  try {
    console.log('📊 [Markets API] ========== 开始处理获取市场列表请求 ==========');
    
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const status = searchParams.get('status') as 'OPEN' | 'RESOLVED' | 'CLOSED' | null;
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    console.log('📊 [Markets API] 查询参数:', {
      category,
      status,
      search,
      page,
      pageSize,
    });

    // 数据库调试：从数据库获取市场（支持分类筛选）
    console.log('💾 [Markets API] 准备调用 DBService.getAllMarkets()...');
    console.log('🔍 [Markets API] 筛选参数:', {
      category,
      categoryType: typeof category,
      willFilterByCategory: !!category,
    });
    
    // 如果提供了 category 参数，在数据库层面进行筛选
    let filteredMarkets = await DBService.getAllMarkets(category || undefined);
    
    console.log('✅ [Markets API] DBService.getAllMarkets() 返回结果:', {
      totalMarkets: filteredMarkets.length,
      firstMarketId: filteredMarkets[0]?.id,
      firstMarketTitle: filteredMarkets[0]?.title,
      firstMarketCategory: filteredMarkets[0]?.category,
      firstMarketCategorySlug: filteredMarkets[0]?.categorySlug,
    });

    // 状态筛选
    if (status) {
      const statusMap: Record<string, MarketStatus> = {
        OPEN: MarketStatus.OPEN,
        RESOLVED: MarketStatus.RESOLVED,
        CLOSED: MarketStatus.CLOSED,
        CANCELED: MarketStatus.CANCELED,
      };
      const targetStatus = statusMap[status];
      if (targetStatus) {
        filteredMarkets = filteredMarkets.filter(
          (market) => market.status === targetStatus
        );
      }
    }

    // 搜索过滤
    if (search) {
      const searchLower = search.toLowerCase();
      filteredMarkets = filteredMarkets.filter(
        (market) => market.title.toLowerCase().includes(searchLower) ||
                    market.description.toLowerCase().includes(searchLower)
      );
    }

    // 分页处理
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedMarkets = filteredMarkets.slice(startIndex, endIndex);

    // 序列化调试：确保所有字段都能被正确序列化
    console.log('📊 [Markets API] 准备返回数据:', {
      totalMarkets: filteredMarkets.length,
      paginatedCount: paginatedMarkets.length,
      page,
      pageSize,
      totalPages: Math.ceil(filteredMarkets.length / pageSize),
    });

    // 确保所有日期字段都是字符串格式（ISO 8601），并包含所有字段
    const serializedMarkets = paginatedMarkets.map((market) => ({
      ...market,
      closingDate: typeof market.closingDate === 'string' 
        ? market.closingDate 
        : new Date(market.closingDate).toISOString(),
      createdAt: typeof market.createdAt === 'string' 
        ? market.createdAt 
        : new Date(market.createdAt).toISOString(),
      category: market.category || undefined,
      categorySlug: market.categorySlug || undefined,
    }));

    console.log('✅ [Markets API] ========== 市场列表获取成功 ==========');

    return NextResponse.json({
      success: true,
      data: serializedMarkets,
      pagination: {
        total: filteredMarkets.length,
        page,
        pageSize,
        totalPages: Math.ceil(filteredMarkets.length / pageSize),
      },
    });
  } catch (error) {
    // 捕获异常：打印完整的错误堆栈
    console.error('❌ [Markets API] ========== 获取市场列表失败 ==========');
    console.error('❌ [Markets API] 错误类型:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('❌ [Markets API] 错误消息:', error instanceof Error ? error.message : String(error));
    console.error('❌ [Markets API] 完整错误堆栈:');
    if (error instanceof Error) {
      console.error(error.stack);
    } else {
      console.error(error);
    }
    console.error('❌ [Markets API] ===============================');

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch markets',
        // 开发环境下返回详细错误信息（生产环境应移除）
        ...(process.env.NODE_ENV === 'development' && error instanceof Error
          ? { details: error.message, stack: error.stack }
          : {}),
      },
      { status: 500 }
    );
  }
}

