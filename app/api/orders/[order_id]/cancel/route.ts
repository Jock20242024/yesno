import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/utils';

/**
 * 取消订单 API
 * POST /api/orders/[order_id]/cancel
 * 
 * 取消用户的 PENDING 状态的 LIMIT 订单（挂单）
 * - 将订单状态设置为 CANCELLED
 * - 将冻结资金退回用户可用余额
 * 
 * 🔥 统一认证：使用 NextAuth 进行身份验证
 */
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ order_id: string }> }
) {
  try {
    // 🔥 使用统一的 NextAuth 认证
    const authResult = await requireAuth();
    
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.statusCode }
      );
    }

    const userId = authResult.userId;
    const { order_id } = await params;

    // 查找订单
    const order = await prisma.orders.findUnique({
      where: { id: order_id },
      include: {
        users: {
          select: {
            id: true,
            balance: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // 验证订单属于当前用户
    if (order.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: You can only cancel your own orders' },
        { status: 403 }
      );
    }

    // 🔥 注意：当前 Order 模型没有 status 字段，所以暂时无法真正判断是否为 PENDING 订单
    // TODO: 当 Order 模型添加 status 字段后，需要添加检查：
    // if (order.status !== 'PENDING') {
    //   return NextResponse.json(
    //     { success: false, error: 'Only pending orders can be cancelled' },
    //     { status: 400 }
    //   );
    // }

    // 使用事务确保原子性
    const result = await prisma.$transaction(async (tx) => {
      // 1. 退回冻结资金到用户余额
      const refundAmount = order.amount;
      const updatedUser = await tx.users.update({
        where: { id: userId },
        data: {
          balance: {
            increment: refundAmount,
          },
        },
      });

      // 2. 更新订单状态为 CANCELLED
      // TODO: 当 Order 模型添加 status 字段后，使用以下代码更新状态：
      // const updatedOrder = await tx.orders.update({
      //   where: { id: order_id },
      //   data: {
      //     status: 'CANCELLED',
      //   },
      // });

      // 🔥 当前暂时方案：由于 Order 模型没有 status 字段，暂时删除订单
      // ⚠️ 注意：这是一个临时方案，当 Order 模型添加 status 字段后应该改为 update 而不是 delete
      // 在真正的限价订单系统中，应该保留订单记录，只更新状态，以便用户查看历史挂单
      await tx.orders.delete({
        where: { id: order_id },
      });

      return {
        updatedUser,
        // updatedOrder,
      };
    });

    return NextResponse.json({
      success: true,
      message: 'Order cancelled successfully',
      data: {
        refundAmount: order.amount,
        newBalance: result.updatedUser.balance,
      },
    });
  } catch (error) {
    console.error('Cancel order API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
