import { NextResponse } from 'next/server';
import { DBService } from '@/lib/dbService';
import { extractUserIdFromToken } from '@/lib/authUtils'; // 强制数据隔离：使用统一的 userId 提取函数

/**
 * 获取当前用户的订单列表 API
 * GET /api/orders/user
 * 
 * 返回当前登录用户的所有订单列表
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

