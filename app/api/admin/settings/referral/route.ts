import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/authExport';
import { randomUUID } from 'crypto';

/**
 * Admin 返佣设置 API
 * GET /api/admin/settings/referral - 获取返佣比例
 * PUT /api/admin/settings/referral - 更新返佣比例
 */

const REFERRAL_COMMISSION_RATE_KEY = 'REFERRAL_COMMISSION_RATE';

export async function GET() {
  try {
    // 权限验证
    const session = await auth();
    if (!session?.user || !(session.user as any).isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 获取返佣比例配置
    const setting = await prisma.system_settings.findUnique({
      where: { key: REFERRAL_COMMISSION_RATE_KEY },
    });

    // 如果不存在，返回默认值 0.01 (1%)
    const rate = setting ? parseFloat(setting.value) : 0.01;
    const ratePercent = rate * 100; // 转换为百分比显示

    return NextResponse.json({
      success: true,
      data: {
        rate: rate,
        ratePercent: ratePercent,
      },
    });
  } catch (error: any) {
    console.error('❌ [Admin Referral Settings GET] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch referral settings',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    // 权限验证
    const session = await auth();
    if (!session?.user || !(session.user as any).isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { ratePercent } = body;

    // 验证输入
    if (typeof ratePercent !== 'number' || ratePercent < 0 || ratePercent > 100) {
      return NextResponse.json(
        { success: false, error: 'Rate must be between 0 and 100' },
        { status: 400 }
      );
    }

    // 转换为小数（例如：5% -> 0.05）
    const rate = ratePercent / 100;

    // 使用 upsert 确保配置存在
    await prisma.system_settings.upsert({
      where: { key: REFERRAL_COMMISSION_RATE_KEY },
      update: { value: rate.toString(), updatedAt: new Date() },
      create: {
        updatedAt: new Date(),
        key: REFERRAL_COMMISSION_RATE_KEY,
        value: rate.toString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Referral commission rate updated successfully',
      data: {
        rate: rate,
        ratePercent: ratePercent,
      },
    });
  } catch (error: any) {
    console.error('❌ [Admin Referral Settings PUT] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update referral settings',
      },
      { status: 500 }
    );
  }
}

