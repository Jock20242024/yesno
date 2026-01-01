import { NextResponse } from 'next/server';
import { DBService } from '@/lib/dbService'; // 🔥 修复：使用正确的 dbService 而不是 mockData
import { MarketStatus, Outcome } from '@/types/data';
import { auth } from "@/lib/authExport";
import { executeSettlement } from '@/lib/factory/settlement';
import { prisma } from '@/lib/prisma';

/**
 * 管理后台 - 市场清算 API
 * POST /api/admin/markets/[market_id]/settle
 * 
 * 🔥 重构：统一调用核心结算函数 executeSettlement，确保逻辑一致
 * 🔥 修复：统一使用 NextAuth 进行权限验证
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
    // 🔥 修复：统一使用 NextAuth 进行权限验证（与结算监控中心保持一致）
    const session = await auth();
    
    // 🔥 调试日志：打印 session 信息

    if (!session || !session.user) {
      console.error('❌ [Settle API] Session 验证失败: session 或 user 为空');
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }
    
    // 🔥 修复：直接从数据库查询 isAdmin，不依赖 session
    const userEmail = session.user.email;
    if (!userEmail) {
      console.error('❌ [Settle API] 用户邮箱为空');
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }
    
    const dbUser = await prisma.users.findUnique({
      where: { email: userEmail },
      select: { id: true, isAdmin: true, isBanned: true },
    });
    
    // 🔥 调试日志：打印数据库查询结果

    if (!dbUser) {
      console.error('❌ [Settle API] 用户不存在于数据库');
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }
    
    if (!dbUser.isAdmin) {
      console.error('❌ [Settle API] 用户不是管理员，数据库 isAdmin =', dbUser.isAdmin);
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }
    
    if (dbUser.isBanned) {
      console.error('❌ [Settle API] 管理员账户已被禁用');
      return NextResponse.json(
        { success: false, error: 'Admin account is banned.' },
        { status: 403 }
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
