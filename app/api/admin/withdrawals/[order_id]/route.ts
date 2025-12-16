import { NextRequest, NextResponse } from "next/server";
import { DBService } from "@/lib/mockData";
import { TransactionStatus } from "@/types/data";
import { verifyAdminToken, createUnauthorizedResponse } from '@/lib/adminAuth';

/**
 * 管理后台 - 提现审批/拒绝 API
 * POST /api/admin/withdrawals/[order_id]
 * 
 * 请求体：
 * {
 *   status: "approved" | "rejected";  // 审批状态
 *   reason?: string;                   // 拒绝原因（可选）
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ order_id: string }> }
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

    const { order_id } = await params;
    const body = await request.json();
    const { status, reason } = body;

    // 验证必需字段
    if (!status) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required field: status is required",
        },
        { status: 400 }
      );
    }

    // 验证状态值
    if (status !== "approved" && status !== "rejected") {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid status. Must be "approved" or "rejected"',
        },
        { status: 400 }
      );
    }

    // 查找提现记录
    const withdrawal = await DBService.findWithdrawalById(order_id);

    if (!withdrawal) {
      return NextResponse.json(
        {
          success: false,
          error: "Withdrawal order not found",
        },
        { status: 404 }
      );
    }

    // 检查订单状态（只能审批或拒绝 PENDING 状态的订单）
    if (withdrawal.status !== TransactionStatus.PENDING) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot modify withdrawal order with status: ${withdrawal.status}`,
        },
        { status: 400 }
      );
    }

    // 审批处理
    if (status === "approved") {
      // APPROVE (批准)：更新 Withdrawal 记录状态为 COMPLETED
      // 注意：资金已在用户提交请求时扣除，此处只需更新状态
      const updatedWithdrawal = await DBService.updateWithdrawalStatus(
        order_id,
        TransactionStatus.COMPLETED
      );

      if (!updatedWithdrawal) {
        return NextResponse.json(
          {
            success: false,
            error: "Failed to update withdrawal status",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "提现请求已审批",
        data: updatedWithdrawal,
      });
    } else {
      // REJECT (拒绝)
      // 更新 Withdrawal 记录状态为 FAILED
      const updatedWithdrawal = await DBService.updateWithdrawalStatus(
        order_id,
        TransactionStatus.FAILED
      );

      if (!updatedWithdrawal) {
        return NextResponse.json(
          {
            success: false,
            error: "Failed to update withdrawal status",
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
              error: "Failed to refund user balance",
            },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({
        success: true,
        message: "提现请求已拒绝",
        data: updatedWithdrawal,
      });
    }
  } catch (error) {
    console.error("Admin withdrawal approval API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
