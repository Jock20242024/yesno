import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * 🔥 获取指定模板下的所有市场（用于多时段导航条）
 * GET /api/factory/markets-by-template?templateId=xxx&startDate=xxx&endDate=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    if (!templateId) {
      return NextResponse.json(
        { success: false, error: 'templateId is required' },
        { status: 400 }
      );
    }

    // 🔥 确保返回一整天（00:00-23:59）的数据
    let startDate = startDateStr ? new Date(startDateStr) : new Date();
    let endDate = endDateStr ? new Date(endDateStr) : new Date();
    
    // 如果没有指定日期范围，默认返回当天
    if (!startDateStr) {
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      endDate.setHours(0, 0, 0, 0);
    }

    // 查询该模板下的所有市场
    const markets = await prisma.markets.findMany({
      where: {
        templateId,
        isFactory: true,
        closingDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        closingDate: true,
        status: true,
        createdAt: true,
      },
      orderBy: {
        closingDate: 'asc',
      },
    });

    return NextResponse.json({
      success: true,
      markets: markets.map(m => ({
        id: m.id,
        closingDate: m.closingDate.toISOString(),
        status: m.status,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error('❌ [Markets by Template API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
