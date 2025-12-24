/**
 * 批量绑定ExternalId API
 * POST /api/admin/factory/batch-bind-external-id
 * 
 * 为所有没有 externalId 的 OPEN 工厂市场尝试绑定 externalId
 * 这是修复"工厂活跃池为0"问题的工具
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { MarketStatus } from '@prisma/client';
import { tryBindExternalId } from '@/lib/factory/engine';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 权限校验
    const session = await auth();
    
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const userRole = (session.user as any).role;
    const userEmail = session.user.email;
    const adminEmail = 'yesno@yesno.com';
    
    if (userRole !== 'ADMIN' && userEmail !== adminEmail) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 查找所有没有 externalId 的 OPEN 工厂市场
    // 🔥 修复：Prisma中查询null应该直接使用null，不需要包装
    const marketsToBind = await prisma.market.findMany({
      where: {
        isFactory: true,
        isActive: true,
        status: MarketStatus.OPEN,
        externalId: null, // ✅ 直接使用 null
        templateId: { not: null },
        period: { not: null },
        closingDate: { not: null },
      },
      select: {
        id: true,
        title: true,
        templateId: true,
        period: true,
        closingDate: true,
        marketTemplate: {
          select: {
            symbol: true,
          },
        },
      },
      take: 500, // 限制一次处理的数量
    });

    console.log(`🔍 [BatchBind] 找到 ${marketsToBind.length} 个需要绑定 externalId 的工厂市场`);

    const results = {
      total: marketsToBind.length,
      success: 0,
      failed: 0,
      errors: [] as Array<{ marketId: string; title: string; error: string }>,
    };

    // 批量处理
    for (const market of marketsToBind) {
      if (!market.templateId || !market.marketTemplate?.symbol || !market.period || !market.closingDate) {
        results.failed++;
        results.errors.push({
          marketId: market.id,
          title: market.title,
          error: '缺少必要字段（templateId、symbol、period 或 closingDate）',
        });
        continue;
      }

      try {
        const externalId = await tryBindExternalId(
          market.marketTemplate.symbol,
          market.period,
          new Date(market.closingDate)
        );

        if (externalId) {
          await prisma.market.update({
            where: { id: market.id },
            data: { externalId },
          });
          results.success++;
          console.log(`✅ [BatchBind] 市场 ${market.id} 成功绑定 externalId: ${externalId}`);
        } else {
          results.failed++;
          results.errors.push({
            marketId: market.id,
            title: market.title,
            error: 'tryBindExternalId 返回 null（Polymarket 中不存在对应市场）',
          });
        }
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          marketId: market.id,
          title: market.title,
          error: error.message || String(error),
        });
        console.error(`❌ [BatchBind] 市场 ${market.id} 绑定失败:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `批量绑定完成：成功 ${results.success} 个，失败 ${results.failed} 个`,
      data: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ [BatchBind] 批量绑定失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
