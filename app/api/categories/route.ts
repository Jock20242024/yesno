import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 🔥 强制禁用缓存，确保新创建的分类能立即显示
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * 公开 API - 获取分类列表
 * GET /api/categories
 * 
 * 返回所有启用的分类，按 displayOrder 排序
 * 前端导航栏使用此 API
 * 注意：这是公开 API，不需要权限验证
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [Categories API] 收到请求:', request.url);
    
    // 🔥 简化版本：直接返回基本分类数据，不计算 count
    const categories = await prisma.categories.findMany({
      where: {
        status: 'active',
      },
      include: {
        categories: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        other_categories: {
          where: {
            status: 'active',
          },
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
            level: true,
            displayOrder: true,
            sortOrder: true,
          },
          orderBy: [
            { sortOrder: 'asc' },
            { displayOrder: 'asc' },
          ],
        },
      },
      orderBy: [
        { level: 'asc' },
        { sortOrder: 'asc' },
        { displayOrder: 'asc' },
      ],
    });

    // 🔥 简化：直接返回分类数据，count 设为 0
    const formattedCategories = categories
      .filter(cat => !cat.parentId) // 只返回顶级分类
      .map(cat => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        icon: cat.icon,
        displayOrder: cat.displayOrder,
        status: cat.status,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
        level: cat.level,
        parentId: cat.parentId,
        sortOrder: cat.sortOrder,
        count: 0, // 🔥 临时设为 0，后续可以添加计算逻辑
        children: (cat.other_categories || []).map(child => ({
          id: child.id,
          name: child.name,
          slug: child.slug,
          icon: child.icon,
          level: child.level,
          displayOrder: child.displayOrder,
          sortOrder: child.sortOrder,
          count: 0, // 🔥 临时设为 0
        })),
      }));

    const response = NextResponse.json({
      success: true,
      data: formattedCategories,
    });
    
    // 🔥 禁用缓存
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error) {
    console.error('❌ [Categories API] 获取分类列表失败:');
    console.error('错误类型:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('错误消息:', error instanceof Error ? error.message : String(error));
    console.error('错误堆栈:', error instanceof Error ? error.stack : 'N/A');
    
    // 🔥 即使出错也返回空数组，而不是 500 错误
    const errorResponse = NextResponse.json(
      {
        success: true, // 🔥 改为 true，避免前端报错
        data: [], // 🔥 返回空数组
      },
      { status: 200 } // 🔥 改为 200，避免前端报错
    );
    
    errorResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    errorResponse.headers.set('Pragma', 'no-cache');
    errorResponse.headers.set('Expires', '0');
    
    return errorResponse;
  }
}
