import { NextResponse } from 'next/server';
import { DBService } from '@/lib/dbService';
import { requireAuth } from '@/lib/auth/utils';

/**
 * 获取用户交易记录 API
 * GET /api/transactions
 * 
 * 返回当前登录用户的所有充值和提现记录
 * 
 * 🔥 统一认证：使用 NextAuth 进行身份验证
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 🔥 使用统一的 NextAuth 认证
    const authResult = await requireAuth();
    
    if (!authResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error,
        },
        { status: authResult.statusCode }
      );
    }

    const userId = authResult.userId;

    // 强制 DB 过滤：使用 DBService.findUserTransactions(userId) 确保数据隔离
    // DBService.findUserTransactions 内部使用 WHERE userId = current_user_id
    const transactions = await DBService.findUserTransactions(userId);

    return NextResponse.json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    console.error('Get transactions API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

