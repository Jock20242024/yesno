import { NextResponse } from 'next/server';
import { DBService } from '@/lib/dbService';
import { requireAuth } from '@/lib/auth/utils';

/**
 * 获取当前用户的订单列表 API
 * GET /api/orders/user
 * 
 * 返回当前登录用户的所有订单列表
 * 
 * 强制数据隔离：必须使用从 NextAuth session 提取的 current_user_id 进行数据库查询
 * 🔥 统一认证：使用 NextAuth 进行身份验证
 */
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

    // 强制 DB 过滤：使用 DBService.findOrdersByUserId(userId) 确保数据隔离
    // DBService.findOrdersByUserId 内部使用 WHERE userId = current_user_id
    const orders = await DBService.findOrdersByUserId(userId);

    return NextResponse.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error('Get user orders API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

