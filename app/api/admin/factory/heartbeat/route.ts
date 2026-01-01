/**
 * 手动触发心跳更新 API
 * POST /api/admin/factory/heartbeat
 * 
 * 用于手动更新心跳记录，用于测试和修复
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/authExport';
import { prisma } from '@/lib/prisma';
import dayjs from '@/lib/dayjs';

export const dynamic = 'force-dynamic';

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
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 更新心跳
    const nowUtc = dayjs.utc().toISOString();
    const result = await prisma.system_settings.upsert({
      where: { key: 'lastFactoryRunAt' },
      update: { value: nowUtc },
      create: { key: 'lastFactoryRunAt', value: nowUtc, updatedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: '心跳已更新',
      data: {
        key: result.key,
        value: result.value,
        updatedAt: result.updatedAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('❌ [Heartbeat API] 更新心跳失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
