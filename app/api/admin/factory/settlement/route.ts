/**
 * 🔥 管理后台 - 手动触发工厂结算扫描器
 * POST /api/admin/factory/settlement
 * 
 * 管理员手动触发结算扫描，用于测试和紧急处理
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { runSettlementScanner } from '@/lib/factory/settlement';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 权限校验：使用 NextAuth session 验证管理员身份（与其他 admin factory APIs 保持一致）
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

    console.log('⚖️ [Admin Settlement] 管理员手动触发结算扫描...');
    
    const stats = await runSettlementScanner();
    
    return NextResponse.json({
      success: true,
      message: '结算扫描完成',
      stats: {
        scanned: stats.scanned, // 扫描的市场数量
        settled: stats.settled, // 成功结算的数量
        errors: stats.errors, // 失败的数量
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ [Admin Settlement] 结算扫描失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
