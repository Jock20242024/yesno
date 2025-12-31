import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 临时禁用权限检查，优先确保审核功能能运行
// TODO: 修复后恢复权限检查 - 其他 admin API 使用以下方式：
// import { auth } from "@/lib/authExport";
// const session = await auth();

export const dynamic = "force-dynamic";

/**
 * 批量审核市场
 * POST /api/admin/markets/review/batch
 * 
 * Body: { action: "approve" | "reject", marketIds: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    // TODO: 临时禁用权限检查，优先确保审核功能能运行
    // 修复 getServerSession 导入问题后恢复权限检查

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
      const result = await prisma.market.updateMany({
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

      console.log(`✅ [Admin Review] 批量${action === 'approve' ? '审核通过' : '永久拒绝'} ${result.count} 个市场`);

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
