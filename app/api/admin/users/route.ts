/**
 * 管理后台 - 获取用户列表 API
 * GET /api/admin/users
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from '@/lib/prisma';

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // 1. 权限校验：必须是管理员
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // @ts-ignore - session.user.isAdmin 在 NextAuth callback 中已设置
    if (!session.user.isAdmin) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    // 2. 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    // 3. 构建查询条件（使用 Prisma 的 where 进行数据库级别搜索，更高效）
    const where: any = {};
    if (search.trim()) {
      const searchLower = search.toLowerCase().trim();
      where.OR = [
        { email: { contains: searchLower, mode: 'insensitive' } },
        { id: { contains: searchLower, mode: 'insensitive' } },
      ];
    }

    // 4. 查询总数和分页数据
    const [total, dbUsers] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          provider: true,
          balance: true,
          isAdmin: true,
          isBanned: true,
          createdAt: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // 5. 返回用户数据
    const userData = dbUsers.map((user) => ({
      id: user.id,
      email: user.email,
      provider: user.provider || 'email',
      balance: user.balance,
      isAdmin: user.isAdmin,
      isBanned: user.isBanned,
      createdAt: user.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: userData,
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
