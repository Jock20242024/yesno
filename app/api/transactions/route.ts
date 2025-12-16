import { NextResponse } from 'next/server';
import { DBService } from '@/lib/dbService';
import { extractUserIdFromToken } from '@/lib/authUtils'; // 强制数据隔离：使用统一的 userId 提取函数

/**
 * 获取用户交易记录 API
 * GET /api/transactions
 * 
 * 返回当前登录用户的所有充值和提现记录
 * 
 * 强制数据隔离：必须使用从 Auth Token 提取的 current_user_id 进行数据库查询
 */
export async function GET() {
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

