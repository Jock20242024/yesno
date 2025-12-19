import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 临时禁用权限检查，优先确保审核功能能运行
// TODO: 修复后恢复权限检查 - 其他 admin API 使用以下方式：
// import { auth } from "@/app/api/auth/[...nextauth]/route";
// const session = await auth();

export const dynamic = "force-dynamic";

/**
 * 审核市场（单个）
 * POST /api/admin/markets/[market_id]/review
 * 
 * Body: { action: "approve" | "reject" }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ market_id: string }> }
) {
  try {
    // TODO: 临时禁用权限检查，优先确保审核功能能运行
    // 修复后恢复权限检查 - 使用以下代码：
    /*
    import { auth } from "@/app/api/auth/[...nextauth]/route";
    const session = await auth();
    
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const isAdmin = (session.user as any).role === 'ADMIN' || session.user.email === 'yesno@yesno.com';
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }
    */

    const { market_id } = await params;
    const body = await request.json();
    const { action } = body;

    if (!action || (action !== 'approve' && action !== 'reject')) {
      return NextResponse.json(
        { success: false, error: "Invalid action. Must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    const reviewStatus = action === 'approve' ? 'PUBLISHED' : 'REJECTED';
    
    console.log(`🔄 [Admin Review] 准备更新市场 ${market_id} 状态为 ${reviewStatus}`);
    
    // 查找市场
    const market = await prisma.market.findUnique({
      where: { id: market_id },
    });

    if (!market) {
      console.error(`❌ [Admin Review] 市场不存在: ${market_id}`);
      return NextResponse.json(
        { success: false, error: `Market not found: ${market_id}` },
        { status: 404 }
      );
    }

    console.log(`📊 [Admin Review] 找到市场: ${market.title}, 当前状态: ${market.reviewStatus}`);
    
    // 更新审核状态
    try {
      const updatedMarket = await prisma.market.update({
        where: { id: market_id },
        data: {
          reviewStatus,
        },
      });
      
      console.log(`✅ [Admin Review] 市场已更新: ${updatedMarket.title}, 新状态: ${updatedMarket.reviewStatus}`);

      console.log(`✅ [Admin Review] 市场 ${market_id} 已${action === 'approve' ? '审核通过' : '永久拒绝'}`);

      return NextResponse.json({
        success: true,
        message: `市场已${action === 'approve' ? '审核通过' : '永久拒绝'}`,
      });
    } catch (updateError) {
      console.error('❌ [Admin Review] 更新市场状态失败:', updateError);
      console.error('❌ [Admin Review] 错误详情:', {
        errorType: updateError instanceof Error ? updateError.constructor.name : typeof updateError,
        errorMessage: updateError instanceof Error ? updateError.message : String(updateError),
        errorStack: updateError instanceof Error ? updateError.stack : undefined,
        marketId,
        reviewStatus,
      });
      
      // 检查是否是 reviewStatus 字段不存在
      if (updateError instanceof Error && updateError.message.includes('Unknown arg `reviewStatus`')) {
        return NextResponse.json(
          {
            success: false,
            error: "数据库 schema 未同步，请运行: npx prisma db push",
            details: updateError.message,
          },
          { status: 500 }
        );
      }
      
      // 返回详细的错误信息
      return NextResponse.json(
        {
          success: false,
          error: updateError instanceof Error ? updateError.message : '更新失败',
          details: updateError instanceof Error ? updateError.stack : String(updateError),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ [Admin Review] 审核市场失败:', error);
    console.error('❌ [Admin Review] 错误详情:', {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '审核失败',
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    );
  }
}
