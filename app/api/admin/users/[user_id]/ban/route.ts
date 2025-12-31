import { NextRequest, NextResponse } from 'next/server';
import { DBService } from '@/lib/dbService'; // 🔥 修复：使用正确的 dbService 而不是 mockData
import { auth } from '@/lib/authExport'; // 🔥 修复：使用 NextAuth session 验证

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
  { params }: { params: Promise<{ user_id: string }> }
) {
  try {
    // 🔥 修复：使用 NextAuth session 验证（与 /api/admin/users 保持一致）
    const session = await auth();
    
    if (!session || !session.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized. Admin access required.',
        },
        { status: 401 }
      );
    }

    // @ts-ignore - session.user.isAdmin 在 NextAuth callback 中已设置
    if (!session.user.isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: Admin access required.',
        },
        { status: 403 }
      );
    }

    const { user_id } = await params;
    const userId = user_id;
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

