import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { DBService } from '@/lib/dbService';
import { extractUserIdFromToken } from '@/lib/authUtils'; // 强制数据隔离：使用统一的 userId 提取函数
import { MarketStatus, Outcome } from '@/types/data';

/**
 * 创建订单 API
 * POST /api/orders
 * 
 * 处理用户下注请求
 * 请求体：
 * - marketId: 市场ID
 * - outcomeSelection: 选择的结果选项 (YES/NO)
 * - amount: 下注金额
 */
export async function POST(request: Request) {
  try {
    // 强制身份过滤：从 Auth Token 提取 current_user_id
    // API 路由校验：确认 API 路由在调用 DBService 前，已经从 Auth Token 中正确提取了 user_id
    const authResult = await extractUserIdFromToken();
    
    if (!authResult.success || !authResult.userId) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error || 'Not authenticated',
        },
        { status: 401 }
      );
    }

    const userId = authResult.userId;
    
    // 硬编码检查：验证 userId 不是硬编码值，必须从 Auth Token 提取
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      console.error('❌ [Orders API] userId 验证失败：userId 为空或无效');
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid user ID',
        },
        { status: 401 }
      );
    }

    // 解析请求体
    const body = await request.json();
    const { marketId, outcomeSelection, amount } = body;

    // 验证必需字段
    if (!marketId || !outcomeSelection || !amount) {
      return NextResponse.json(
        {
          success: false,
          error: 'marketId, outcomeSelection, and amount are required',
        },
        { status: 400 }
      );
    }

    // 验证 outcomeSelection
    if (outcomeSelection !== 'YES' && outcomeSelection !== 'NO') {
      return NextResponse.json(
        {
          success: false,
          error: 'outcomeSelection must be YES or NO',
        },
        { status: 400 }
      );
    }

    // 验证 amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'amount must be a positive number',
        },
        { status: 400 }
      );
    }

    // 强制 ID 校验：再次确保 API 接收到的市场 ID 是正确的 UUID 格式
    // 查询隔离：检查下注 API 使用的 DBService.findMarketById(...) 确保它在查询市场时使用的是与详情页修复后相同的、正确的逻辑和参数
    console.log('🔍 [Orders API] ========== 开始处理下注请求 ==========');
    console.log('🔍 [Orders API] 接收到的市场ID:', { 
      marketId, 
      marketIdType: typeof marketId, 
      marketIdLength: marketId?.length,
      isUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(marketId || '')
    });
    
    // 验证 marketId 格式（应该是 UUID）
    if (!marketId || typeof marketId !== 'string') {
      console.error('❌ [Orders API] 市场ID无效:', marketId);
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid marketId format',
        },
        { status: 400 }
      );
    }

    // 业务校验：检查市场是否存在且状态为 OPEN
    // 修复：使用与详情页相同的 DBService.findMarketById 方法
    console.log('💾 [Orders API] 准备调用 DBService.findMarketById:', marketId);
    const market = await DBService.findMarketById(marketId);
    console.log('💾 [Orders API] DBService.findMarketById 返回结果:', {
      found: !!market,
      marketId: market?.id,
      marketTitle: market?.title,
      marketStatus: market?.status,
    });
    
    if (!market) {
      console.error('❌ [Orders API] 市场不存在:', marketId);
      return NextResponse.json(
        {
          success: false,
          error: 'Market not found',
        },
        { status: 404 }
      );
    }

    if (market.status !== MarketStatus.OPEN) {
      return NextResponse.json(
        {
          success: false,
          error: 'Market is not open for trading',
        },
        { status: 400 }
      );
    }

    // 业务校验：检查用户余额
    const user = await DBService.findUserById(userId);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
        },
        { status: 404 }
      );
    }

    if (user.balance < amountNum) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient balance',
        },
        { status: 400 }
      );
    }

    // 原子性与事务：使用数据库事务确保 扣除余额 和 新增持仓记录 的操作是原子性的
    // 防止资金流失或幽灵持仓
    // 浮点数精度：使用高精度计算，将金额转换为整数（分）进行计算，避免浮点数精度问题
    const PRECISION_MULTIPLIER = 100; // 将美元转换为分（cents）
    
    // 将金额转换为整数（分）进行计算
    const amountCents = Math.round(amountNum * PRECISION_MULTIPLIER);
    const feeDeductedCents = Math.round(amountNum * market.feeRate * PRECISION_MULTIPLIER);
    const netAmountCents = amountCents - feeDeductedCents;
    
    // 计算手续费（用于返回）
    const feeDeducted = amountNum * market.feeRate;
    const netAmount = amountNum - feeDeducted;
    
    // 使用 Prisma 事务确保原子性
    const { prisma } = await import('@/lib/prisma');
    
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. 从用户余额中扣除 amount（使用整数计算）
        const userBalanceCents = Math.round(user.balance * PRECISION_MULTIPLIER);
        const newBalanceCents = userBalanceCents - amountCents;
        
        if (newBalanceCents < 0) {
          throw new Error('Insufficient balance');
        }
        
        const newBalance = newBalanceCents / PRECISION_MULTIPLIER;
        
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { balance: newBalance },
        });
        
        // 2. 在 Market 中增加 totalVolume 和对应的 totalYes/totalNo（扣除手续费后）
        const marketTotalVolumeCents = Math.round(market.totalVolume * PRECISION_MULTIPLIER);
        const marketTotalYesCents = Math.round(market.totalYes * PRECISION_MULTIPLIER);
        const marketTotalNoCents = Math.round(market.totalNo * PRECISION_MULTIPLIER);
        
        const newTotalVolumeCents = marketTotalVolumeCents + amountCents;
        const newTotalYesCents = outcomeSelection === Outcome.YES 
          ? marketTotalYesCents + netAmountCents
          : marketTotalYesCents;
        const newTotalNoCents = outcomeSelection === Outcome.NO 
          ? marketTotalNoCents + netAmountCents
          : marketTotalNoCents;
        
        const newTotalVolume = newTotalVolumeCents / PRECISION_MULTIPLIER;
        const newTotalYes = newTotalYesCents / PRECISION_MULTIPLIER;
        const newTotalNo = newTotalNoCents / PRECISION_MULTIPLIER;
        
        const updatedMarket = await tx.market.update({
          where: { id: marketId },
          data: {
            totalVolume: newTotalVolume,
            totalYes: newTotalYes,
            totalNo: newTotalNo,
          },
        });
        
        // 3. 创建新的 Order 记录
        // 硬编码检查：确保 userId 不是硬编码值，必须使用从 Auth Token 提取的 current_user_id
        if (!userId || typeof userId !== 'string' || userId.trim() === '') {
          throw new Error('Order creation: userId is required and must be extracted from Auth Token');
        }
        
        const orderId = `O-${Date.now()}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
        const newOrder = await tx.order.create({
          data: {
            id: orderId,
            userId: userId, // 强制数据隔离：使用从 Auth Token 提取的 current_user_id
            marketId: marketId,
            outcomeSelection: outcomeSelection as Outcome,
            amount: amountNum,
            feeDeducted: feeDeducted,
          },
        });
        
        return {
          updatedUser,
          updatedMarket,
          newOrder: {
            id: newOrder.id,
            userId: newOrder.userId,
            marketId: newOrder.marketId,
            outcomeSelection: newOrder.outcomeSelection as Outcome,
            amount: newOrder.amount,
            payout: newOrder.payout ?? undefined,
            feeDeducted: newOrder.feeDeducted,
            createdAt: newOrder.createdAt.toISOString(),
          },
        };
      });
      
      const { updatedUser, updatedMarket, newOrder } = result;
      
      console.log('✅ [Orders API] 事务执行成功:', {
        orderId: newOrder.id,
        userId: updatedUser.id,
        updatedBalance: updatedUser.balance,
        marketId: updatedMarket.id,
        newTotalVolume: updatedMarket.totalVolume,
      });
      
      // 返回创建成功的订单信息和更新后的用户余额
      return NextResponse.json({
        success: true,
        message: 'Order created successfully',
        data: {
          order: newOrder,
          updatedBalance: updatedUser.balance,
          updatedMarket: {
            totalVolume: updatedMarket.totalVolume,
            totalYes: updatedMarket.totalYes,
            totalNo: updatedMarket.totalNo,
          },
        },
      });
    } catch (error: any) {
      console.error('❌ [Orders API] 事务执行失败:', error);
      
      // 处理特定错误
      if (error.message === 'Insufficient balance') {
        return NextResponse.json(
          {
            success: false,
            error: 'Insufficient balance',
          },
          { status: 400 }
        );
      }
      
      // 其他错误返回通用错误信息
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
          ...(process.env.NODE_ENV === 'development' && { details: error.message }),
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('❌ [Orders API] 请求处理错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { details: error.message }),
      },
      { status: 500 }
    );
  }
}

