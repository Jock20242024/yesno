import { NextRequest, NextResponse } from 'next/server';
import { DBService } from '@/lib/mockData';
import { TransactionStatus } from '@/types/data';
import { verifyAdminToken, createUnauthorizedResponse } from '@/lib/adminAuth';

/**
 * 管理后台 - 提现审批 API
 * GET /api/admin/withdrawals - 查询待处理请求
 * POST /api/admin/withdrawals - 审批/拒绝
 */
export async function GET(request: NextRequest) {
  try {
    // 权限校验：使用统一的 Admin Token 验证函数
    const authResult = await verifyAdminToken(request);

    if (!authResult.success) {
      return createUnauthorizedResponse(
        authResult.error || 'Unauthorized. Admin access required.',
        authResult.statusCode || 401
      );
    }

    // GET 逻辑：查询所有待处理的提现请求
    const pendingWithdrawals = await DBService.findPendingWithdrawals();

    return NextResponse.json({
      success: true,
      data: pendingWithdrawals,
    });
  } catch (error) {
    console.error('Get pending withdrawals API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 权限校验：使用统一的 Admin Token 验证函数
    const authResult = await verifyAdminToken(request);

    if (!authResult.success) {
      return createUnauthorizedResponse(
        authResult.error || 'Unauthorized. Admin access required.',
        authResult.statusCode || 401
      );
    }

    // 解析请求体
    const body = await request.json();
    const { withdrawalId, action } = body;

    // 验证必需字段
    if (!withdrawalId || !action) {
      return NextResponse.json(
        {
          success: false,
          error: 'withdrawalId and action are required',
        },
        { status: 400 }
      );
    }

    // 验证 action
    if (action !== 'APPROVE' && action !== 'REJECT') {
      return NextResponse.json(
        {
          success: false,
          error: 'action must be APPROVE or REJECT',
        },
        { status: 400 }
      );
    }

    // 获取提现记录
    const withdrawal = await DBService.findWithdrawalById(withdrawalId);
    if (!withdrawal) {
      return NextResponse.json(
        {
          success: false,
          error: 'Withdrawal not found',
        },
        { status: 404 }
      );
    }

    // 审批处理
    if (action === 'APPROVE') {
      // APPROVE (批准)：更新 Withdrawal 记录状态为 COMPLETED
      // 注意：资金已在用户提交请求时扣除，此处只需更新状态
      const updatedWithdrawal = await DBService.updateWithdrawalStatus(
        withdrawalId,
        TransactionStatus.COMPLETED
      );

      if (!updatedWithdrawal) {
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to update withdrawal status',
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Withdrawal approved successfully',
        data: updatedWithdrawal,
      });
    } else {
      // REJECT (拒绝)
      // 更新 Withdrawal 记录状态为 FAILED
      const updatedWithdrawal = await DBService.updateWithdrawalStatus(
        withdrawalId,
        TransactionStatus.FAILED
      );

      if (!updatedWithdrawal) {
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to update withdrawal status',
          },
          { status: 500 }
        );
      }

      // 关键：将提现金额退还给用户
      const user = await DBService.findUserById(withdrawal.userId);
      if (user) {
        const refundedUser = await DBService.updateUser(withdrawal.userId, {
          balance: user.balance + withdrawal.amount,
        });

        if (!refundedUser) {
          return NextResponse.json(
            {
              success: false,
              error: 'Failed to refund user balance',
            },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Withdrawal rejected and amount refunded',
        data: updatedWithdrawal,
      });
    }
  } catch (error) {
    console.error('Approve/Reject withdrawal API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
