/**
 * 🔥 核弹清理接口 - 删除无法匹配 Polymarket ID 的工厂市场垃圾数据
 * DELETE /api/admin/factory/cleanup
 * 
 * 目标：清理掉结算监控中心里那些无法匹配 ID 的垃圾数据
 * 
 * 查询条件：
 * - isFactory: true（工厂市场）
 * - externalId 为 null（无法关联 Polymarket）
 * 🔥 注意：不限制状态，包括 OPEN, PENDING, CLOSED 等所有未结算状态
 * 
 * 动作：执行物理删除 (deleteMany)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { MarketStatus } from '@prisma/client';
import dayjs from '@/lib/dayjs';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  try {
    // 权限校验：使用 NextAuth session 验证管理员身份
    const session = await auth();
    
    if (!session || !session.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized. Admin access required.',
        },
        { status: 401 }
      );
    }
    
    const userRole = (session.user as any).role;
    const userEmail = session.user.email;
    const adminEmail = 'yesno@yesno.com';
    
    if (userRole !== 'ADMIN' && userEmail !== adminEmail) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized. Admin access required.',
        },
        { status: 401 }
      );
    }

    console.log('💣 [Cleanup] 开始执行核弹清理任务...');
    
    const now = dayjs.utc().toDate();
    
    // 🔥 修改：删除所有 isFactory=true 且 externalId=null 的工厂市场（无论状态如何）
    // 这些是无法匹配 Polymarket 的无效数据，应该全部清理
    const marketsToDelete = await prisma.market.findMany({
      where: {
        isFactory: true, // 工厂市场
        externalId: null, // 无法关联 Polymarket（这是关键条件）
        // 🔥 不限制状态：包括 OPEN, PENDING, CLOSED 等所有状态
      },
      select: {
        id: true,
        title: true,
        closingDate: true,
        status: true,
      },
    });
    
    const count = marketsToDelete.length;
    
    if (count === 0) {
      console.log('✅ [Cleanup] 没有需要清理的市场');
      return NextResponse.json({
        success: true,
        message: '没有需要清理的市场',
        deleted: 0,
        timestamp: new Date().toISOString(),
      });
    }
    
    console.log(`💣 [Cleanup] 找到 ${count} 个需要清理的市场`);
    console.log('📋 [Cleanup] 待删除市场列表（前10个）:', marketsToDelete.slice(0, 10).map(m => ({
      id: m.id,
      title: m.title,
      closingDate: m.closingDate.toISOString(),
      status: m.status,
    })));
    
    // 执行物理删除（与查询条件一致）
    const deleteResult = await prisma.market.deleteMany({
      where: {
        isFactory: true,
        status: {
          notIn: [MarketStatus.RESOLVED, MarketStatus.CANCELED],
        },
        externalId: null, // 🔥 只删除 externalId 为 null 的（无论是否过期）
      },
    });
    
    console.log(`✅ [Cleanup] 清理完成：删除了 ${deleteResult.count} 个市场`);
    
    return NextResponse.json({
      success: true,
      message: `清理完成：删除了 ${deleteResult.count} 个无法匹配 Polymarket ID 的工厂市场`,
      deleted: deleteResult.count,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ [Cleanup] 清理任务失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
