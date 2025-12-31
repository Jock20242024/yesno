import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/authExport';
import { getSchedulerActiveStatus, setSchedulerActiveStatus } from '@/lib/redis';

/**
 * GET /api/admin/system/scheduler-status
 * 获取调度器状态
 */
export async function GET() {
  try {
    // 权限验证
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // @ts-ignore - session.user.isAdmin 在 NextAuth callback 中已设置
    if (!session.user.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // 从 Redis 读取状态
    const active = await getSchedulerActiveStatus();

    return NextResponse.json({
      success: true,
      data: {
        active,
      },
    });
  } catch (error: any) {
    console.error('❌ [Scheduler Status API] 获取状态失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '获取状态失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/system/scheduler-status
 * 更新调度器状态
 * Body: { active: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    // 权限验证
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // @ts-ignore - session.user.isAdmin 在 NextAuth callback 中已设置
    if (!session.user.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // 解析请求体
    const body = await request.json();
    const { active } = body;

    // 验证参数
    if (typeof active !== 'boolean') {
      return NextResponse.json(
        { success: false, error: '参数错误: active 必须是布尔值' },
        { status: 400 }
      );
    }

    // 更新 Redis 状态
    await setSchedulerActiveStatus(active);

    return NextResponse.json({
      success: true,
      data: {
        active,
        message: active ? '调度器已启用' : '调度器已暂停',
      },
    });
  } catch (error: any) {
    console.error('❌ [Scheduler Status API] 更新状态失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '更新状态失败' },
      { status: 500 }
    );
  }
}
