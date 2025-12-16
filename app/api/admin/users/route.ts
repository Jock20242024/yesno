import { NextRequest, NextResponse } from "next/server";
import { DBService } from "@/lib/mockData";
import { User } from "@/types/data";
import { verifyAdminToken, createUnauthorizedResponse } from '@/lib/adminAuth';

/**
 * 管理后台 - 获取用户列表 API
 * GET /api/admin/users
 * 
 * 查询参数：
 * - search?: string      // 搜索关键词（用户名）
 * - page?: number         // 页码（默认 1）
 * - limit?: number        // 每页数量（默认 10）
 */
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

    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    // 使用 DBService 获取所有用户（整个用户集合）
    // 确保调用 getAllUsers() 获取完整的用户列表，包括新注册的用户
    const allUsers = await DBService.getAllUsers();

    // 搜索过滤（按邮箱）- 只有在指定搜索参数时才过滤
    let filteredUsers = allUsers;
    if (search.trim()) {
      const searchLower = search.toLowerCase().trim();
      filteredUsers = allUsers.filter((user) => {
        return user.email.toLowerCase().includes(searchLower);
      });
    }
    // 如果没有搜索参数，filteredUsers 就是完整的用户列表，不会过滤掉任何用户

    // 计算分页
    const total = filteredUsers.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

    return NextResponse.json({
      success: true,
      data: paginatedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Admin users list API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

