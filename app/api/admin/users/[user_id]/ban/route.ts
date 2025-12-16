import { NextRequest, NextResponse } from 'next/server';
import { DBService } from '@/lib/mockData';
import { verifyAdminToken, createUnauthorizedResponse } from '@/lib/adminAuth';

/**
 * 管理后台 - 用户禁用/解禁 API
 * POST /api/admin/users/[user_id]/ban
 * 
 * 请求体：
 * {
 *   action: 'ban' | 'unban'  // 操作类型：禁用或解禁
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { user_id: string } }
) {
  try {
    // 权限校验：使用统一的 Admin Token 验证函数（从 Cookie 读取）
    const authResult = await verifyAdminToken(request);

    if (!authResult.success) {
      return createUnauthorizedResponse(
        authResult.error || 'Unauthorized. Admin access required.',
        authResult.statusCode || 401
      );
    }

    const userId = params.user_id;
    const body = await request.json();
    const { action } = body;

    // 验证 action 参数
    if (action !== 'ban' && action !== 'unban') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid action. Must be "ban" or "unban".',
        },
        { status: 400 }
      );
    }

    // 检查用户是否存在
    const user = await DBService.findUserById(userId);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found.',
        },
        { status: 404 }
      );
    }

    // 更新用户状态（调用 DBService 更新 isBanned 字段）
    const isBanned = action === 'ban';
    const updatedUser = await DBService.updateUser(userId, { isBanned });

    if (!updatedUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update user status.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `User ${isBanned ? 'banned' : 'unbanned'} successfully.`,
      data: {
        userId: updatedUser.id,
        email: updatedUser.email,
        isBanned: updatedUser.isBanned,
      },
    });
  } catch (error) {
    console.error('Admin user ban/unban API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

