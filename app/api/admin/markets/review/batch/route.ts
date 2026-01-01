import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken, createUnauthorizedResponse } from '@/lib/adminAuth';

export const dynamic = "force-dynamic";

/**
 * 批量审核市场
 * POST /api/admin/markets/review/batch
 * 
 * Body: { action: "approve" | "reject", marketIds: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    // 🔥 恢复权限检查：使用统一的 Admin Token 验证函数
    const authResult = await verifyAdminToken(request);

    if (!authResult.success) {
      return createUnauthorizedResponse(
        authResult.error || 'Unauthorized. Admin access required.',
        authResult.statusCode || 401
      );
    }

    const body = await request.json();
    const { action, marketIds } = body;

    if (!action || (action !== 'approve' && action !== 'reject')) {
      return NextResponse.json(
        { success: false, error: "Invalid action. Must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    if (!Array.isArray(marketIds) || marketIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "marketIds must be a non-empty array" },
        { status: 400 }
      );
    }

    // 批量更新审核状态
    const reviewStatus = action === 'approve' ? 'PUBLISHED' : 'REJECTED';
    
    try {
      const result = await prisma.markets.updateMany({
        where: {
          id: {
            in: marketIds,
          },
          reviewStatus: 'PENDING', // 只更新待审核的市场
        },
        data: {
          reviewStatus,
        },
      });

      return NextResponse.json({
        success: true,
        message: `成功${action === 'approve' ? '审核通过' : '永久拒绝'} ${result.count} 个市场`,
        count: result.count,
      });
    } catch (updateError) {
      console.error('❌ [Admin Review] 批量更新失败:', updateError);
      
      // 检查是否是 reviewStatus 字段不存在
      if (updateError instanceof Error && updateError.message.includes('Unknown arg `reviewStatus`')) {
        return NextResponse.json(
          {
            success: false,
            error: "数据库 schema 未同步，请运行: npx prisma db push",
          },
          { status: 500 }
        );
      }
      
      throw updateError;
    }
  } catch (error) {
    console.error('❌ [Admin Review] 批量审核失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '批量审核失败',
      },
      { status: 500 }
    );
  }
}
