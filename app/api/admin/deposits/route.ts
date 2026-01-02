import { NextRequest, NextResponse } from "next/server";
import { DBService } from '@/lib/dbService'; // 修复：使用正确的 DBService，不再使用 mockData
import { verifyAdminToken, createUnauthorizedResponse } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

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

    // 修复：从数据库查询所有充值记录（管理员可以查看所有用户的充值）
    // 查询结构：严格按照当前用户过滤（但管理员可以查看所有用户）
    const where: any = {};
    if (statusFilter) {
      where.status = statusFilter;
    }
    if (searchQuery) {
      where.OR = [
        { id: { contains: searchQuery, mode: 'insensitive' } },
        { userId: { contains: searchQuery, mode: 'insensitive' } },
        { txHash: { contains: searchQuery, mode: 'insensitive' } },
      ];
    }

    const [dbDeposits, total] = await Promise.all([
      prisma.deposits.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.deposits.count({ where }),
    ]);

    // 转换为 API 格式（需要关联 User 表获取 email 作为 username）
    // 简化实现：使用 userId 作为 username，实际应该关联 User 表
    const deposits = await Promise.all(
      dbDeposits.map(async (deposit) => {
        // 可选：关联 User 表获取 email
        const user = await prisma.users.findUnique({
          where: { id: deposit.userId },
          select: { email: true },
        });
        
        return {
          orderId: deposit.id,
          userId: deposit.userId,
          username: user?.email?.split('@')[0] || deposit.userId.substring(0, 8), // 使用邮箱前缀或 userId 前8位
          amount: Number(deposit.amount),
          status: deposit.status.toLowerCase(),
          timestamp: deposit.createdAt.toISOString(),
          paymentMethod: 'crypto', // 默认值
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: deposits,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
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

