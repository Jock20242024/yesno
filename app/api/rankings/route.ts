import { NextResponse } from 'next/server';
import { DBService } from '@/lib/dbService'; // 修复：使用正确的 DBService，不再使用 mockData

/**
 * 排行榜 API
 * GET /api/rankings
 * 
 * 返回用户排行榜数据
 * 支持查询参数：
 * - timeRange: 时间范围 (today, weekly, monthly, all)
 * - search: 搜索用户名
 * - page: 页码
 * - pageSize: 每页数量
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || 'all';
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    // 修复：从数据库查询所有用户（排行榜需要显示所有用户）
    const allUsers = await DBService.getAllUsers();
    
    // ========== 修复：转换为排行榜格式，确保所有数字字段都有默认值 ==========
    let filteredUsers = allUsers.map((user, index) => {
      // 获取用户的订单来计算真实数据
      // 简化实现：暂时使用默认值，后续可以从订单计算
      return {
        id: user.id,
        username: user.email.split('@')[0], // 使用邮箱前缀作为用户名
        avatarUrl: undefined, // 暂时没有头像
        rank: index + 1, // 排名从 1 开始
        profitLoss: 0, // ========== 修复：确保有默认值，避免 undefined ==========
        volumeTraded: 0, // ========== 修复：确保有默认值，避免 undefined ==========
        positionsValue: user.balance || 0, // 使用余额作为持仓价值，确保有默认值
        biggestWin: 0, // 简化：实际应该从订单计算
        predictions: 0, // 简化：实际应该从订单计算
        joinDate: new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
        createdAt: user.createdAt,
        updatedAt: user.createdAt,
      };
    });

    // 搜索过滤
    if (search) {
      const searchLower = search.toLowerCase();
      filteredUsers = filteredUsers.filter(
        (user) => user.username.toLowerCase().includes(searchLower)
      );
    }

    // TODO: 根据 timeRange 过滤数据
    // 目前返回所有数据，后续可以根据 timeRange 参数过滤

    // 分页处理
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

    return NextResponse.json({
      success: true,
      data: paginatedUsers,
      pagination: {
        total: filteredUsers.length,
        page,
        pageSize,
        totalPages: Math.ceil(filteredUsers.length / pageSize),
      },
    });
  } catch (error) {
    console.error('Rankings API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

