import { NextResponse } from 'next/server';
import { DBService } from '@/lib/mockData';
import { MarketStatus, Outcome } from '@/types/data';
import { verifyAdminToken, createUnauthorizedResponse } from '@/lib/adminAuth';
import { executeSettlement } from '@/lib/factory/settlement';

/**
 * 管理后台 - 市场清算 API
 * POST /api/admin/markets/[market_id]/settle
 * 
 * 🔥 重构：统一调用核心结算函数 executeSettlement，确保逻辑一致
 * 
 * 请求体（可选）：
 * {
 *   finalOutcome: "YES" | "NO";  // 可选：手动市场的结算结果（工厂市场会自动判定）
 * }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ market_id: string }> }
) {
  try {
    // 权限校验：使用统一的 Admin Token 验证函数（从 Cookie 读取）
    const authResult = await verifyAdminToken(request);

    if (!authResult.success) {
      return createUnauthorizedResponse(
        authResult.error || 'Unauthorized. Admin access required.',
        authResult.statusCode || 401
      );
    }

    const { market_id } = await params;

    // 解析请求体（finalOutcome 是可选的）
    const body = await request.json().catch(() => ({}));
    const { finalOutcome } = body;

    // 验证 finalOutcome（如果提供了）
    if (finalOutcome && finalOutcome !== 'YES' && finalOutcome !== 'NO') {
      return NextResponse.json(
        {
          success: false,
          error: 'finalOutcome must be YES or NO',
        },
        { status: 400 }
      );
    }

    // 获取市场信息（用于验证和返回）
    const market = await DBService.findMarketById(market_id);
    if (!market) {
      return NextResponse.json(
        {
          success: false,
          error: 'Market not found',
        },
        { status: 404 }
      );
    }

    const isFactoryMarket = (market as any).isFactory === true;

    // 对于手动市场，如果未提供 finalOutcome，返回错误
    if (!isFactoryMarket && !finalOutcome) {
      return NextResponse.json(
        {
          success: false,
          error: '手动市场必须提供 finalOutcome (YES 或 NO)',
        },
        { status: 400 }
      );
    }

    // 检查市场状态（手动市场必须已关闭）
    if (!isFactoryMarket && market.status !== MarketStatus.CLOSED) {
      return NextResponse.json(
        {
          success: false,
          error: `手动市场必须先关闭才能结算。当前状态: ${market.status}`,
        },
        { status: 400 }
      );
    }

    // 🔥 调用统一的核心结算函数
    const result = await executeSettlement(
      market_id,
      finalOutcome as Outcome | 'YES' | 'NO' | undefined
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || '结算失败',
        },
        { status: 500 }
      );
    }

    // 返回清算成功的市场信息和统计信息
    return NextResponse.json({
      success: true,
      message: 'Market settled successfully',
      data: {
        market: {
          id: market.id,
          title: market.title,
          resolvedOutcome: result.outcome,
          status: MarketStatus.RESOLVED,
        },
        statistics: result.statistics || {
          totalOrders: 0,
          winningOrders: 0,
          totalPayout: 0,
          affectedUsers: 0,
        },
      },
    });
  } catch (error: any) {
    console.error('Market settle API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
