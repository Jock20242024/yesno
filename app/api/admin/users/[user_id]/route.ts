import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/authExport';
import { prisma } from '@/lib/prisma';
import { DBService } from '@/lib/dbService';

export const dynamic = 'force-dynamic';

/**
 * 管理后台 - 获取用户详情 API
 * GET /api/admin/users/[user_id]
 * 
 * 返回指定用户的详细信息（管理员专用）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ user_id: string }> }
) {
  try {
    // 权限校验：必须是管理员
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

    // 查找用户
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        provider: true,
        balance: true,
        isAdmin: true,
        isBanned: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found.',
        },
        { status: 404 }
      );
    }

    // 获取用户的订单统计
    const [ordersCount, depositsCount, withdrawalsCount] = await Promise.all([
      prisma.orders.count({ where: { userId } }),
      prisma.deposits.count({ where: { userId } }),
      prisma.withdrawals.count({ where: { userId } }),
    ]);

    // 获取最近10条订单
    const recentOrders = await prisma.orders.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        markets: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...user,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        stats: {
          ordersCount,
          depositsCount,
          withdrawalsCount,
        },
        recentOrders: recentOrders.map(order => ({
          id: order.id,
          marketId: order.marketId,
          marketTitle: order.markets?.title || '未知市场',
          outcomeSelection: order.outcomeSelection,
          amount: order.amount,
          payout: order.payout,
          feeDeducted: order.feeDeducted,
          createdAt: order.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error('Admin get user detail API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * 管理后台 - 更新用户信息 API
 * PUT /api/admin/users/[user_id]
 * 
 * 请求体：
 * {
 *   email?: string;
 *   isAdmin?: boolean;
 *   isBanned?: boolean;
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ user_id: string }> }
) {
  try {
    // 权限校验：必须是管理员
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

    // 构建更新数据
    const updateData: any = {};
    if (body.email !== undefined) updateData.email = body.email;
    if (body.isAdmin !== undefined) updateData.isAdmin = body.isAdmin;
    if (body.isBanned !== undefined) updateData.isBanned = body.isBanned;

    // 更新用户
    const updatedUser = await DBService.updateUser(userId, updateData);

    if (!updatedUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found or update failed.',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'User updated successfully.',
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        isAdmin: updatedUser.isAdmin,
        isBanned: updatedUser.isBanned,
      },
    });
  } catch (error) {
    console.error('Admin update user API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
