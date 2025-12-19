import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/app/api/auth/[...nextauth]/route";
import prisma from '@/lib/prisma';

export const dynamic = "force-dynamic";

/**
 * 获取所有全局指标
 * GET /api/admin/stats
 */
export async function GET() {
  try {
    const stats = await prisma.globalStat.findMany({
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('获取全局指标失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取全局指标失败',
      },
      { status: 500 }
    );
  }
}

/**
 * 创建新的全局指标
 * POST /api/admin/stats
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { label, value, unit, icon, sortOrder, isActive } = body;

    // 验证必填字段
    if (!label || !label.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: '指标名称不能为空',
        },
        { status: 400 }
      );
    }

    // 创建指标
    const newStat = await prisma.globalStat.create({
      data: {
        label: label.trim(),
        value: value !== undefined ? parseFloat(value) : 0,
        unit: unit || null,
        icon: icon || null,
        sortOrder: sortOrder !== undefined ? parseInt(sortOrder) : 0,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    return NextResponse.json({
      success: true,
      data: newStat,
    });
  } catch (error) {
    console.error('创建全局指标失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '创建全局指标失败',
      },
      { status: 500 }
    );
  }
}
