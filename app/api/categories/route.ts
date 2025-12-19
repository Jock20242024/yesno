import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
    console.log('📋 [Categories API] 开始获取分类列表...');
    
    // 获取所有启用的分类，包含父子关系，按 level 和 displayOrder 排序
    const categories = await prisma.category.findMany({
      where: {
        status: 'active',
      },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        children: {
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
          },
          orderBy: {
            displayOrder: 'asc',
          },
        },
      },
      orderBy: [
        { level: 'asc' },
        { sortOrder: 'asc' },
        { displayOrder: 'asc' }, // 备用排序
      ],
    });

    console.log(`✅ [Categories API] 成功获取 ${categories.length} 个分类:`, categories.map(c => c.name));

    // 如果数据库为空，返回空数组（前端应该显示默认分类或提示）
    return NextResponse.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('❌ [Categories API] 获取分类列表失败:', error);
    // 开发环境下返回详细错误信息
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? (error instanceof Error ? error.message : '获取分类列表失败')
      : '获取分类列表失败';
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
