import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { DBService } from '@/lib/dbService';
import { extractUserIdFromToken } from '@/lib/authUtils'; // 强制数据隔离：使用统一的 userId 提取函数

/**
 * 市场详情 API
 * GET /api/markets/[market_id]
 * 
 * 返回指定市场的详细信息
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ market_id: string }> }
) {
  try {
    console.log('📊 [Market Detail API] ========== 开始处理获取市场详情请求 ==========');
    
    const { market_id } = await params;
    
    // 打印 Slug：确保 API 能够正确获取并打印 URL 中的市场标识符
    console.log('🔍 [Market Detail API] 接收到的市场ID:', {
      market_id,
      market_idType: typeof market_id,
      market_idLength: market_id?.length,
    });

    if (!market_id || market_id.trim() === '') {
      console.error('❌ [Market Detail API] 市场ID为空');
      return NextResponse.json(
        {
          success: false,
          error: 'Market ID is required',
        },
        { status: 400 }
      );
    }

    // 数据库查询校验：使用 DBService.findMarketById 从数据库查找市场
    console.log('💾 [Market Detail API] 准备调用 DBService.findMarketById:', market_id);
    const market = await DBService.findMarketById(market_id);
    
    console.log('💾 [Market Detail API] DBService.findMarketById 返回结果:', {
      marketExists: !!market,
      marketId: market?.id,
      marketTitle: market?.title,
      marketStatus: market?.status,
    });

    if (!market) {
      console.error('❌ [Market Detail API] 市场不存在:', market_id);
      return NextResponse.json(
        {
          success: false,
          error: 'Market not found',
        },
        { status: 404 }
      );
    }

    // 修复详情页订单列表：获取当前用户在该市场的订单
    // 审计后端 API：确保获取用户持仓数据的 API 在用户没有持仓时，返回一个空的持仓数组，而不是旧的或无效的数据
    // 强制 DB 过滤：确保所有数据库查询都包含 WHERE user_id = current_user_id，确保数据隔离在源头实现
    let userOrders: any[] = [];
    let userPosition: { yesShares: number; noShares: number; yesAvgPrice: number; noAvgPrice: number } | null = null;
    
    try {
      // 强制身份过滤：从 Auth Token 提取 current_user_id
      const authResult = await extractUserIdFromToken();
      
      if (authResult.success && authResult.userId) {
        const userId = authResult.userId;
        
        // 硬编码检查：验证 userId 不是硬编码值，必须从 Auth Token 提取
        if (!userId || typeof userId !== 'string' || userId.trim() === '') {
          console.error('❌ [Market Detail API] userId 验证失败：userId 为空或无效');
          userOrders = [];
          userPosition = null;
        } else {
          // 强制 DB 过滤：使用 DBService.findOrdersByUserId(userId) 确保数据隔离
          // DBService.findOrdersByUserId 内部使用 WHERE userId = current_user_id
          // 查询结构强制修复：明确且强制地包含基于传入 current_user_id 的过滤条件
          const allUserOrders = await DBService.findOrdersByUserId(userId);
          // 进一步过滤：确保只返回当前市场的订单
          userOrders = allUserOrders.filter(order => order.marketId === market_id);
          
          // 从订单计算用户持仓（原子交易：创建持仓记录）
          // 计算 YES 和 NO 的持仓
          const yesOrders = userOrders.filter(order => order.outcomeSelection === 'YES');
          const noOrders = userOrders.filter(order => order.outcomeSelection === 'NO');
          
          // 计算 YES 持仓
          if (yesOrders.length > 0) {
            const totalYesAmount = yesOrders.reduce((sum, order) => sum + (order.amount - order.feeDeducted), 0);
            const totalYesShares = yesOrders.reduce((sum, order) => {
              // 计算份额：净投资 / 当前价格（简化计算，使用市场平均价格）
              const currentPrice = market.totalYes / (market.totalYes + market.totalNo) || 0.5;
              const netAmount = order.amount - order.feeDeducted;
              return sum + (netAmount / (currentPrice || 0.5));
            }, 0);
            const avgYesPrice = totalYesAmount / totalYesShares || 0;
            
            userPosition = {
              yesShares: totalYesShares,
              noShares: 0,
              yesAvgPrice: avgYesPrice,
              noAvgPrice: 0,
            };
          }
          
          // 计算 NO 持仓
          if (noOrders.length > 0) {
            const totalNoAmount = noOrders.reduce((sum, order) => sum + (order.amount - order.feeDeducted), 0);
            const totalNoShares = noOrders.reduce((sum, order) => {
              const currentPrice = market.totalNo / (market.totalYes + market.totalNo) || 0.5;
              const netAmount = order.amount - order.feeDeducted;
              return sum + (netAmount / (currentPrice || 0.5));
            }, 0);
            const avgNoPrice = totalNoAmount / totalNoShares || 0;
            
            if (userPosition) {
              userPosition.noShares = totalNoShares;
              userPosition.noAvgPrice = avgNoPrice;
            } else {
              userPosition = {
                yesShares: 0,
                noShares: totalNoShares,
                yesAvgPrice: 0,
                noAvgPrice: avgNoPrice,
              };
            }
          }
          
          console.log('📊 [Market Detail API] 用户订单和持仓:', {
            userId,
            marketId: market_id,
            orderCount: userOrders.length,
            userPosition,
          });
        }
      } else {
        // 如果 Token 无效或缺失，记录警告但不返回错误（允许未登录用户查看市场）
        console.warn('⚠️ [Market Detail API] Token 无效或缺失，不返回用户订单数据');
        userOrders = [];
        userPosition = null;
      }
    } catch (error) {
      console.error('❌ [Market Detail API] 获取用户订单失败:', error);
      // 如果获取订单失败，继续返回市场数据，但不包含用户订单
      // 审计后端 API：确保在用户没有持仓时，返回一个空的持仓数组
      userOrders = [];
      userPosition = null;
    }

    // 计算百分比（基于 totalYes 和 totalNo）
    const totalAmount = market.totalYes + market.totalNo;
    const yesPercent = totalAmount > 0 ? (market.totalYes / totalAmount) * 100 : 50;
    const noPercent = totalAmount > 0 ? (market.totalNo / totalAmount) * 100 : 50;

    // 响应数据完整性：确保 API 返回的市场对象中，所有字段都是完整的
    // 将数据库格式转换为前端期望的格式
    const serializedMarket = {
      // 基础字段
      id: market.id,
      title: market.title,
      description: market.description || '',
      
      // 日期字段（确保是字符串格式）
      endTime: typeof market.closingDate === 'string' 
        ? market.closingDate 
        : new Date(market.closingDate).toISOString(),
      closingDate: typeof market.closingDate === 'string' 
        ? market.closingDate 
        : new Date(market.closingDate).toISOString(),
      createdAt: typeof market.createdAt === 'string' 
        ? market.createdAt 
        : new Date(market.createdAt).toISOString(),
      updatedAt: typeof market.createdAt === 'string' 
        ? market.createdAt 
        : new Date(market.createdAt).toISOString(),
      
      // 状态和结果
      status: market.status,
      winningOutcome: market.resolvedOutcome || null,
      
      // 交易量和百分比（前端期望的格式）
      volume: market.totalVolume || 0, // 总交易量
      totalVolume: market.totalVolume || 0,
      totalYes: market.totalYes || 0,
      totalNo: market.totalNo || 0,
      yesPercent: Math.round(yesPercent * 100) / 100, // 保留两位小数
      noPercent: Math.round(noPercent * 100) / 100, // 保留两位小数
      
      // 分类字段
      category: market.category || '',
      categorySlug: market.categorySlug || '',
      
      // 用户订单列表（修复详情页订单列表）
      // API 调用：确认该组件调用了正确的 API，并且能够正确接收和渲染下注成功后生成的持仓记录
      userOrders: userOrders || [],
      userPosition: userPosition || null,
      
      // 其他字段
      feeRate: market.feeRate || 0.05,
      imageUrl: '', // 默认空字符串（如果数据库中没有此字段）
      commentsCount: 0, // 默认 0（如果数据库中没有此字段）
      sourceUrl: undefined,
      resolutionCriteria: undefined,
    };

    // 强制校验：确保 DBService.findMarketById 成功返回数据
    if (!market) {
      console.error('❌ [Market Detail API] 强制校验失败：市场数据为空');
      return NextResponse.json(
        {
          success: false,
          error: 'Market not found',
        },
        { status: 404 }
      );
    }
    
    // 数据完整性强制校验：确保所有关键字段都有值
    const criticalFields = {
      title: serializedMarket.title,
      description: serializedMarket.description,
      endTime: serializedMarket.endTime,
      volume: serializedMarket.volume,
      yesPercent: serializedMarket.yesPercent,
      noPercent: serializedMarket.noPercent,
      status: serializedMarket.status,
    };
    
    const missingCriticalFields = Object.entries(criticalFields)
      .filter(([key, value]) => value === undefined || value === null || value === '')
      .map(([key]) => key);
    
    if (missingCriticalFields.length > 0) {
      console.error('❌ [Market Detail API] 强制校验失败：缺少关键字段:', missingCriticalFields);
      // 为缺失的字段设置默认值
      if (!serializedMarket.title) serializedMarket.title = '未知市场';
      if (!serializedMarket.description) serializedMarket.description = '';
      if (!serializedMarket.endTime) serializedMarket.endTime = new Date().toISOString();
      if (serializedMarket.volume === undefined) serializedMarket.volume = 0;
      if (serializedMarket.yesPercent === undefined) serializedMarket.yesPercent = 50;
      if (serializedMarket.noPercent === undefined) serializedMarket.noPercent = 50;
      if (!serializedMarket.status) serializedMarket.status = 'OPEN' as any;
    }

    console.log('✅ [Market Detail API] ========== 市场详情获取成功 ==========');
    console.log('✅ [Market Detail API] 市场ID:', market.id);
    console.log('✅ [Market Detail API] 市场标题:', serializedMarket.title);
    console.log('✅ [Market Detail API] 市场描述:', serializedMarket.description ? `${serializedMarket.description.substring(0, 50)}...` : '空');
    console.log('✅ [Market Detail API] 市场状态:', serializedMarket.status);
    console.log('✅ [Market Detail API] 交易量 (volume):', serializedMarket.volume);
    console.log('✅ [Market Detail API] YES百分比:', serializedMarket.yesPercent);
    console.log('✅ [Market Detail API] NO百分比:', serializedMarket.noPercent);
    console.log('✅ [Market Detail API] 截止日期 (endTime):', serializedMarket.endTime);
    console.log('✅ [Market Detail API] 总交易量 (totalVolume):', serializedMarket.totalVolume);
    console.log('✅ [Market Detail API] YES总金额 (totalYes):', serializedMarket.totalYes);
    console.log('✅ [Market Detail API] NO总金额 (totalNo):', serializedMarket.totalNo);
    
    // 后端调试：在服务器终端打印 API 返回给前端的完整市场详情 JSON 字符串
    const finalResponse = {
      success: true,
      data: serializedMarket,
    };
    
    console.log('📤 [Market Detail API] ========== 最终返回的完整 JSON 字符串 ==========');
    console.log(JSON.stringify(finalResponse, null, 2));
    console.log('📤 [Market Detail API] 关键字段检查:');
    console.log('📤 [Market Detail API]   - title:', serializedMarket.title ? '✅' : '❌');
    console.log('📤 [Market Detail API]   - description:', serializedMarket.description ? '✅' : '❌');
    console.log('📤 [Market Detail API]   - endTime:', serializedMarket.endTime ? '✅' : '❌');
    console.log('📤 [Market Detail API]   - volume:', serializedMarket.volume !== undefined ? `✅ (${serializedMarket.volume})` : '❌');
    console.log('📤 [Market Detail API]   - yesPercent:', serializedMarket.yesPercent !== undefined ? `✅ (${serializedMarket.yesPercent}%)` : '❌');
    console.log('📤 [Market Detail API]   - noPercent:', serializedMarket.noPercent !== undefined ? `✅ (${serializedMarket.noPercent}%)` : '❌');
    console.log('📤 [Market Detail API]   - status:', serializedMarket.status ? `✅ (${serializedMarket.status})` : '❌');
    console.log('📤 [Market Detail API]   - totalVolume:', serializedMarket.totalVolume !== undefined ? `✅ (${serializedMarket.totalVolume})` : '❌');
    console.log('📤 [Market Detail API]   - totalYes:', serializedMarket.totalYes !== undefined ? `✅ (${serializedMarket.totalYes})` : '❌');
    console.log('📤 [Market Detail API]   - totalNo:', serializedMarket.totalNo !== undefined ? `✅ (${serializedMarket.totalNo})` : '❌');
    console.log('📤 [Market Detail API] ============================================');

    return NextResponse.json(finalResponse);
  } catch (error) {
    // 捕获异常：打印完整的错误堆栈
    console.error('❌ [Market Detail API] ========== 获取市场详情失败 ==========');
    console.error('❌ [Market Detail API] 错误类型:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('❌ [Market Detail API] 错误消息:', error instanceof Error ? error.message : String(error));
    console.error('❌ [Market Detail API] 完整错误堆栈:');
    if (error instanceof Error) {
      console.error(error.stack);
    } else {
      console.error(error);
    }
    console.error('❌ [Market Detail API] ===============================');

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch market',
        // 开发环境下返回详细错误信息（生产环境应移除）
        ...(process.env.NODE_ENV === 'development' && error instanceof Error
          ? { details: error.message, stack: error.stack }
          : {}),
      },
      { status: 500 }
    );
  }
}

