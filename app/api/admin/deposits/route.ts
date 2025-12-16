import { NextRequest, NextResponse } from "next/server";
import { mockDeposits } from "@/lib/mockData";
import { verifyAdminToken, createUnauthorizedResponse } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  try {
    // 权限校验：使用统一的 Admin Token 验证函数（从 Cookie 读取）
    const authResult = await verifyAdminToken(request);

    if (!authResult.success) {
      return createUnauthorizedResponse(
        authResult.error || 'Unauthorized. Admin access required.',
        authResult.statusCode || 401
      );
    }

    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get("search") || "";
    const statusFilter = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    // 过滤数据
    let filteredDeposits = [...mockDeposits];

    // 按搜索关键词过滤（订单ID或用户名）
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredDeposits = filteredDeposits.filter(
        (deposit) =>
          deposit.orderId.toLowerCase().includes(query) ||
          deposit.username.toLowerCase().includes(query) ||
          deposit.userId.toLowerCase().includes(query)
      );
    }

    // 按状态过滤
    if (statusFilter) {
      filteredDeposits = filteredDeposits.filter((deposit) => deposit.status === statusFilter);
    }

    // 分页
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedDeposits = filteredDeposits.slice(startIndex, endIndex);

    return NextResponse.json({
      success: true,
      data: paginatedDeposits,
      pagination: {
        page,
        limit,
        total: filteredDeposits.length,
        totalPages: Math.ceil(filteredDeposits.length / limit),
      },
    });
  } catch (error) {
    console.error("Admin deposits API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

