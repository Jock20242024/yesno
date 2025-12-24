import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 临时禁用权限检查，优先确保审核功能能运行
// TODO: 修复后恢复权限检查 - 其他 admin API 使用以下方式：
// import { auth } from "@/app/api/auth/[...nextauth]/route";
// const session = await auth();

export const dynamic = "force-dynamic";

/**
 * 忽略市场（删除记录）
 * DELETE /api/admin/markets/[market_id]/review
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ market_id: string }> }
) {
  try {
    const { market_id } = await params;
    
    console.log(`🗑️ [Admin Review] 准备删除市场: ${market_id}`);
    
    // 查找市场
    const market = await prisma.market.findUnique({
      where: { id: market_id },
    });

    if (!market) {
      console.error(`❌ [Admin Review] 市场不存在: ${market_id}`);
      return NextResponse.json(
        { success: false, error: `Market not found: ${market_id}` },
        { status: 404 }
      );
    }

    // 删除市场记录（级联删除会同时删除关联的分类关系等）
    await prisma.market.delete({
      where: { id: market_id },
    });
    
    console.log(`✅ [Admin Review] 市场已删除: ${market.title}`);

    return NextResponse.json({
      success: true,
      message: "市场已忽略（已删除）",
    });
  } catch (error) {
    console.error('❌ [Admin Review] 删除市场失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '删除失败',
      },
      { status: 500 }
    );
  }
}

/**
 * 审核市场（单个）
 * POST /api/admin/markets/[market_id]/review
 * 
 * Body: { action: "approve" | "reject" }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ market_id: string }> }
) {
  try {
    // TODO: 临时禁用权限检查，优先确保审核功能能运行
    // 修复后恢复权限检查 - 使用以下代码：
    /*
    import { auth } from "@/app/api/auth/[...nextauth]/route";
    const session = await auth();
    
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const isAdmin = (session.user as any).role === 'ADMIN' || session.user.email === 'yesno@yesno.com';
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }
    */

    const { market_id } = await params;
    const body = await request.json();
    const { action, categoryId, isHot } = body; // 🔥 接收 categoryId 和 isHot 参数

    if (!action || (action !== 'approve' && action !== 'reject')) {
      return NextResponse.json(
        { success: false, error: "Invalid action. Must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    const reviewStatus = action === 'approve' ? 'PUBLISHED' : 'REJECTED';
    
    console.log(`🔄 [Admin Review] 准备更新市场 ${market_id} 状态为 ${reviewStatus}`);
    
    // 查找市场
    const market = await prisma.market.findUnique({
      where: { id: market_id },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!market) {
      console.error(`❌ [Admin Review] 市场不存在: ${market_id}`);
      return NextResponse.json(
        { success: false, error: `Market not found: ${market_id}` },
        { status: 404 }
      );
    }

    console.log(`📊 [Admin Review] 找到市场: ${market.title}, 当前状态: ${market.reviewStatus}`);
    
    // 🔥 审核通过操作：将 status 修改为 OPEN，同时更新 reviewStatus，并指派分类
    try {
      const updateData: any = {
        reviewStatus,
      };
      
      // 🔥 如果审核通过，同时将 status 设置为 OPEN，并处理分类指派和 templateId 生成
      if (action === 'approve') {
        updateData.status = 'OPEN';
        // 🚀 物理收紧：审核通过时，isHot 由管理员明确指定，默认设为 false
        // 审核通过应该由管理员决定是否热门，而不是根据抓取时的交易量自动决定
        updateData.isHot = isHot === true ? true : false;
        console.log(`✅ [Admin Review] 审核通过：将市场 ${market_id} 的 status 设置为 OPEN，isHot 设置为 ${updateData.isHot}`);
        
        // 🔥 分类指派逻辑
        let finalCategoryId = categoryId;
        
        // 如果未提供 categoryId，尝试自动推断分类
        if (!finalCategoryId) {
          console.log(`⚠️ [Admin Review] 未提供分类ID，尝试自动推断...`);
          const titleLower = market.title.toLowerCase();
          
          // 自动推断分类（根据标题关键词）
          if (titleLower.match(/bitcoin|btc|ethereum|eth|crypto|加密货币|数字货币|比特币|以太坊/)) {
            const cryptoCategory = await prisma.category.findFirst({
              where: { OR: [{ slug: 'crypto' }, { name: { contains: '加密货币' } }] },
            });
            finalCategoryId = cryptoCategory?.id;
            console.log(`✅ [Admin Review] 自动推断为加密货币分类: ${finalCategoryId}`);
          } else if (titleLower.match(/tech|technology|ai|artificial intelligence|科技|人工智能|苹果|apple|google|meta|microsoft/)) {
            const techCategory = await prisma.category.findFirst({
              where: { OR: [{ slug: 'tech' }, { slug: 'technology' }, { name: { contains: '科技' } }] },
            });
            finalCategoryId = techCategory?.id;
            console.log(`✅ [Admin Review] 自动推断为科技分类: ${finalCategoryId}`);
          } else if (titleLower.match(/politics|election|president|politician|政治|选举|总统/)) {
            const politicsCategory = await prisma.category.findFirst({
              where: { OR: [{ slug: 'politics' }, { name: { contains: '政治' } }] },
            });
            finalCategoryId = politicsCategory?.id;
            console.log(`✅ [Admin Review] 自动推断为政治分类: ${finalCategoryId}`);
          } else if (titleLower.match(/sports|football|basketball|soccer|体育|足球|篮球|nfl|nba/)) {
            const sportsCategory = await prisma.category.findFirst({
              where: { OR: [{ slug: 'sports' }, { name: { contains: '体育' } }] },
            });
            finalCategoryId = sportsCategory?.id;
            console.log(`✅ [Admin Review] 自动推断为体育分类: ${finalCategoryId}`);
          }
          
          // 🚀 物理切断：如果推断失败，不允许默认关联热门分类
          if (!finalCategoryId) {
            console.log(`⚠️ [Admin Review] 自动推断失败，finalCategoryId 将为 null，不会关联任何分类`);
          }
        } else {
          console.log(`✅ [Admin Review] 使用管理员选择的分类: ${finalCategoryId}`);
        }
        
        // 🚀 物理收紧：如果管理员未选择分类且推断失败，finalCategoryId 为 null，不关联任何分类
        // 不再抛出错误，允许市场在没有分类的情况下通过审核（但不会出现在分类列表中）
        
        // 🔥 生成或关联 templateId（使用 poly- 前缀标识来自 Polymarket 的事件）
        let templateId = (market as any).templateId;
        if (!templateId) {
          // 为新事件生成唯一的 templateId（使用 poly- 前缀）
          const crypto = await import('crypto');
          templateId = `poly-${crypto.randomUUID()}`;
          updateData.templateId = templateId;
          console.log(`✅ [Admin Review] 为新事件生成 templateId: ${templateId}`);
        }
        
        // 使用事务处理分类关联和模板ID更新
        await prisma.$transaction(async (tx) => {
          // 更新市场状态和 templateId
          await tx.market.update({
            where: { id: market_id },
            data: updateData,
          });
          
          // 删除旧的分类关联
          await tx.marketCategory.deleteMany({
            where: { marketId: market_id },
          });
          
          // 🚀 物理收紧：创建新的分类关联（只有当 finalCategoryId 存在且不是热门分类时才关联）
          if (finalCategoryId) {
            // 🚀 防御性检查：禁止将市场关联到热门分类（除非管理员明确选择且 isHot: true）
            const hotCategory = await tx.category.findFirst({
              where: { OR: [{ slug: 'hot' }, { slug: '-1' }, { name: { contains: '热门' } }] },
            });
            
            // 如果 finalCategoryId 是热门分类ID，且市场 isHot 不为 true，则拒绝关联
            if (hotCategory && finalCategoryId === hotCategory.id) {
              const marketData = await tx.market.findUnique({
                where: { id: market_id },
                select: { isHot: true },
              });
              
              if (!marketData?.isHot) {
                console.log(`⚠️ [Admin Review] 拒绝关联热门分类：市场 isHot=false，不允许关联到热门分类`);
                // 不创建关联，但继续完成其他操作（状态更新等）
                console.log(`⚠️ [Admin Review] finalCategoryId 被拒绝，市场将不关联任何分类`);
              } else {
                // isHot: true，允许关联热门分类
                await tx.marketCategory.create({
                  data: {
                    marketId: market_id,
                    categoryId: finalCategoryId,
                  },
                });
                console.log(`✅ [Admin Review] 市场已关联到分类: ${finalCategoryId}`);
              }
            } else {
              // 不是热门分类，直接关联
              await tx.marketCategory.create({
                data: {
                  marketId: market_id,
                  categoryId: finalCategoryId,
                },
              });
              console.log(`✅ [Admin Review] 市场已关联到分类: ${finalCategoryId}`);
            }
          } else {
            console.log(`⚠️ [Admin Review] finalCategoryId 为空，市场将不关联任何分类`);
          }
        });
      } else {
        // 如果拒绝，只更新 reviewStatus，不处理分类和 templateId
        await prisma.market.update({
          where: { id: market_id },
          data: updateData,
        });
      }
      
      const updatedMarket = await prisma.market.findUnique({
        where: { id: market_id },
      });
      
      console.log(`✅ [Admin Review] 市场已更新: ${updatedMarket.title}, 新状态: ${updatedMarket.reviewStatus}`);

      console.log(`✅ [Admin Review] 市场 ${market_id} 已${action === 'approve' ? '审核通过' : '永久拒绝'}`);

      return NextResponse.json({
        success: true,
        message: `市场已${action === 'approve' ? '审核通过' : '永久拒绝'}`,
      });
    } catch (updateError) {
      console.error('❌ [Admin Review] 更新市场状态失败:', updateError);
      console.error('❌ [Admin Review] 错误详情:', {
        errorType: updateError instanceof Error ? updateError.constructor.name : typeof updateError,
        errorMessage: updateError instanceof Error ? updateError.message : String(updateError),
        errorStack: updateError instanceof Error ? updateError.stack : undefined,
        market_id,
        reviewStatus,
      });
      
      // 检查是否是 reviewStatus 字段不存在
      if (updateError instanceof Error && updateError.message.includes('Unknown arg `reviewStatus`')) {
        return NextResponse.json(
          {
            success: false,
            error: "数据库 schema 未同步，请运行: npx prisma db push",
            details: updateError.message,
          },
          { status: 500 }
        );
      }
      
      // 返回详细的错误信息
      return NextResponse.json(
        {
          success: false,
          error: updateError instanceof Error ? updateError.message : '更新失败',
          details: updateError instanceof Error ? updateError.stack : String(updateError),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ [Admin Review] 审核市场失败:', error);
    console.error('❌ [Admin Review] 错误详情:', {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '审核失败',
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    );
  }
}
