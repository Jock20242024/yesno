import { NextResponse } from 'next/server';
import { DBService } from '@/lib/dbService'; // 修复：使用正确的 DBService 确保数据隔离
import { TransactionStatus } from '@/types/data';
import { extractUserIdFromToken } from '@/lib/authUtils'; // 强制数据隔离：使用统一的 userId 提取函数

/**
 * 提现 API
 * POST /api/withdraw
 * 
 * 处理用户提现请求
 * 请求体：
 * - amount: 提现金额
 * - targetAddress: 提现地址
 */
export async function POST(request: Request) {
  try {
    // 强制身份过滤：从 Auth Token 提取 current_user_id
    const authResult = await extractUserIdFromToken();
    
    if (!authResult.success || !authResult.userId) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error || 'Not authenticated',
        },
        { status: 401 }
      );
    }

    const userId = authResult.userId;

    // 解析请求体
    const body = await request.json();
    const { amount, targetAddress } = body;

    // 验证必需字段
    if (!amount || !targetAddress) {
      return NextResponse.json(
        {
          success: false,
          error: 'amount and targetAddress are required',
        },
        { status: 400 }
      );
    }

    // 验证 amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'amount must be a positive number',
        },
        { status: 400 }
      );
    }

    // 验证 targetAddress
    if (typeof targetAddress !== 'string' || targetAddress.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'targetAddress must be a valid address',
        },
        { status: 400 }
      );
    }

    // 获取当前用户
    const user = await DBService.findUserById(userId);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
        },
        { status: 404 }
      );
    }

    // 业务校验：验证用户余额是否大于等于 amount
    if (user.balance < amountNum) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient balance',
        },
        { status: 400 }
      );
    }

    // 创建提现请求记录（状态为 PENDING）
    const withdrawalId = `W-${Date.now()}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
    const withdrawal = await DBService.addWithdrawal({
      id: withdrawalId,
      userId: userId,
      amount: amountNum,
      targetAddress: targetAddress.trim(),
      status: TransactionStatus.PENDING,
      createdAt: new Date().toISOString(),
    });

    // 立即扣除用户余额（防止重复提现或下注）
    const updatedUser = await DBService.updateUser(userId, {
      balance: user.balance - amountNum,
    });

    if (!updatedUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update user balance',
        },
        { status: 500 }
      );
    }

    // 返回提现请求的记录
    return NextResponse.json({
      success: true,
      message: 'Withdrawal request submitted',
      data: {
        withdrawal,
        updatedBalance: updatedUser.balance,
      },
    });
  } catch (error) {
    console.error('Withdraw API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

