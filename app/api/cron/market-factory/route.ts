import { NextRequest, NextResponse } from 'next/server';
import { checkAndCreateMarkets } from '@/lib/marketFactory';

export const dynamic = 'force-dynamic';

/**
 * Cron Job API 路由
 * 用于被外部 cron 服务调用（如 Vercel Cron、GitHub Actions 等）
 * 
 * 安全：建议添加 API Key 验证
 */
export async function GET(request: NextRequest) {
  try {
    // 可选：验证 API Key
    const apiKey = request.headers.get('x-api-key');
    const expectedKey = process.env.CRON_API_KEY;
    
    if (expectedKey && apiKey !== expectedKey) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('⏰ [Cron] 定时任务触发: 检查市场工厂模板');
    
    await checkAndCreateMarkets();
    
    return NextResponse.json({
      success: true,
      message: 'Market factory check completed',
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
