import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/lib/authExport";
import prisma from '@/lib/prisma';

export const dynamic = "force-dynamic";

/**
 * 获取单个模板详情
 * GET /api/admin/factory/templates/[template_id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ template_id: string }> }
) {
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

    const { template_id } = await params;

    // 验证 UUID 格式
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(template_id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid template ID format' },
        { status: 400 }
      );
    }

    // 获取模板详情（包含所有字段）
    const template = await prisma.market_templates.findUnique({
      where: { id: template_id },
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    // 格式化返回数据，确保包含所有新字段
    const formattedTemplate = {
      ...template,
      nameZh: (template as any).nameZh || null, // 🔥 中文名称（人工翻译）
      titleTemplate: template.titleTemplate || null,
      displayTemplate: (template as any).displayTemplate || null, // 🔥 显示名称模板（中文模板）
      type: (template as any).type || 'UP_OR_DOWN',
      status: (template as any).status || (template.isActive ? 'ACTIVE' : 'PAUSED'),
      failureCount: (template as any).failureCount || 0,
      priceOffset: (template as any).priceOffset || 0,
      pauseReason: (template as any).pauseReason || null,
      categorySlug: template.categorySlug || null,
      externalIdPattern: template.externalIdPattern || null,
    };

    return NextResponse.json({
      success: true,
      data: formattedTemplate,
    });
  } catch (error: any) {
    console.error('获取模板详情失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 更新模板（完整更新）
 * PUT /api/admin/factory/templates/[template_id]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ template_id: string }> }
) {
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

    const { template_id } = await params;
    
    // 验证 UUID 格式
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(template_id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid template ID format' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { 
      name, 
      nameZh, // 🔥 中文名称（人工翻译）
      symbol, 
      period, 
      advanceTime, 
      oracleUrl, 
      isActive, 
      priceOffset,
      displayTemplate, // 🔥 显示名称模板（中文模板）
      titleTemplate, // 标题模板（英文模板）
    } = body;

    // 检查模板是否存在
    const existingTemplate = await prisma.market_templates.findUnique({
      where: { id: template_id },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    // 🔥 构建更新数据（强制数值字段转型，解决 500 错误）
    const updateData: any = {
      ...(name !== undefined && { name }),
      ...(symbol !== undefined && { symbol }),
      ...(period !== undefined && { period: Number(period) }), // 🔥 强制转型：period: Number(data.period)
      ...(advanceTime !== undefined && { advanceTime: Number(advanceTime) }), // 🔥 强制转型：relayTime (advanceTime): Number(data.advanceTime)
      ...(oracleUrl !== undefined && { oracleUrl: oracleUrl || null }),
      ...(isActive !== undefined && { isActive }),
      ...(priceOffset !== undefined && { priceOffset: Number(priceOffset) || 0 }), // 🔥 强制转型：strikePriceOffset (priceOffset): Number(data.strikePriceOffset)
      ...(displayTemplate !== undefined && { displayTemplate: displayTemplate || null }), // 🔥 显示名称模板
      ...(titleTemplate !== undefined && { titleTemplate: titleTemplate || null }), // 标题模板
    };

    // 如果禁用，同时将 status 设为 PAUSED；如果启用且状态是 PAUSED，设为 ACTIVE
    if (isActive !== undefined) {
      const currentStatus = (existingTemplate as any).status || (existingTemplate.isActive ? 'ACTIVE' : 'PAUSED');
      if (isActive) {
        updateData.status = currentStatus === 'PAUSED' ? 'ACTIVE' : currentStatus;
      } else {
        updateData.status = 'PAUSED';
      }
    }

    const updatedTemplate = await prisma.market_templates.update({
      where: { id: template_id },
      data: updateData,
    });

    // 格式化返回数据
    const formattedTemplate = {
      ...updatedTemplate,
      nameZh: (updatedTemplate as any).nameZh || null, // 🔥 中文名称（人工翻译）
      status: (updatedTemplate as any).status || (updatedTemplate.isActive ? 'ACTIVE' : 'PAUSED'),
      failureCount: (updatedTemplate as any).failureCount || 0,
      priceOffset: (updatedTemplate as any).priceOffset || 0,
      displayTemplate: (updatedTemplate as any).displayTemplate || null,
    };

    return NextResponse.json({
      success: true,
      data: formattedTemplate,
    });
  } catch (error: any) {
    console.error('更新模板失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 更新模板（部分更新，仅用于切换激活状态）
 * PATCH /api/admin/factory/templates/[template_id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ template_id: string }> }
) {
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

    const { template_id } = await params;
    
    // 验证 UUID 格式
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(template_id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid template ID format' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { isActive } = body;

    // 验证 isActive 参数
    if (typeof isActive !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'isActive must be a boolean' },
        { status: 400 }
      );
    }

    // 检查模板是否存在
    const existingTemplate = await prisma.market_templates.findUnique({
      where: { id: template_id },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    // 获取当前状态（兼容旧数据）
    const currentStatus = (existingTemplate as any).status || (existingTemplate.isActive ? 'ACTIVE' : 'PAUSED');

    // 更新模板的 isActive 状态
    const updateData: any = {
      isActive,
    };

    // 如果禁用，同时将 status 设为 PAUSED；如果启用且状态是 PAUSED，设为 ACTIVE
    if (isActive) {
      updateData.status = currentStatus === 'PAUSED' ? 'ACTIVE' : currentStatus;
    } else {
      updateData.status = 'PAUSED';
    }

    const updatedTemplate = await prisma.market_templates.update({
      where: { id: template_id },
      data: updateData,
    });

    // 格式化返回数据
    const formattedTemplate = {
      ...updatedTemplate,
      status: (updatedTemplate as any).status || (updatedTemplate.isActive ? 'ACTIVE' : 'PAUSED'),
      failureCount: (updatedTemplate as any).failureCount || 0,
      priceOffset: (updatedTemplate as any).priceOffset || 0,
    };

    return NextResponse.json({
      success: true,
      data: formattedTemplate,
    });
  } catch (error: any) {
    console.error('更新模板失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
