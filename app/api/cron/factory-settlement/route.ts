/**
 * 🔥 工厂自动结算定时任务
 * GET /api/cron/factory-settlement
 * 
 * 定期运行的自动结算扫描器（由 cron 任务调用）
 * 动作：
 * 1. 识别已到达 EndTime 且未结算的工厂市场（OPEN, CLOSED, 以及可能的其他状态）
 * 2. 调用 Polymarket API 获取结算结果（使用 externalId）
 * 3. 直接更新数据库：status: 'RESOLVED', outcome: 'YES'/'NO'
 * 4. 分发奖金（如果有订单）
 */

import { NextRequest, NextResponse } from 'next/server';
import { runSettlementScanner } from '@/lib/factory/settlement';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    // 简单的密钥验证（防止未授权访问）
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('⚖️ [Cron] 开始执行工厂自动结算任务...');
    
    const stats = await runSettlementScanner();
    
    return NextResponse.json({
      success: true,
      message: 'Settlement scanner completed',
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ [Cron] 工厂自动结算任务失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
