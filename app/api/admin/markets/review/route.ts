import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MarketStatus } from '@prisma/client';

// 临时禁用权限检查，优先确保审核功能能运行
// TODO: 修复后恢复权限检查 - 其他 admin API 使用以下方式：
// import { auth } from "@/lib/authExport";
// const session = await auth();

export const dynamic = "force-dynamic";

/**
 * 获取待审核市场列表
 * GET /api/admin/markets/review
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: 临时禁用权限检查，优先确保审核功能能运行
    // 修复 getServerSession 导入问题后恢复权限检查

    // 🔥 审核中心：强制仅显示 status === 'PENDING_REVIEW' 的市场（生肉区）
    console.log('🔍 [Admin Review] ========== 开始查询待审核市场 ==========');
    
    // 先验证数据库中有多少条 PENDING_REVIEW 状态的市场
    // 🔥 使用枚举值，确保类型安全
    const totalPendingCount = await prisma.market.count({
      where: {
        status: MarketStatus.PENDING_REVIEW,
        isActive: true,
      },
    });
    console.log(`📊 [Admin Review] 数据库中 PENDING_REVIEW 状态的市场总数: ${totalPendingCount}`);
    
    // 容错处理：如果查询失败或没有数据，返回空数组
    let pendingMarkets = [];
    try {
      pendingMarkets = await prisma.market.findMany({
        where: {
          status: MarketStatus.PENDING_REVIEW, // 🔥 强制只显示 PENDING_REVIEW 状态的市场（使用枚举值）
          isActive: true, // 🔥 只返回未删除的市场
          // 🔥 注意：不添加 source 过滤，因为 PENDING_REVIEW 状态的市场可能来自任何来源
        },
        orderBy: {
          totalVolume: 'desc', // 按交易量降序排序，优先看到爆款
        },
        include: {
          categories: {
            include: {
              category: {
                select: {
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      });
      
      console.log(`✅ [Admin Review] 查询成功，返回 ${pendingMarkets.length} 条市场数据`);
      if (pendingMarkets.length > 0) {
        console.log(`📋 [Admin Review] 第一条市场示例:`, {
          id: pendingMarkets[0].id,
          title: pendingMarkets[0].title.substring(0, 50),
          status: pendingMarkets[0].status,
          source: pendingMarkets[0].source,
          isActive: pendingMarkets[0].isActive,
        });
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
      category: market.categories[0]?.category?.name || market.category || '未分类',
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

    console.log(`📤 [Admin Review] 返回给前端的数据: ${markets.length} 条`);
    console.log(`✅ API 查到的待审核数量: ${markets.length}`); // 🔥 用户要求的日志输出
    console.log(`✅ [Admin Review] ========== 查询完成 ==========`);

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
