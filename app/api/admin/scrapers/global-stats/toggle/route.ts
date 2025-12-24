/**
 * 开启/关闭脚本 B（全网数据计算）
 * POST /api/admin/scrapers/global-stats/toggle
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma'; // 🔥 使用 default import

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // 🔥 暴力检查：确保 Prisma 客户端正确加载
    if (!prisma || !prisma.scraperTask) {
      throw new Error("数据库客户端 Prisma 未能正确加载");
    }

    const { action } = await req.json();
    
    if (action !== 'enable' && action !== 'disable') {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Must be "enable" or "disable".' },
        { status: 400 }
      );
    }

    const taskName = 'GlobalStats_Calc';
    const targetStatus = action === 'enable' ? 'NORMAL' : 'STOPPED';

    // 🔥 暴力三步法替代 upsert
    const existing = await prisma.scraperTask.findUnique({
      where: { name: taskName }
    });

    if (existing) {
      await prisma.scraperTask.update({
        where: { name: taskName },
        data: { 
          status: targetStatus,
          lastRunTime: new Date(),
          message: action === 'enable' ? '任务已启用' : '任务已停用'
        }
      });
    } else {
      await prisma.scraperTask.create({
        data: { 
          name: taskName, 
          status: targetStatus,
          lastRunTime: new Date(),
          frequency: 10,
          message: action === 'enable' ? '任务已启用' : '任务已停用'
        }
      });
    }

    // 更新 GlobalStat.isActive
    await prisma.globalStat.updateMany({
      where: { label: 'external_active_markets_count' },
      data: { isActive: action === 'enable' },
    });

    return NextResponse.json({ 
      success: true, 
      message: action === 'enable' ? '脚本 B 已开启' : '脚本 B 已关闭'
    });
  } catch (error: any) {
    console.error('❌ [Global Stats Toggle] 操作失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '操作失败' }, 
      { status: 500 }
    );
  }
}
