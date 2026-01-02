import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MarketStatus } from '@prisma/client';
import { verifyAdminToken, createUnauthorizedResponse } from '@/lib/adminAuth';
import { auth } from '@/lib/authExport';

export const dynamic = "force-dynamic";

/**
 * 获取待审核市场列表
 * GET /api/admin/markets/review
 */
export async function GET(request: NextRequest) {
  try {
    // 🔥 修复：同时支持 NextAuth session 和 adminToken cookie
    let isAdmin = false;
    
    // 方案 1：检查 NextAuth session
    const session = await auth();
    if (session && session.user) {
      isAdmin = (session.user as any).isAdmin === true || (session.user as any).role === 'ADMIN';
    }
    
    // 方案 2：如果没有 NextAuth session，检查 adminToken
    if (!isAdmin) {
      const authResult = await verifyAdminToken(request);
      if (!authResult.success) {
        return createUnauthorizedResponse(
          authResult.error || 'Unauthorized. Admin access required.',
          authResult.statusCode || 401
        );
      }
      isAdmin = true;
    }
    
    if (!isAdmin) {
      return createUnauthorizedResponse(
        'Unauthorized. Admin access required.',
        401
      );
    }

    // 🔥 审核中心：强制仅显示 status === 'PENDING_REVIEW' 的市场（生肉区）

    // 先验证数据库中有多少条 PENDING_REVIEW 状态的市场
    // 🔥 使用枚举值，确保类型安全
    const totalPendingCount = await prisma.markets.count({
      where: {
        status: MarketStatus.PENDING_REVIEW,
        isActive: true,
      },
    });

    // 容错处理：如果查询失败或没有数据，返回空数组
    let pendingMarkets = [];
    try {
      pendingMarkets = await prisma.markets.findMany({
        where: {
          status: MarketStatus.PENDING_REVIEW, // 🔥 强制只显示 PENDING_REVIEW 状态的市场（使用枚举值）
          isActive: true, // 🔥 只返回未删除的市场
          // 🔥 注意：不添加 source 过滤，因为 PENDING_REVIEW 状态的市场可能来自任何来源
        },
        orderBy: {
          totalVolume: 'desc', // 按交易量降序排序，优先看到爆款
        },
        include: {
          market_categories: {
            include: {
              categories: {
                select: {
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      });

      if (pendingMarkets.length > 0) {

      }
    } catch (dbError) {
      console.error('❌ [Admin Review] 数据库查询失败:', dbError);
      console.error('❌ [Admin Review] 错误详情:', {
        errorType: dbError?.constructor?.name || 'Unknown',
        errorMessage: dbError instanceof Error ? dbError.message : String(dbError),
        errorStack: dbError instanceof Error ? dbError.stack : 'N/A',
      });
      // 🔥 如果查询失败，抛出错误而不是返回空数组，便于排查问题
      throw dbError;
    }

    // 转换为前端需要的格式（包含中文字段）
    const markets = pendingMarkets.map(market => ({
      id: market.id,
      title: market.title,
      titleZh: market.titleZh || null, // 中文标题
      description: market.description || '',
      descriptionZh: market.descriptionZh || null, // 中文描述
      category: market.market_categories[0]?.categories?.name || market.category || '未分类',
      totalVolume: market.totalVolume || 0,
      yesProbability: market.yesProbability !== null && market.yesProbability !== undefined 
        ? market.yesProbability 
        : 50,
      noProbability: market.noProbability !== null && market.noProbability !== undefined 
        ? market.noProbability 
        : 50,
      closingDate: market.closingDate.toISOString(),
      externalId: market.externalId,
      externalSource: market.externalSource,
      createdAt: market.createdAt.toISOString(),
    }));

    // 用户要求的日志输出已移除（生产环境应使用日志系统）

    // 始终返回成功，即使数据为空
    return NextResponse.json({
      success: true,
      data: markets || [], // 确保总是返回数组
    });
  } catch (error) {
    console.error('❌ [Admin Review] 获取待审核市场失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取数据失败',
      },
      { status: 500 }
    );
  }
}
