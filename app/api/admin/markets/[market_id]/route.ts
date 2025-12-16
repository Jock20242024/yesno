import { NextRequest, NextResponse } from "next/server";
import { DBService } from "@/lib/mockData";
import { Market, MarketStatus, Outcome } from "@/types/data";
import { verifyAdminToken, createUnauthorizedResponse } from '@/lib/adminAuth';

/**
 * 管理后台 - 更新市场信息 API
 * PUT /api/admin/markets/[market_id]
 * 
 * 请求体：
 * {
 *   title?: string;              // 市场标题（可选）
 *   description?: string;          // 市场描述（可选）
 *   endTime?: string;              // 截止日期 (ISO 8601 格式)（可选）
 *   imageUrl?: string;             // 图片 URL（可选）
 *   sourceUrl?: string;            // 信息来源链接（可选）
 *   resolutionCriteria?: string;  // 结算规则说明（可选）
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ market_id: string }> }
) {
  try {
    // 权限校验：使用统一的 Admin Token 验证函数（从 Cookie 读取）
    const authResult = await verifyAdminToken(request);

    if (!authResult.success) {
      return createUnauthorizedResponse(
        authResult.error || 'Unauthorized. Admin access required.',
        authResult.statusCode || 401
      );
    }

    const { market_id } = await params;
    const body = await request.json();
    const { title, description, endTime } = body;

    // 查找市场
    const existingMarket = await DBService.findMarketById(market_id);

    if (!existingMarket) {
      return NextResponse.json(
        {
          success: false,
          error: "Market not found",
        },
        { status: 404 }
      );
    }

    // 验证日期格式（如果提供了 endTime）
    if (endTime) {
      const endDate = new Date(endTime);
      if (isNaN(endDate.getTime())) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid endTime format. Please use ISO 8601 format (e.g., "2024-12-31T23:59:59Z")',
          },
          { status: 400 }
        );
      }

      // 验证日期不能是过去（除非市场已结算）
      if (existingMarket.status !== MarketStatus.RESOLVED && endDate.getTime() < Date.now()) {
        return NextResponse.json(
          {
            success: false,
            error: "endTime cannot be in the past for open markets",
          },
          { status: 400 }
        );
      }
    }

    // 准备更新数据（只更新提供的字段）
    const updateData: Partial<Market> = {};
    if (title) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || "";
    if (endTime) updateData.closingDate = endTime;

    // 使用 DBService 更新市场信息
    const updatedMarket = await DBService.updateMarket(market_id, updateData);

    if (!updatedMarket) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to update market",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Market updated successfully.",
      data: updatedMarket,
    });
  } catch (error) {
    console.error("Admin market update API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

