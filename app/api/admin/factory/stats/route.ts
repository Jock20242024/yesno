/**
 * 工厂运行统计 API
 * GET /api/admin/factory/stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/authExport';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

    // 获取所有模板
    const templates = await prisma.market_templates.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // 🔥 P0修复：统计所有运行中的模版（status = ACTIVE 或 isActive = true）
    // 只要在后台能看到模板正在运行，统计数字就必须正确
    // 简化逻辑：只要status是ACTIVE，或者isActive是true且status不是PAUSED，就统计
    const activeTemplatesCount = await prisma.market_templates.count({
      where: {
        OR: [
          { status: 'ACTIVE' }, // status明确为ACTIVE
          { 
            isActive: true, // isActive为true
            status: { not: 'PAUSED' }, // 且status不是PAUSED（可能是null或ACTIVE）
          },
        ],
      },
    });

    // 计算异常熔断数量（status = PAUSED）
    const pausedTemplates = templates.filter(t => {
      const status = (t as any).status || (t.isActive ? 'ACTIVE' : 'PAUSED');
      return status === 'PAUSED';
    }).length;

    // 计算今日生成总数（通过查询 today 创建的市场）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayMarkets = await prisma.markets.count({
      where: {
        createdAt: {
          gte: today,
        },
        source: 'INTERNAL', // 工厂创建的市场都是 INTERNAL
      },
    });

    // 🔥 获取心跳状态：最后工厂运行时间
    let lastFactoryRunAt: string | null = null;
    try {
      // 🔥 修复：直接使用 prisma.system_settings，与其他文件保持一致
      // 如果模型不存在，Prisma 会在运行时抛出错误，由 catch 捕获
      const heartbeatSetting = await prisma.system_settings.findUnique({
        where: { key: 'lastFactoryRunAt' },
      });
      lastFactoryRunAt = heartbeatSetting?.value || null;
    } catch (heartbeatError: any) {
      // 心跳获取失败不影响其他统计，只记录警告
      console.warn('⚠️ [Factory Stats API] 获取心跳状态失败:', heartbeatError.message);
      // 如果错误是因为模型不存在，提示需要运行 prisma generate
      if (heartbeatError.message?.includes('systemSettings') || heartbeatError.message?.includes('Cannot read properties')) {
        console.warn('⚠️ [Factory Stats API] 提示：如果 systemSettings 模型不存在，请运行: npx prisma generate');
      }
      lastFactoryRunAt = null; // 确保返回 null 而不是 undefined
    }

    return NextResponse.json({
      success: true,
      data: {
        activeTemplates: activeTemplatesCount, // 运行中的模版数量（直接从数据库查询）
        todayGenerated: todayMarkets, // 今日生成总数
        pausedTemplates, // 异常熔断数
        totalTemplates: templates.length, // 总模版数
        lastFactoryRunAt, // 🔥 最后工厂运行时间（心跳）
      },
    });
  } catch (error: any) {
    console.error('❌ [Factory Stats API] 获取统计失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
