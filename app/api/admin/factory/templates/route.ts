import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/app/api/auth/[...nextauth]/route";
import prisma from '@/lib/prisma';
import dayjs from '@/lib/dayjs';
import { getStartTime } from '@/lib/factory/engine';

export const dynamic = "force-dynamic";

/**
 * 🔥 临时清空所有模板数据
 * DELETE /api/admin/factory/templates
 */
export async function DELETE(request: NextRequest) {
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

    // 🔥 物理清空所有模板数据
    const result = await prisma.marketTemplate.deleteMany({});
    
    return NextResponse.json({
      success: true,
      message: `已删除 ${result.count} 个模板`,
      deletedCount: result.count,
    });
  } catch (error: any) {
    console.error('清空模板失败:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 获取所有模板
 * GET /api/admin/factory/templates
 */
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

    // 🔥 周期与价格规则排序：按 period 从小到大排序（按时间权重）
    // 显示效果：15 分钟 (15) → 1 小时 (60) → 4 小时 (240) → 1 天 (1440) → 一周 (10080)
    const templates = await prisma.marketTemplate.findMany({
      orderBy: { period: 'asc' }, // 按周期从小到大排序
    });

    // 🚀 优化：为每个模板计算真实的业务健康度（healthStatus）- 基于未来储备
    const now = dayjs.utc().toDate();
    const formattedTemplates = await Promise.all(templates.map(async (t) => {
      // 🚀 优化：检查未来储备（而非当前这一秒）
      // 查询所有OPEN状态的工厂市场
      const futureMarkets = await prisma.market.findMany({
        where: {
          templateId: t.id,
          isFactory: true,
          status: 'OPEN',
          reviewStatus: 'PUBLISHED',
          isActive: true,
        },
        select: {
          closingDate: true,
        },
      });

      // 🚀 优化：计算未来场次数量（startTime > now）
      // startTime = closingDate - period
      // 只要未来有至少1个场次，就算健康（不关心当前这一秒的误差）
      let futureMarketCount = 0;
      for (const market of futureMarkets) {
        const startTime = getStartTime(market.closingDate, t.period);
        if (startTime > now) {
          futureMarketCount++;
        }
      }

      // 🚀 优化：计算healthStatus（基于未来储备）
      // HEALTHY: 未来有至少1个场次（count(startTime > now) >= 1），哪怕当前断了，只要未来有货就算健康
      // GAP: 未来完全没有场次（count(startTime > now) == 0），这才是真正的危机
      const healthStatus = futureMarketCount >= 1 ? 'HEALTHY' : 'GAP';

      return {
        ...t,
        nameZh: (t as any).nameZh || null, // 🔥 中文名称（人工翻译）
        status: (t as any).status || (t.isActive ? 'ACTIVE' : 'PAUSED'), // 兼容旧数据
        failureCount: (t as any).failureCount || 0,
        priceOffset: (t as any).priceOffset || 0,
        pauseReason: (t as any).pauseReason || null,
        healthStatus, // 🚀 优化：添加健康度状态（基于未来储备）
      };
    }));

    return NextResponse.json({
      success: true,
      data: formattedTemplates,
    });
  } catch (error) {
    console.error('获取模板列表失败:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 创建新模板
 * POST /api/admin/factory/templates
 */
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

    const body = await request.json();
    const { 
      name, 
      nameZh, // 🔥 中文名称（人工翻译）
      titleTemplate, 
      displayTemplate, // 🔥 显示名称模板（中文模板）
      symbol, 
      period, 
      categorySlug,
      advanceTime, 
      priceOffset,
      externalIdPattern,
      oracleUrl, 
      isActive 
    } = body;

    // 验证必填字段
    if (!name || !symbol || !period) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, symbol, period' },
        { status: 400 }
      );
    }

    const periodNum = Number(period);
    const templateType = 'UP_OR_DOWN'; // 默认类型

    // 🔥 唯一性检查：只有当 symbol、period、type 完全一致时才提示冲突
    // 如果标的不同（如 BTC vs ETH），必须允许同时存在
    const existingTemplate = await prisma.marketTemplate.findFirst({
      where: {
        symbol: symbol.trim(), // 🔥 精确匹配 symbol
        period: periodNum,
        type: templateType,
      },
    });

    if (existingTemplate) {
      // 🔥 如果已存在完全相同的组合，返回错误而不是自动更新
      return NextResponse.json(
        {
          success: false,
          error: `已存在相同的模板：symbol="${symbol}", period=${periodNum}, type=${templateType}。请使用编辑功能更新现有模板，或选择不同的标的/周期组合。`,
        },
        { status: 400 }
      );
    }

    // 🔥 正常创建新模板（Create 必须是独立的操作）
    const template = await prisma.marketTemplate.create({
      data: {
        name, // 必须传，不能为 null
        nameZh: nameZh || null, // 🔥 中文名称（人工翻译）
        titleTemplate: titleTemplate || null, // 🔥 模板标题（支持占位符）
        displayTemplate: displayTemplate || null, // 🔥 显示名称模板（中文模板，用于人工预设翻译）
        symbol: symbol.trim(), // 🔥 必须传，去除首尾空格
        period: periodNum, // 🔥 强制转型：period: Number(data.period)，必须为 Int
        type: templateType, // 🔥 Schema 中有默认值，但创建时必须明确指定
        categorySlug: categorySlug || null, // 🔥 关联分类
        advanceTime: advanceTime ? Number(advanceTime) : 120, // 🔥 强制转型：advanceTime (relayTime): Number(data.advanceTime)，必须为 Int
        externalIdPattern: externalIdPattern || null, // 🔥 对标外部URL模式
        oracleUrl: oracleUrl || null,
        isActive: isActive !== undefined ? isActive : true,
        status: 'ACTIVE', // 🔥 默认状态为 ACTIVE
        failureCount: 0, // 🔥 初始失败计数为 0
        // 🔥 注意：Schema 中没有 priceOffset 字段，不要传
      },
    });

    console.log(`✅ [Template Create] 模板已创建: ${template.id}, symbol="${template.symbol}", period=${template.period}`);

    return NextResponse.json({
      success: true,
      data: template,
      message: '模板创建成功',
    });
  } catch (error: any) {
    console.error('创建模板失败:', error);
    console.error('错误详情:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });
    
    // 🔥 已删除唯一约束，允许创建重复的 symbol+period+type 组合
    // 不再返回 "Template already exists" 错误
    
    // 🔥 返回详细错误信息以便调试
    return NextResponse.json(
      { 
        success: false, 
        error: error?.message || 'Internal server error',
        // 开发环境下返回更多信息
        ...(process.env.NODE_ENV === 'development' && {
          details: error?.message,
          stack: error?.stack,
        }),
      },
      { status: 500 }
    );
  }
}
