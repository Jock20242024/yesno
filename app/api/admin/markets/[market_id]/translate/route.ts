import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = "force-dynamic";

/**
 * 更新市场翻译（中文标题和描述）
 * PUT /api/admin/markets/[market_id]/translate
 * 
 * Body: {
 *   titleZh?: string | null;
 *   descriptionZh?: string | null;
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ market_id: string }> }
) {
  try {
    const { market_id } = await params;
    const body = await request.json();
    const { titleZh, descriptionZh } = body;

    // 查找市场
    const market = await prisma.markets.findUnique({
      where: { id: market_id },
    });

    if (!market) {
      return NextResponse.json(
        { success: false, error: `Market not found: ${market_id}` },
        { status: 404 }
      );
    }

    // 更新翻译字段
    const updatedMarket = await prisma.markets.update({
      where: { id: market_id },
      data: {
        titleZh: titleZh || null,
        descriptionZh: descriptionZh || null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "翻译已保存",
      data: {
        id: updatedMarket.id,
        titleZh: updatedMarket.titleZh,
        descriptionZh: updatedMarket.descriptionZh,
      },
    });
  } catch (error) {
    console.error('❌ [Admin Translate] 更新翻译失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '更新翻译失败',
      },
      { status: 500 }
    );
  }
}
