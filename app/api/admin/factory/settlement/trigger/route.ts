/**
 * 🔥 管理员手动触发结算扫描器
 * POST /api/admin/factory/settlement/trigger
 * 
 * 用于管理员手动触发结算任务，不需要 cron secret
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/authExport';
import { runSettlementScanner } from '@/lib/factory/settlement';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    // 权限校验：使用 NextAuth session 验证管理员身份
    const session = await auth();
    
    if (!session || !session.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized. Admin access required.',
        },
        { status: 401 }
      );
    }
    
    const userRole = (session.user as any).role;
    const userEmail = session.user.email;
    const adminEmail = 'yesno@yesno.com';
    
    if (userRole !== 'ADMIN' && userEmail !== adminEmail) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized. Admin access required.',
        },
        { status: 401 }
      );
    }

    console.log('⚖️ [Admin Settlement Trigger] 管理员手动触发结算扫描器...');
    
    const stats = await runSettlementScanner();
    
    return NextResponse.json({
      success: true,
      message: '结算扫描器执行完成',
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ [Admin Settlement Trigger] 结算扫描器执行失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
