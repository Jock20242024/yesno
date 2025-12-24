import { NextRequest, NextResponse } from 'next/server';
import { runRelayEngine } from '@/lib/factory/relay';
import { runSettlementScanner } from '@/lib/factory/settlement';
import { startCronScheduler } from '@/lib/cron/scheduler';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 🔥 自动启动内部定时任务（单例模式，只会启动一次）
if (typeof window === 'undefined') {
  startCronScheduler();
}

/**
 * 🔥 工厂自动接力与结算定时任务（统一入口，每30秒运行一次）
 * GET /api/cron/market-factory
 * 
 * 用于被外部 cron 服务调用（如 Vercel Cron、GitHub Actions 等）
 * 执行顺序：
 * 1. 先执行自动结算（结算已到期的市场）
 * 2. 再执行自动接力（缓冲区检查模式，确保永不断流）
 * 
 * 运行频率：建议每30秒运行一次，确保及时补断流
 * 安全：建议添加 API Key 验证
 */
export async function GET(request: NextRequest) {
  try {
    // 可选：验证 API Key 或 secret
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const apiKey = request.headers.get('x-api-key');
    const expectedKey = process.env.CRON_API_KEY || process.env.CRON_SECRET;
    
    if (expectedKey && secret !== expectedKey && apiKey !== expectedKey) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('⏰ [Cron] 定时任务触发: 工厂自动接力与结算');

    // 1. 先执行自动结算（结算已到期的市场）
    console.log('⚖️ [Cron] 步骤1: 执行自动结算扫描...');
    const settlementStats = await runSettlementScanner();

    // 2. 再执行自动接力（创建下一个周期的市场）
    console.log('🔄 [Cron] 步骤2: 执行自动接力引擎...');
    await runRelayEngine();
    
    return NextResponse.json({
      success: true,
      message: 'Factory relay and settlement completed',
      settlement: settlementStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ [Cron] 定时任务执行失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
