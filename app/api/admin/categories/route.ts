import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/app/api/auth/[...nextauth]/route";
import prisma from '@/lib/prisma';

export const dynamic = "force-dynamic";

/**
 * 管理后台 - 获取分类列表 API
 * GET /api/admin/categories
 * 
 * 返回所有启用的分类，按 displayOrder 排序
 */
export async function GET(request: NextRequest) {
  try {
    // 权限校验：使用 NextAuth session 验证管理员身份
    const session = await auth();
    
    // 🔥 修复 500 错误：确保 session 和 user 不为 null
    if (!session || !session.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized. Admin access required.',
        },
        { status: 401 }
      );
    }
    
    // 🔥 双重校验：角色为 ADMIN 或邮箱为管理员邮箱
    const userRole = (session.user as any).role;
    const userEmail = session.user.email;
    const adminEmail = 'yesno@yesno.com'; // 管理员邮箱
    
    if (userRole !== 'ADMIN' && userEmail !== adminEmail) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized. Admin access required.',
        },
        { status: 401 }
      );
    }

    // 🔥 运行时验证 prisma 实例
    if (!prisma || !prisma.category) {
      console.error('❌ [Categories API GET] Prisma client or category model is not available');
      return NextResponse.json(
        {
          success: false,
          error: 'Database connection error',
        },
        { status: 500 }
      );
    }

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
            level: true,
          },
          orderBy: {
            sortOrder: 'asc',
            displayOrder: 'asc', // 备用排序
          },
        },
      },
      orderBy: [
        { level: 'asc' },
        { sortOrder: 'asc' },
        { displayOrder: 'asc' }, // 备用排序
      ],
    });

    return NextResponse.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('获取分类列表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取分类列表失败',
      },
      { status: 500 }
    );
  }
}

/**
 * 管理后台 - 创建分类 API
 * POST /api/admin/categories
 * 
 * 请求体：
 * {
 *   name: string;        // 分类名称（必填）
 *   icon?: string;       // 图标名称（可选）
 *   displayOrder?: number; // 显示顺序（可选，默认为现有分类数量）
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 权限校验：使用 NextAuth session 验证管理员身份
    const session = await auth();
    
    // 🔥 修复 500 错误：确保 session 和 user 不为 null
    if (!session || !session.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized. Admin access required.',
        },
        { status: 401 }
      );
    }
    
    // 🔥 双重校验：角色为 ADMIN 或邮箱为管理员邮箱
    const userRole = (session.user as any).role;
    const userEmail = session.user.email;
    const adminEmail = 'yesno@yesno.com'; // 管理员邮箱
    
    if (userRole !== 'ADMIN' && userEmail !== adminEmail) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized. Admin access required.',
        },
        { status: 401 }
      );
    }

    // 🔥 运行时验证 prisma 实例
    if (!prisma || !prisma.category) {
      console.error('❌ [Categories API POST] Prisma client or category model is not available');
      return NextResponse.json(
        {
          success: false,
          error: 'Database connection error',
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { name, icon, displayOrder, sortOrder, parentId, status } = body;
    
    console.log(`📥 [Categories API POST] 接收到的数据:`, { 
      name, 
      icon, 
      displayOrder, 
      sortOrder, 
      parentId: parentId || 'null',
      status 
    });

    // 验证必填字段
    if (!name || !name.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: '分类名称不能为空',
        },
        { status: 400 }
      );
    }

    // 🔍 打印数据库中已有的所有分类（用于调试）
    const allCategories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
      },
    });
    console.log('📋 [Categories API POST] 数据库中已有的所有分类:');
    allCategories.forEach(cat => {
      console.log(`  - ID: ${cat.id}, Name: ${cat.name}, Slug: ${cat.slug}, ParentId: ${cat.parentId || 'null'}`);
    });

    // 检查分类名称是否已存在（名称必须唯一）
    const existingName = await prisma.category.findFirst({
      where: {
        name: name.trim(),
      },
    });

    if (existingName) {
      return NextResponse.json(
        {
          success: false,
          error: `分类名称 "${name.trim()}" 已存在`,
        },
        { status: 400 }
      );
    }

    // 生成基础 slug（从中文名称转换为 slug）
    let baseSlug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    
    // 自动处理 slug 冲突：如果 slug 已存在，在后面加上随机字符
    let finalSlug = baseSlug;
    let slugSuffix = 1;
    
    while (true) {
      const existingSlug = await prisma.category.findFirst({
        where: {
          slug: finalSlug,
        },
      });
      
      if (!existingSlug) {
        // slug 不存在，可以使用
        break;
      }
      
      // slug 已存在，生成新的 slug
      finalSlug = `${baseSlug}-${slugSuffix}`;
      slugSuffix++;
      
      // 防止无限循环（最多尝试100次）
      if (slugSuffix > 100) {
        // 如果100次都冲突，使用时间戳
        finalSlug = `${baseSlug}-${Date.now()}`;
        break;
      }
    }
    
    console.log(`✅ [Categories API POST] 生成的最终 slug: ${finalSlug} (基础: ${baseSlug})`);

    // 处理父级分类
    let finalParentId: string | null = null;
    let level = 0;
    
    if (parentId) {
      const parentCategory = await prisma.category.findUnique({
        where: { id: parentId },
      });
      
      if (!parentCategory) {
        return NextResponse.json(
          {
            success: false,
            error: '父级分类不存在',
          },
          { status: 400 }
        );
      }
      
      finalParentId = parentId;
      level = (parentCategory.level || 0) + 1;
    }

    // 如果没有指定 sortOrder，使用当前分类数量
    let finalSortOrder = displayOrder; // 兼容旧字段名
    if (finalSortOrder === undefined || finalSortOrder === null) {
      const categoryCount = await prisma.category.count({
        where: parentId ? { parentId: finalParentId } : { parentId: null },
      });
      finalSortOrder = categoryCount;
    }

    // 如果没有指定 displayOrder，使用 sortOrder 的值
    let finalDisplayOrder = displayOrder;
    if (finalDisplayOrder === undefined || finalDisplayOrder === null) {
      finalDisplayOrder = finalSortOrder;
    }

    // 创建分类
    console.log(`📝 [Categories API POST] 创建分类 - Name: ${name.trim()}, Slug: ${finalSlug}, ParentId: ${finalParentId || 'null'}, Level: ${level}`);
    
    const newCategory = await prisma.category.create({
      data: {
        name: name.trim(),
        slug: finalSlug,
        icon: icon || null,
        displayOrder: finalDisplayOrder,
        sortOrder: finalSortOrder,
        parentId: finalParentId, // 确保 parentId 正确保存
        level: level,
        status: 'active',
      },
    });
    
    console.log(`✅ [Categories API POST] 分类创建成功 - ID: ${newCategory.id}, ParentId: ${newCategory.parentId || 'null'}`);

    return NextResponse.json({
      success: true,
      data: newCategory,
    });
  } catch (error) {
    console.error('创建分类失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '创建分类失败',
      },
      { status: 500 }
    );
  }
}
