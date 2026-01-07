import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminAccess } from '@/lib/adminAuth';

/**
 * 全局手续费率设置 API
 * GET /api/admin/settings/global-fee-rate - 获取全局手续费率
 * POST /api/admin/settings/global-fee-rate - 设置全局手续费率
 */

const GLOBAL_FEE_RATE_KEY = 'GLOBAL_FEE_RATE'; // global_stats 表中的 label

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdminAccess(request);
    if (!authResult.success || !authResult.isAdmin) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: authResult.statusCode || 401 }
      );
    }

    // 从 global_stats 表获取全局手续费率
    const globalFeeRate = await prisma.global_stats.findFirst({
      where: {
        label: GLOBAL_FEE_RATE_KEY,
        isActive: true,
      },
      select: {
        value: true,
      },
    });

    // 如果没有设置，返回默认值 0.05 (5%)
    const feeRate = globalFeeRate?.value ?? 0.05;

    return NextResponse.json({
      success: true,
      data: {
        feeRate,
      },
    });
  } catch (error: any) {
    console.error('❌ [Global Fee Rate GET] 错误:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get global fee rate' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdminAccess(request);
    if (!authResult.success || !authResult.isAdmin) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: authResult.statusCode || 401 }
      );
    }

    const body = await request.json();
    const { feeRate } = body;

    if (feeRate === undefined || feeRate === null) {
      return NextResponse.json(
        { success: false, error: 'feeRate is required' },
        { status: 400 }
      );
    }

    const feeRateNum = parseFloat(feeRate);
    if (isNaN(feeRateNum) || feeRateNum < 0 || feeRateNum > 1) {
      return NextResponse.json(
        { success: false, error: 'feeRate must be a number between 0 and 1 (0% to 100%)' },
        { status: 400 }
      );
    }

    // 🔥 修复：先查找是否存在，然后使用 update 或 create
    const existing = await prisma.global_stats.findFirst({
      where: {
        label: GLOBAL_FEE_RATE_KEY,
        isActive: true,
      },
    });

    if (existing) {
      // 如果存在，更新
      await prisma.global_stats.update({
        where: {
          id: existing.id,
        },
        data: {
          value: feeRateNum,
          updatedAt: new Date(),
        },
      });
    } else {
      // 如果不存在，创建
      await prisma.global_stats.create({
        data: {
          id: require('crypto').randomUUID(),
          label: GLOBAL_FEE_RATE_KEY,
          value: feeRateNum,
          unit: '%',
          isActive: true,
          sortOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Global fee rate updated successfully',
      data: {
        feeRate: feeRateNum,
      },
    });
  } catch (error: any) {
    console.error('❌ [Global Fee Rate POST] 错误:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update global fee rate' },
      { status: 500 }
    );
  }
}

