import { NextResponse } from 'next/server';
import { syncPolymarketMarkets } from '@/lib/polymarketService';

export const dynamic = "force-dynamic";

/**
 * 同步 Polymarket 市场数据 API
 * POST /api/cron/sync-polymarket
 * 
 * 从 Polymarket Gamma API 抓取活跃市场并同步到本地数据库
 * 
 * 可选查询参数：
 * - limit: 同步数量（默认 100）
 * - apiKey: API 密钥（用于保护端点，可选）
 */
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    
    // 可选：添加 API 密钥验证
    // const apiKey = searchParams.get('apiKey');
    // if (apiKey !== process.env.CRON_API_KEY) {
    //   return NextResponse.json(
    //     { success: false, error: 'Unauthorized' },
    //     { status: 401 }
    //   );
    // }

    const stats = await syncPolymarketMarkets(limit);

    return NextResponse.json({
      success: true,
      message: '同步完成',
      data: stats,
    });
  } catch (error) {
    console.error('❌ [Cron] 同步 Polymarket 失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '同步失败',
      },
      { status: 500 }
    );
  }
}

/**
 * GET 方法也支持（方便手动触发）
 */
export async function GET(request: Request) {
  return POST(request);
}
