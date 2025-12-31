import { NextResponse } from 'next/server';
import { DBService } from '@/lib/dbService'; // 🔥 修复：使用正确的 dbService 而不是 mockData
import { MarketStatus, Outcome } from '@/types/data';
import { auth } from "@/lib/authExport";

/**
 * 管理后台 - 市场结算 API
 * POST /api/admin/resolve/[market_id]
 * 
 * 🔥 修复：统一使用 NextAuth 进行权限验证
 * 
 * 请求体：
 * {
 *   resolutionOutcome: "YES" | "NO" | "Invalid";  // 结算结果
 * }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ market_id: string }> }
) {
  try {
    // 🔥 修复：统一使用 NextAuth 进行权限验证（与其他 Admin API 保持一致）
    const session = await auth();
    
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }
    
    const userRole = (session.user as any).role;
    const userEmail = session.user.email;
    const adminEmail = 'yesno@yesno.com';
    
    if (userRole !== 'ADMIN' && userEmail !== adminEmail) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const { market_id } = await params;
    const body = await request.json();
    const { resolutionOutcome } = body;

    // 验证必需字段
    if (!resolutionOutcome) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: resolutionOutcome is required',
        },
        { status: 400 }
      );
    }

    // 验证结算结果值
    if (resolutionOutcome !== 'YES' && resolutionOutcome !== 'NO' && resolutionOutcome !== 'Invalid') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid resolutionOutcome. Must be "YES", "NO", or "Invalid"',
        },
        { status: 400 }
      );
    }

    // 查找市场
    const existingMarket = await DBService.findMarketById(market_id);
    
    if (!existingMarket) {
      return NextResponse.json(
        {
          success: false,
          error: 'Market not found',
        },
        { status: 404 }
      );
    }

    // 检查市场是否已经结算
    if (existingMarket.status === MarketStatus.RESOLVED) {
      return NextResponse.json(
        {
          success: false,
          error: 'Market is already resolved',
        },
        { status: 400 }
      );
    }

    // 使用 DBService 更新市场状态
    const resolvedOutcome = resolutionOutcome === 'Invalid' 
      ? Outcome.CANCELED 
      : (resolutionOutcome === 'YES' ? Outcome.YES : Outcome.NO);
    
    const updatedMarket = await DBService.updateMarket(market_id, {
      status: MarketStatus.RESOLVED,
      resolvedOutcome: resolvedOutcome,
    });

    if (!updatedMarket) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update market',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Market resolved successfully.',
      outcome: resolutionOutcome,
      data: updatedMarket,
    });
  } catch (error) {
    console.error('Admin market resolution API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

