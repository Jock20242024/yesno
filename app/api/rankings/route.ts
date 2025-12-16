import { NextResponse } from 'next/server';
import { mockUsers } from '@/lib/mockData';

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
  const { searchParams } = new URL(request.url);
  const timeRange = searchParams.get('timeRange') || 'all';
  const search = searchParams.get('search');
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');

  // 从模拟数据开始
  let filteredUsers = [...mockUsers];

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
}

