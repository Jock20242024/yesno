import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/app/api/auth/[...nextauth]/route";
import prisma from '@/lib/prisma';

export const dynamic = "force-dynamic";

/**
 * 更新分类
 * PUT /api/admin/categories/[category_id]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ category_id: string }> }
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

    const { category_id } = await params;
    const body = await request.json();
    const { name, icon, displayOrder, sortOrder, parentId, status } = body;

    // 查找现有分类
    const existingCategory = await prisma.category.findUnique({
      where: { id: category_id },
    });

    if (!existingCategory) {
      return NextResponse.json(
        { success: false, error: '分类不存在' },
        { status: 404 }
      );
    }

    // 处理父级分类
    let finalParentId: string | null = existingCategory.parentId || null;
    let level = existingCategory.level || 0;
    
    if (parentId !== undefined) {
      if (parentId === null || parentId === '') {
        finalParentId = null;
        level = 0;
      } else {
        // 防止将自己设置为父级（循环引用）
        if (parentId === category_id) {
          return NextResponse.json(
            { success: false, error: '不能将自己设置为父级分类' },
            { status: 400 }
          );
        }

        const parentCategory = await prisma.category.findUnique({
          where: { id: parentId },
        });
        
        if (!parentCategory) {
          return NextResponse.json(
            { success: false, error: '父级分类不存在' },
            { status: 400 }
          );
        }
        
        // 防止将子分类设置为父级（循环引用）
        const isDescendant = await checkIfDescendant(category_id, parentId);
        if (isDescendant) {
          return NextResponse.json(
            { success: false, error: '不能将子分类设置为父级分类' },
            { status: 400 }
          );
        }
        
        finalParentId = parentId;
        level = (parentCategory.level || 0) + 1;
      }
    }

    // 生成 slug（如果名称改变）
    let slug = existingCategory.slug;
    if (name && name.trim() !== existingCategory.name) {
      slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      
      // 检查新 slug 是否已存在（排除自己）
      const existingSlug = await prisma.category.findFirst({
        where: {
          slug: slug,
          id: { not: category_id },
        },
      });
      
      if (existingSlug) {
        return NextResponse.json(
          { success: false, error: '该分类名称已存在' },
          { status: 400 }
        );
      }
    }

    // 更新分类
    const updatedCategory = await prisma.category.update({
      where: { id: category_id },
      data: {
        ...(name && { name: name.trim() }),
        ...(slug !== existingCategory.slug && { slug }),
        ...(icon !== undefined && { icon: icon || null }),
        ...(displayOrder !== undefined && { displayOrder: parseInt(displayOrder) }),
        ...(sortOrder !== undefined && { sortOrder: parseInt(sortOrder) }),
        ...(finalParentId !== existingCategory.parentId && { 
          parentId: finalParentId,
          level: level,
        }),
        ...(status !== undefined && { status }),
      },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedCategory,
    });
  } catch (error) {
    console.error('更新分类失败:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 删除分类
 * DELETE /api/admin/categories/[category_id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ category_id: string }> }
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

    const { category_id } = await params;

    // 检查是否有子分类
    const childrenCount = await prisma.category.count({
      where: { parentId: category_id },
    });

    if (childrenCount > 0) {
      return NextResponse.json(
        { success: false, error: '该分类下有子分类，无法删除' },
        { status: 400 }
      );
    }

    // 删除分类
    await prisma.category.delete({
      where: { id: category_id },
    });

    return NextResponse.json({
      success: true,
      message: '分类删除成功',
    });
  } catch (error) {
    console.error('删除分类失败:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 检查 parentId 是否是 categoryId 的后代（防止循环引用）
 */
async function checkIfDescendant(categoryId: string, potentialParentId: string): Promise<boolean> {
  let currentParentId = potentialParentId;
  const visited = new Set<string>();
  
  while (currentParentId) {
    if (visited.has(currentParentId)) {
      break; // 检测到循环
    }
    
    if (currentParentId === categoryId) {
      return true; // 找到了 categoryId，说明是后代
    }
    
    visited.add(currentParentId);
    
    const parent = await prisma.category.findUnique({
      where: { id: currentParentId },
      select: { parentId: true },
    });
    
    if (!parent || !parent.parentId) {
      break; // 到达根节点
    }
    
    currentParentId = parent.parentId;
  }
  
  return false;
}
