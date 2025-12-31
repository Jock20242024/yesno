import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/lib/authExport";
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * 管理后台 - 获取所有订单列表 API
 * GET /api/admin/orders
 * 
 * 查询参数：
 * - search?: string      // 搜索关键词（订单ID、用户邮箱、市场标题）
 * - status?: string      // 状态筛选（PENDING, FILLED, CANCELLED, PARTIALLY_FILLED）
 * - page?: number        // 页码（默认 1）
 * - limit?: number       // 每页数量（默认 20）
 */
export async function GET(request: NextRequest) {
  try {
    // 🔥 权限校验：直接从数据库查询 isAdmin
    const session = await auth();
    
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }
    
    const userEmail = session.user.email;
    if (!userEmail) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }
    
    // 🔥 修复：直接从数据库查询 isAdmin
    const dbUser = await prisma.user.findUnique({
      where: { email: userEmail },
      select: { id: true, isAdmin: true },
    });
    
    if (!dbUser || !dbUser.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get("search") || "";
    const statusFilter = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    // 🔥 构建查询条件
    const where: any = {};
    
    // 状态筛选
    if (statusFilter) {
      where.status = statusFilter;
    }
    
    // 搜索条件（订单ID、用户邮箱、市场标题）
    if (searchQuery) {
      where.OR = [
        { id: { contains: searchQuery, mode: 'insensitive' } },
        { user: { email: { contains: searchQuery, mode: 'insensitive' } } },
        { market: { title: { contains: searchQuery, mode: 'insensitive' } } },
      ];
    }

    // 🔥 查询订单总数和分页数据（包含用户和市场信息）
    const [total, dbOrders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
          market: {
            select: {
              id: true,
              title: true,
              status: true,
              closingDate: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // 🔥 转换为前端需要的格式
    const orders = dbOrders.map((order) => ({
      id: order.id,
      userId: order.userId,
      userEmail: order.user.email,
      marketId: order.marketId,
      marketTitle: order.market.title,
      marketStatus: order.market.status,
      outcomeSelection: order.outcomeSelection,
      amount: Number(order.amount || 0),
      feeDeducted: Number(order.feeDeducted || 0),
      payout: order.payout ? Number(order.payout) : null,
      status: order.status,
      orderType: order.orderType || 'MARKET',
      limitPrice: order.limitPrice ? Number(order.limitPrice) : null,
      filledAmount: Number(order.filledAmount || 0),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    }));

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('❌ [Admin Orders API] 获取订单列表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
