import { NextRequest, NextResponse } from 'next/server';
import { PolymarketAdapter } from '@/lib/scrapers/polymarketAdapter';

export const dynamic = "force-dynamic";

/**
 * 手动运行采集任务
 * POST /api/admin/scrapers/[sourceName]/run
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sourceName: string }> }
) {
  try {
    const { sourceName } = await params;

    console.log(`🔄 [Admin Scrapers] 手动触发采集: ${sourceName}`);

    // 根据 sourceName 创建对应的适配器
    let adapter;
    switch (sourceName) {
      case 'Polymarket':
        adapter = new PolymarketAdapter(100); // 默认采集 100 条
        break;
      default:
        return NextResponse.json(
          {
            success: false,
            error: `未知的采集源: ${sourceName}`,
          },
          { status: 400 }
        );
    }

    // 执行采集
    const result = await adapter.execute();

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `采集成功，共处理 ${result.itemsCount} 条数据`,
        data: {
          itemsCount: result.itemsCount,
        },
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || '采集失败',
          data: {
            itemsCount: result.itemsCount,
          },
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ [Admin Scrapers] 运行采集失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '运行失败',
      },
      { status: 500 }
    );
  }
}
