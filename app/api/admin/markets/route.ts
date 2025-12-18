import { NextRequest, NextResponse } from 'next/server';
import { DBService } from '@/lib/mockData';
import { Market, MarketStatus, Outcome } from '@/types/data';
import { verifyAdminAuth, createUnauthorizedResponse } from '@/lib/adminAuth';
import { CATEGORY_SLUG_MAP } from '@/lib/categories';

/**
 * 管理后台 - 获取市场列表 API
 * GET /api/admin/markets
 * 
 * 查询参数：
 * - search?: string      // 搜索关键词（市场ID或标题）
 * - status?: string       // 状态筛选（open, closed, pending, resolved）
 * - page?: number         // 页码（默认 1）
 * - limit?: number        // 每页数量（默认 10）
 */
export async function GET(request: NextRequest) {
  try {
    // 权限校验：使用统一的 Admin Token 验证函数（从 Cookie 读取）
    const authResult = await verifyAdminAuth(request);

    if (!authResult.success) {
      return createUnauthorizedResponse(
        authResult.error || 'Unauthorized. Admin access required.',
        authResult.statusCode || 401
      );
    }

    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const statusFilter = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // 使用 DBService 获取所有市场（返回 types/data.ts 中的 Market 类型）
    let filteredMarkets = await DBService.getAllMarkets();

    // 搜索过滤（按ID或标题）
    if (search.trim()) {
      const searchLower = search.toLowerCase().trim();
      filteredMarkets = filteredMarkets.filter((market) => {
        return (
          market.id.toLowerCase().includes(searchLower) ||
          market.title.toLowerCase().includes(searchLower)
        );
      });
    }

    // 状态过滤（使用 types/data.ts 中的 MarketStatus 枚举）
    if (statusFilter) {
      const statusMap: Record<string, MarketStatus> = {
        open: MarketStatus.OPEN,
        closed: MarketStatus.CLOSED,
        resolved: MarketStatus.RESOLVED,
        canceled: MarketStatus.CANCELED,
      };
      const targetStatus = statusMap[statusFilter.toLowerCase()];
      if (targetStatus) {
        filteredMarkets = filteredMarkets.filter((market) => market.status === targetStatus);
      }
    }

    // 计算分页
    const total = filteredMarkets.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedMarkets = filteredMarkets.slice(startIndex, endIndex);

    return NextResponse.json({
      success: true,
      data: paginatedMarkets,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Admin markets list API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * 管理后台 - 创建市场 API
 * POST /api/admin/markets
 * 
 * 请求体：
 * {
 *   title: string;              // 市场标题
 *   description?: string;        // 市场描述
 *   category: string;            // 分类（中文名称，如 "加密货币"）
 *   endTime: string;             // 截止日期 (ISO 8601 格式)
 *   imageUrl?: string;           // 图片 URL（可选）
 *   sourceUrl?: string;          // 信息来源链接（可选）
 *   resolutionCriteria?: string; // 结算规则说明（可选）
 * }
 */
export async function POST(request: Request) {
  try {
    console.log('🏗️ [Market API] ========== 开始处理创建市场请求 ==========');
    
    // 权限校验：使用统一的 Admin Token 验证函数（从 Cookie 读取）
    console.log('🔍 [Market API] 开始验证 Admin Token...');
    const authResult = await verifyAdminAuth(request);

    if (!authResult.success) {
      console.error('❌ [Market API] Admin Token 验证失败:', authResult.error);
      return createUnauthorizedResponse(
        authResult.error || 'Unauthorized. Admin access required.',
        authResult.statusCode || 401
      );
    }

    console.log('✅ [Market API] Admin Token 验证成功，用户ID:', authResult.userId);

    // 解析请求体
    console.log('📥 [Market API] 开始解析请求体...');
    const body = await request.json();
    const {
      title,
      description,
      category,
      endTime,
      imageUrl,
      sourceUrl,
      resolutionCriteria,
      feeRate, // 接收手续费率参数
    } = body;

    // 数据验证调试：打印接收到的市场数据
    console.log('📊 [Market API] 接收到的市场数据:', {
      title: title,
      titleType: typeof title,
      description: description,
      descriptionType: typeof description,
      category: category,
      categoryType: typeof category,
      endTime: endTime,
      endTimeType: typeof endTime,
      feeRate: feeRate,
      feeRateType: typeof feeRate,
      imageUrl: imageUrl,
      sourceUrl: sourceUrl,
      resolutionCriteria: resolutionCriteria,
    });

    // 验证必需字段
    if (!title || !category || !endTime) {
      console.error('❌ [Market API] 缺少必需字段:', {
        hasTitle: !!title,
        hasCategory: !!category,
        hasEndTime: !!endTime,
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: title, category, and endTime are required',
        },
        { status: 400 }
      );
    }

    // 验证分类是否有效
    console.log('🔍 [Market API] 验证分类:', { category, availableCategories: Object.keys(CATEGORY_SLUG_MAP) });
    const categorySlug = CATEGORY_SLUG_MAP[category];
    if (!categorySlug) {
      console.error('❌ [Market API] 无效的分类:', category);
      return NextResponse.json(
        {
          success: false,
          error: `Invalid category. Valid categories are: ${Object.keys(CATEGORY_SLUG_MAP).join(', ')}`,
        },
        { status: 400 }
      );
    }
    console.log('✅ [Market API] 分类验证通过:', { category, categorySlug });

    // 验证日期格式
    console.log('🔍 [Market API] 验证日期格式:', { endTime });
    const endDate = new Date(endTime);
    if (isNaN(endDate.getTime())) {
      console.error('❌ [Market API] 无效的日期格式:', endTime);
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid endTime format. Please use ISO 8601 format (e.g., "2024-12-31T23:59:59Z")',
        },
        { status: 400 }
      );
    }

    // 验证日期不能是过去
    const nowTimestamp = Date.now();
    const endTimestamp = endDate.getTime();
    console.log('🔍 [Market API] 验证日期范围:', {
      endTime: endTime,
      endTimestamp,
      nowTimestamp,
      isPast: endTimestamp < nowTimestamp,
    });
    if (endTimestamp < nowTimestamp) {
      console.error('❌ [Market API] 截止日期不能是过去:', { endTime, endTimestamp, nowTimestamp });
      return NextResponse.json(
        {
          success: false,
          error: 'endTime cannot be in the past',
        },
        { status: 400 }
      );
    }
    console.log('✅ [Market API] 日期验证通过');

    // 生成新的市场 ID
    const newMarketId = `M-${Date.now()}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
    const now = new Date().toISOString();
    console.log('🆔 [Market API] 生成市场ID:', newMarketId);

    // 创建新市场对象（使用 types/data.ts 中的 Market 类型）
    const parsedFeeRate = feeRate !== undefined ? parseFloat(feeRate) : 0.05;
    console.log('📝 [Market API] 准备创建市场对象:', {
      id: newMarketId,
      title: title.trim(),
      description: description?.trim() || '',
      closingDate: endTime,
      status: MarketStatus.OPEN,
      feeRate: parsedFeeRate,
    });

    const newMarket: Market = {
      id: newMarketId,
      title: title.trim(),
      description: description?.trim() || '',
      closingDate: endTime,
      resolvedOutcome: undefined, // 新市场未结算
      status: MarketStatus.OPEN,
      totalVolume: 0, // 初始交易量为 0
      totalYes: 0, // 初始 YES 金额为 0
      totalNo: 0, // 初始 NO 金额为 0
      feeRate: parsedFeeRate, // 使用传入的费率，默认为 5%
      category: category, // 分类（中文名称）
      categorySlug: categorySlug, // 分类 slug
      createdAt: now,
    };

    // 数据库事务调试：在调用 DBService.addMarket 之前添加日志
    console.log('💾 [Market API] ========== 准备创建市场记录 ==========');
    console.log('💾 [Market API] 准备调用 DBService.addMarket:', {
      marketId: newMarket.id,
      title: newMarket.title,
      closingDate: newMarket.closingDate,
      status: newMarket.status,
      feeRate: newMarket.feeRate,
      category: category,
      categorySlug: categorySlug,
    });

    // 使用 DBService 添加新市场（传递 category 信息）
    const createdMarket = await DBService.addMarket(newMarket, {
      category: category,
      categorySlug: categorySlug,
    });

    // 数据库事务调试：在调用 DBService.addMarket 之后添加日志
    console.log('✅ [Market API] 市场记录创建成功');
    console.log('💾 [Market API] DBService.addMarket 返回结果:', {
      success: !!createdMarket,
      marketId: createdMarket?.id,
      title: createdMarket?.title,
      status: createdMarket?.status,
    });

    // 强制打印成功日志
    console.log('✅ [Market API] ========== 市场创建成功 ==========');
    console.log('✅ [Market API] 市场ID:', newMarketId);
    console.log('✅ [Market API] 市场标题:', newMarket.title);
    console.log('✅ [Market API] 截止日期:', newMarket.closingDate);
    console.log('✅ [Market API] 手续费率:', newMarket.feeRate);
    console.log('✅ [Market API] ===============================');

    return NextResponse.json({
      success: true,
      message: 'Market created successfully.',
      marketId: newMarketId,
      data: createdMarket || newMarket,
    });
  } catch (error) {
    // 捕获异常：打印完整的错误堆栈
    console.error('❌ [Market API] ========== 市场创建失败 ==========');
    console.error('❌ [Market API] 错误类型:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('❌ [Market API] 错误消息:', error instanceof Error ? error.message : String(error));
    console.error('❌ [Market API] 完整错误堆栈:');
    if (error instanceof Error) {
      console.error(error.stack);
    } else {
      console.error(error);
    }
    console.error('❌ [Market API] ===============================');

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        // 开发环境下返回详细错误信息（生产环境应移除）
        ...(process.env.NODE_ENV === 'development' && error instanceof Error
          ? { details: error.message, stack: error.stack }
          : {}),
      },
      { status: 500 }
    );
  }
}

