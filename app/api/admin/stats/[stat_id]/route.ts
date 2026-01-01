import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/lib/authExport";
import prisma from '@/lib/prisma';

export const dynamic = "force-dynamic";

/**
 * 更新全局指标
 * PUT /api/admin/stats/[stat_id]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ stat_id: string }> }
) {
  try {
    // 权限校验
    const session = await auth();
    
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const userRole = (session.user as any).role;
    const userEmail = session.user.email;
    const adminEmail = 'yesno@yesno.com';
    
    if (userRole !== 'ADMIN' && userEmail !== adminEmail) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const { stat_id } = await params;
    const body = await request.json();
    const { label, value, unit, icon, sortOrder, isActive, overrideValue, manualOffset } = body;

    // 检查指标是否存在
    const existingStat = await prisma.global_stats.findUnique({
      where: { id: stat_id },
    });

    if (!existingStat) {
      return NextResponse.json(
        { success: false, error: '指标不存在' },
        { status: 404 }
      );
    }

    // 更新指标
    const updatedStat = await prisma.global_stats.update({
      where: { id: stat_id },
      data: {
        ...(label !== undefined && { label: label.trim() }),
        ...(value !== undefined && { value: parseFloat(value) }),
        ...(unit !== undefined && { unit: unit || null }),
        ...(icon !== undefined && { icon: icon || null }),
        ...(sortOrder !== undefined && { sortOrder: parseInt(sortOrder) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        ...(overrideValue !== undefined && { overrideValue: overrideValue !== null && overrideValue !== '' ? parseFloat(overrideValue) : null }),
        ...(manualOffset !== undefined && { manualOffset: parseFloat(manualOffset) || 0 }),
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedStat,
    });
  } catch (error) {
    console.error('更新全局指标失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '更新全局指标失败',
      },
      { status: 500 }
    );
  }
}

/**
 * 删除全局指标
 * DELETE /api/admin/stats/[stat_id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ stat_id: string }> }
) {
  try {
    // 权限校验
    const session = await auth();
    
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const userRole = (session.user as any).role;
    const userEmail = session.user.email;
    const adminEmail = 'yesno@yesno.com';
    
    if (userRole !== 'ADMIN' && userEmail !== adminEmail) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const { stat_id } = await params;

    // 检查指标是否存在
    const existingStat = await prisma.global_stats.findUnique({
      where: { id: stat_id },
    });

    if (!existingStat) {
      return NextResponse.json(
        { success: false, error: '指标不存在' },
        { status: 404 }
      );
    }

    // 删除指标
    await prisma.global_stats.delete({
      where: { id: stat_id },
    });

    return NextResponse.json({
      success: true,
      message: '指标删除成功',
    });
  } catch (error) {
    console.error('删除全局指标失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '删除全局指标失败',
      },
      { status: 500 }
    );
  }
}
