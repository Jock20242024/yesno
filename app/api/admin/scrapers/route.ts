import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = "force-dynamic";

/**
 * 获取所有采集源列表
 * GET /api/admin/scrapers
 */
export async function GET(request: NextRequest) {
  try {
    const dataSources = await prisma.data_sources.findMany({
      orderBy: {
        sourceName: 'asc',
      },
    });

    return NextResponse.json({
      success: true,
      data: dataSources.map(ds => ({
        id: ds.id,
        sourceName: ds.sourceName,
        status: ds.status,
        lastSyncTime: ds.lastSyncTime?.toISOString() || null,
        itemsCount: ds.itemsCount,
        multiplier: ds.multiplier,
        errorMessage: ds.errorMessage,
        createdAt: ds.createdAt.toISOString(),
        updatedAt: ds.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('❌ [Admin Scrapers] 获取采集源列表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取数据失败',
      },
      { status: 500 }
    );
  }
}
