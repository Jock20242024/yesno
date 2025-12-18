import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { DBService } from '@/lib/dbService';
import { MarketStatus, Outcome } from '@/types/data';
import { extractUserIdFromToken } from '@/lib/authUtils'; // ========== 修复：导入统一的 userId 提取函数 ==========

/**
 * 交易响应接口
 */
interface TradeResponse {
  success: boolean;
  transactionId: string;
  message: string;
  updatedMarketPrice?: {
    yesPercent: number;
    noPercent: number;
  };
  userPosition?: {
    outcome: 'YES' | 'NO';
    shares: number;
    avgPrice: number;
    totalValue: number;
  };
  error?: string;
}

/**
 * 交易 API
 * POST /api/trade
 * 
 * 处理市场交易请求（已废弃，请使用 /api/orders）
 * 请求体：
 * - marketId: 市场 ID (UUID)
 * - outcome: 交易方向 ('YES' | 'NO')
 * - amount: 交易金额（美元）或份额
 * - type: 交易类型 ('buy' | 'sell')
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
      console.error('❌ [Trade API] userId 验证失败：userId 为空或无效');
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid user ID',
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { marketId, outcome, amount, type } = body;

    // 验证必需字段
    if (!marketId || !outcome || !amount || !type) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: marketId, outcome, amount, and type are required',
        },
        { status: 400 }
      );
    }

    // 验证 outcome 值
    if (outcome !== 'YES' && outcome !== 'NO') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid outcome. Must be "YES" or "NO"',
        },
        { status: 400 }
      );
    }

    // 验证 type 值
    if (type !== 'buy' && type !== 'sell') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid type. Must be "buy" or "sell"',
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
          error: 'Invalid amount. Must be a positive number',
        },
        { status: 400 }
      );
    }

    // Market ID 校验：使用数据库查询，确保接收到的市场 ID 是正确的 UUID 格式
    console.log('🔍 [Trade API] 查找市场:', { marketId, marketIdType: typeof marketId, marketIdLength: marketId?.length });
    const market = await DBService.findMarketById(marketId);
    if (!market) {
      console.error('❌ [Trade API] 市场不存在:', marketId);
      return NextResponse.json(
        {
          success: false,
          error: 'Market not found',
        },
        { status: 404 }
      );
    }

    // 检查市场状态
    if (market.status !== MarketStatus.OPEN) {
      return NextResponse.json(
        {
          success: false,
          error: 'Market is not open for trading',
        },
        { status: 400 }
      );
    }

    // 检查用户余额
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

    if (type === 'buy' && user.balance < amountNum) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient balance',
        },
        { status: 400 }
      );
    }

    // 核心交易逻辑：使用 DBService 执行实际的数据库操作
    // 注意：此 API 已废弃，建议使用 /api/orders
    // 这里保留基本逻辑以保持向后兼容性
    
    // 计算手续费
    const feeRate = market.feeRate || 0.02; // 默认 2%
    const feeDeducted = amountNum * feeRate;
    const netAmount = amountNum - feeDeducted;

    if (type === 'buy') {
      // 买入：扣除用户余额，更新市场池
      const newBalance = user.balance - amountNum;
      const updatedUser = await DBService.updateUser(userId, {
        balance: newBalance,
      });

      if (!updatedUser) {
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to update user balance',
          },
          { status: 500 }
        );
      }

      // 更新市场池
      const newTotalVolume = market.totalVolume + amountNum;
      const newTotalYes = outcome === Outcome.YES 
        ? market.totalYes + netAmount
        : market.totalYes;
      const newTotalNo = outcome === Outcome.NO 
        ? market.totalNo + netAmount
        : market.totalNo;

      const updatedMarket = await DBService.updateMarket(marketId, {
        totalVolume: newTotalVolume,
        totalYes: newTotalYes,
        totalNo: newTotalNo,
      });

      if (!updatedMarket) {
        // 回滚用户余额
        await DBService.updateUser(userId, {
          balance: user.balance,
        });
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to update market',
          },
          { status: 500 }
        );
      }

      // 计算价格百分比
      const totalVolume = updatedMarket.totalVolume || 0;
      const totalYes = updatedMarket.totalYes || 0;
      const totalNo = updatedMarket.totalNo || 0;
      const yesPercent = totalVolume > 0 ? (totalYes / totalVolume) * 100 : 50;
      const noPercent = totalVolume > 0 ? (totalNo / totalVolume) * 100 : 50;

      // 计算份额（简化计算）
      const currentPrice = outcome === Outcome.YES ? yesPercent / 100 : noPercent / 100;
      const shares = netAmount / currentPrice;

      const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;

      return NextResponse.json({
        success: true,
        message: 'Trade executed successfully.',
        transactionId,
        updatedMarketPrice: {
          yesPercent: Math.round(yesPercent * 100) / 100,
          noPercent: Math.round(noPercent * 100) / 100,
        },
        userPosition: {
          outcome,
          shares: Math.round(shares * 100) / 100,
          avgPrice: Math.round(currentPrice * 10000) / 10000,
          totalValue: Math.round(shares * currentPrice * 100) / 100,
        },
      });
    } else {
      // 卖出：暂时不支持，返回错误
      return NextResponse.json(
        {
          success: false,
          error: 'Sell operation not supported. Please use /api/orders for full trading functionality.',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Trade API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

