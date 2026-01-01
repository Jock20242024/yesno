/**
 * 🔥 工厂自动接力定时任务
 * GET /api/cron/factory-relay
 * 
 * 每分钟运行的无人值守接力逻辑
 * 触发机制：在当前盘口 EndTime 到达前的 X 秒（取模版配置中的"接力时间"），系统自动触发生成下一个周期的盘口
 */

import { NextRequest, NextResponse } from 'next/server';
import { runRelayEngine } from '@/lib/factory/relay';

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

    await runRelayEngine();
    
    return NextResponse.json({
      success: true,
      message: 'Relay engine completed',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ [Cron] 工厂自动接力任务失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
