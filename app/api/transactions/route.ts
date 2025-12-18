import { NextResponse } from 'next/server';
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { DBService } from '@/lib/dbService';

/**
 * 获取用户交易记录 API
 * GET /api/transactions
 * 
 * 返回当前登录用户的所有充值和提现记录
 * 
 * 🔥 关键修复：使用 NextAuth 的 getServerSession 统一认证
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 🔥 关键修复：使用 NextAuth v5 的 auth() 统一认证
    const session = await auth();
    
    if (!session?.user?.email) {
      console.log('🔒 [Transactions API] No session or email');
      return NextResponse.json(
        {
          success: false,
          error: 'Not authenticated',
        },
        { status: 401 }
      );
    }

    // 从 session 中获取用户 ID（通过 email 查询数据库获取 id）
    const user = await DBService.findUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
        },
        { status: 404 }
      );
    }

    const userId = user.id;

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

