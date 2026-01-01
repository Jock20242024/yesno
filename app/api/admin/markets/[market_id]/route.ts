import { NextRequest, NextResponse } from "next/server";
import { DBService } from "@/lib/dbService"; // 🔥 修复：使用正确的 dbService 而不是 mockData
import { Market, MarketStatus, Outcome } from "@/types/data";
import { verifyAdminToken, createUnauthorizedResponse } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';
import { auth } from "@/lib/authExport";
import { randomUUID } from 'crypto';

// 🔥 强制清理前端缓存：确保不使用旧缓存
export const dynamic = 'force-dynamic';

/**
 * 管理后台 - 获取市场详情 API
 * GET /api/admin/markets/[market_id]
 * 
 * 返回指定市场的完整信息（用于编辑页面）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ market_id: string }> }
) {
  try {
    // 权限校验
    const authResult = await verifyAdminToken(request);

    if (!authResult.success) {
      return createUnauthorizedResponse(
        authResult.error || 'Unauthorized. Admin access required.',
        authResult.statusCode || 401
      );
    }

    const { market_id } = await params;

    // 🔥 使用 Prisma 直接查询，包含所有字段（包括赔率、描述、分类等）
    let dbMarket;
    try {
      dbMarket = await prisma.markets.findFirst({
        where: {
          id: market_id,
          isActive: true, // 只返回未删除的市场
        },
        include: {
          market_categories: {
            include: {
              categories: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      });

    } catch (dbError) {
      console.error('❌ [Admin Market GET] 数据库查询失败:');
      console.error('查询条件: market_id =', market_id);
      console.error('错误类型:', dbError instanceof Error ? dbError.constructor.name : typeof dbError);
      console.error('错误消息:', dbError instanceof Error ? dbError.message : String(dbError));
      console.error('错误堆栈:', dbError instanceof Error ? dbError.stack : 'N/A');
      throw dbError; // 重新抛出，让外层 catch 处理
    }

    if (!dbMarket) {
      console.error('❌ [Admin Market GET] 市场未找到或已删除:', market_id);
      return NextResponse.json(
        {
          success: false,
          error: "Market not found",
        },
        { status: 404 }
      );
    }

    // 格式化返回数据（安全处理新字段）
    try {
      // 🔥 安全处理新字段：确保 source、externalVolume 等字段有默认值（旧数据可能是 null）
      const source = dbMarket.source || 'INTERNAL';
      const externalVolume = dbMarket.externalVolume ?? 0;
      const internalVolume = dbMarket.internalVolume ?? 0;
      const manualOffset = dbMarket.manualOffset ?? 0;

      const marketData = {
        id: dbMarket.id,
      title: dbMarket.title,
      titleZh: dbMarket.titleZh || null,
      description: dbMarket.description || '',
      descriptionZh: dbMarket.descriptionZh || null,
      closingDate: dbMarket.closingDate.toISOString(),
      endTime: dbMarket.closingDate.toISOString(), // 兼容字段
      status: dbMarket.status,
      resolvedOutcome: dbMarket.resolvedOutcome,
      totalVolume: dbMarket.totalVolume,
      totalYes: dbMarket.totalYes,
      totalNo: dbMarket.totalNo,
      yesPercent: dbMarket.yesProbability !== null && dbMarket.yesProbability !== undefined
        ? dbMarket.yesProbability
        : (dbMarket.totalYes && dbMarket.totalNo
            ? Math.round((dbMarket.totalYes / (dbMarket.totalYes + dbMarket.totalNo)) * 100)
            : 50),
      noPercent: dbMarket.noProbability !== null && dbMarket.noProbability !== undefined
        ? dbMarket.noProbability
        : (dbMarket.totalYes && dbMarket.totalNo
            ? Math.round((dbMarket.totalNo / (dbMarket.totalYes + dbMarket.totalNo)) * 100)
            : 50),
      yesProbability: dbMarket.yesProbability,
      noProbability: dbMarket.noProbability,
      category: dbMarket.market_categories[0]?.categories?.name || dbMarket.category || null,
      categorySlug: dbMarket.market_categories[0]?.categories?.slug || dbMarket.categorySlug || null,
      categoryId: dbMarket.market_categories[0]?.categories?.id || null,
      // 🔥 返回所有分类信息（用于多选）
      categories: dbMarket.market_categories.map((mc: any) => ({
        id: mc.categories.id,
        name: mc.categories.name,
        slug: mc.categories.slug,
      })),
      feeRate: dbMarket.feeRate,
      imageUrl: (dbMarket as any).image || null, // 使用数据库的 image 字段
      externalId: (dbMarket as any).externalId || null, // 🔥 添加 externalId 字段
      isHot: (dbMarket as any).isHot || false, // 🔥 热门标记
      reviewStatus: dbMarket.reviewStatus || 'PENDING', // 🔥 审核状态
      createdAt: dbMarket.createdAt.toISOString(),
      updatedAt: dbMarket.updatedAt.toISOString(),
      // 🔥 添加新字段（安全处理 null 值）
      source: source as 'POLYMARKET' | 'INTERNAL',
      externalVolume,
      internalVolume,
      manualOffset,
      isActive: dbMarket.isActive ?? true,
      // 🚀 添加子市场详情所需字段
      outcomePrices: (dbMarket as any).outcomePrices || null,
      period: (dbMarket as any).period || null,
    };

      return NextResponse.json({
        success: true,
        data: marketData,
      });
    } catch (serializeError) {
      console.error('❌ [Admin Market GET] 序列化市场数据失败:');
      console.error('市场ID:', market_id);
      console.error('错误类型:', serializeError instanceof Error ? serializeError.constructor.name : typeof serializeError);
      console.error('错误消息:', serializeError instanceof Error ? serializeError.message : String(serializeError));
      console.error('错误堆栈:', serializeError instanceof Error ? serializeError.stack : 'N/A');
      throw serializeError; // 重新抛出，让外层 catch 处理
    }
  } catch (error) {
    console.error("❌ [Admin Market GET] 获取市场详情失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * 管理后台 - 更新市场信息 API
 * PUT /api/admin/markets/[market_id]
 * 
 * 请求体：
 * {
 *   title?: string;              // 市场标题（可选）
 *   description?: string;          // 市场描述（可选）
 *   endTime?: string;              // 截止日期 (ISO 8601 格式)（可选）
 *   image?: string;                // 头像 URL（可选）
 *   sourceUrl?: string;            // 信息来源链接（可选）
 *   resolutionCriteria?: string;  // 结算规则说明（可选）
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ market_id: string }> }
) {
  try {

    // 🔥 权限校验：使用 NextAuth session 验证管理员身份
    const session = await auth();
    
    // 🔥 调试日志：输出当前 Session 用户信息

    if (session?.user) {

    }
    
    // 🔥 核心修复：确保 session 存在且角色为 ADMIN
    if (!session || !session.user) {
      console.error('🚫 [Admin PUT] 权限拒绝: session 或 user 为空');
      return NextResponse.json(
        { 
          success: false,
          error: "Unauthorized. Admin access required." 
        },
        { status: 401 }
      );
    }
    
    // 🔥 双重校验：角色为 ADMIN 或邮箱为管理员邮箱
    const userRole = (session.user as any).role;
    const userEmail = session.user.email;
    const adminEmail = 'yesno@yesno.com'; // 管理员邮箱
    
    if (userRole !== 'ADMIN' && userEmail !== adminEmail) {
      console.error('🚫 [Admin PUT] 权限拒绝: 用户非管理员', { userRole, userEmail });
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized. Admin access required.",
        },
        { status: 401 }
      );
    }

    const { market_id } = await params;
    const body = await request.json();
    const { title, description, endTime, image, externalId, categoryIds, isHot, reviewStatus } = body;

    // 查找市场（使用 Prisma 直接查询，以便更新分类关联）
    const existingMarket = await prisma.markets.findFirst({
      where: {
        id: market_id,
        isActive: true,
      },
      include: {
        market_categories: true,
      },
    });

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

    // 🔥 准备更新数据（只更新提供的字段）
    const updateData: any = {};
    if (title) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || "";
    if (endTime) updateData.closingDate = endTime;
    if (image !== undefined) updateData.image = image?.trim() || null;
    if (externalId !== undefined) updateData.externalId = externalId?.trim() || null;
    // 🔥 修复'设为热门'保存：必须显式更新 isHot（即使为 false 也要更新）
    if (isHot !== undefined) {
      updateData.isHot = Boolean(isHot);

    }
    if (reviewStatus !== undefined) updateData.reviewStatus = reviewStatus; // 🔥 审核状态

    // 🔥 处理分类关联更新（如果提供了 categoryIds）
    if (categoryIds !== undefined && Array.isArray(categoryIds)) {
      // 先删除所有现有关联
      await prisma.market_categories.deleteMany({
        where: { marketId: market_id },
      });

      // 创建新的关联
      if (categoryIds.length > 0) {
        await prisma.market_categories.createMany({
          data: categoryIds.map((categoryId: string) => ({
            id: randomUUID(),
            marketId: market_id,
            categoryId: categoryId,
          })),
        });
      }
      
      // 🔥 修复热门标签逻辑：检查是否包含热门分类（ID=-1 或 slug="-1"）
      const hotCategory = await prisma.categories.findFirst({
        where: {
          OR: [
            { slug: '-1' },
            { slug: 'hot' },
            { name: { contains: '热门' } },
          ],
        },
        select: { id: true },
      });
      
      if (hotCategory && categoryIds.includes(hotCategory.id)) {
        // 如果分类列表中包含热门分类，自动设置 isHot = true
        updateData.isHot = true;

      } else if (categoryIds.length > 0) {
        // 如果分类列表中不包含热门分类，且 isHot 未显式提供，设置为 false
        if (isHot === undefined) {
          updateData.isHot = false;

        }
      }
    }

    // 使用 Prisma 直接更新市场信息
    const updatedMarket = await prisma.markets.update({
      where: { id: market_id },
      data: updateData,
      include: {
        market_categories: {
          include: {
            categories: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!updatedMarket) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to update market",
        },
        { status: 500 }
      );
    }

    // 格式化返回数据
    const formattedMarket = {
      id: updatedMarket.id,
      title: updatedMarket.title,
      description: updatedMarket.description || '',
      status: updatedMarket.status,
      categories: updatedMarket.market_categories.map((mc: any) => ({
        id: mc.categories.id,
        name: mc.categories.name,
        slug: mc.categories.slug,
      })),
      isHot: (updatedMarket as any).isHot || false,
      reviewStatus: updatedMarket.reviewStatus || 'PENDING',
    };

    return NextResponse.json({
      success: true,
      message: "Market updated successfully.",
      data: formattedMarket,
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

/**
 * 管理后台 - 删除市场（软删除）API
 * DELETE /api/admin/markets/[market_id]
 * 
 * 将市场的 isActive 设置为 false，实现软删除
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ market_id: string }> }
) {
  try {

    // 🔥 修复：使用与 GET/POST 路由相同的验证方式（NextAuth session）
    const session = await auth();
    
    // 🔥 核心修复：确保 session 存在且用户为管理员
    if (!session || !session.user) {
      console.error('❌ [Admin Market DELETE] Session 验证失败: session 或 user 为空');
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized. Admin access required.',
        },
        { status: 401 }
      );
    }
    
    // 🔥 双重校验：角色为 ADMIN 或邮箱为管理员邮箱
    const userRole = (session.user as any).role;
    const userEmail = session.user.email;
    const adminEmail = 'yesno@yesno.com'; // 管理员邮箱
    
    if (userRole !== 'ADMIN' && userEmail !== adminEmail) {
      console.error('❌ [Admin Market DELETE] 权限验证失败:', { userRole, userEmail });
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized. Admin access required.',
        },
        { status: 401 }
      );
    }

    const { market_id } = await params;

    // 检查市场是否存在且未删除
    const existingMarket = await prisma.markets.findFirst({
      where: {
        id: market_id,
        isActive: true,
      },
    });

    if (!existingMarket) {
      return NextResponse.json(
        {
          success: false,
          error: "Market not found or already deleted",
        },
        { status: 404 }
      );
    }

    // 软删除：将 isActive 设置为 false
    await prisma.markets.update({
      where: { id: market_id },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: "Market deleted successfully",
    });
  } catch (error) {
    console.error("❌ [Admin Market DELETE] 删除市场失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

