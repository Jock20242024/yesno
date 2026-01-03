import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/lib/authExport";
import { prisma } from "@/lib/prisma";
import { aggregateMarketsByTemplate, countUniqueMarketSeries } from '@/lib/marketAggregation'; // 🔥 使用公共聚合函数
import { BASE_MARKET_FILTER, buildHotMarketFilter } from '@/lib/marketQuery'; // 🚀 统一过滤器
import { randomUUID } from 'crypto';

// 🔥 强制禁用缓存，确保实时获取数据库数据
export const dynamic = 'force-dynamic';

/**
 * 管理后台 - 获取分类列表 API
 * GET /api/admin/categories
 * 
 * 返回所有分类，按 createdAt 降序排序
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
    const adminEmails = ['yesno@yesno.com', 'guanliyuan@yesno.com']; // 管理员邮箱列表
    
    // 检查是否为管理员：角色为 ADMIN 或邮箱在管理员列表中
    const isAdmin = userRole === 'ADMIN' || (userEmail && adminEmails.includes(userEmail));
    
    if (!isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized. Admin access required.',
        },
        { status: 401 }
      );
    }

    // 🔥 运行时验证 prisma 实例
    if (!prisma || !prisma.categories) {
      console.error('❌ [Categories API GET] Prisma client or category model is not available');
      return NextResponse.json(
        {
          success: false,
          error: 'Database connection error',
          data: []
        },
        { status: 500 }
      );
    }

    // 🔥 彻底清空后台分类接口过滤器：物理删除所有过滤，直接执行 findMany()
    // 确保返回数据库里所有分类记录，不管它有没有父类，不管它是什么状态

    // 🔥 修复：先查询所有分类，然后在应用层去重，避免数据库层面的重复
    const allCategories = await prisma.categories.findMany({
      include: {
        categories: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        other_categories: {
          select: {
            id: true,
            name: true,
            slug: true,
            level: true,
            displayOrder: true,
            sortOrder: true,
            status: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    // 🔥 修复：只返回顶级分类（parentId 为 null），子分类通过 children 字段显示
    // 这样可以避免子分类被重复显示（既作为独立行，又作为父分类的子分类）
    const topLevelCategories = allCategories.filter((cat: any) => !cat.parentId);
    
    // 🔥 去重：根据 id 去重，确保每个分类只出现一次
    const uniqueCategoriesMap = new Map();
    topLevelCategories.forEach((cat: any) => {
      if (!uniqueCategoriesMap.has(cat.id)) {
        // 对子分类也去重
        const uniqueChildrenMap = new Map();
        if (cat.other_categories && Array.isArray(cat.other_categories)) {
          cat.other_categories.forEach((child: any) => {
            const childId = String(child.id || '');
            if (!uniqueChildrenMap.has(childId)) {
              uniqueChildrenMap.set(childId, child);
            } else {
              // 🔥 调试：如果发现重复，打印日志
              console.warn(`⚠️ [Admin Categories] 发现重复的子分类: ${child.name} (${child.slug}), ID: ${childId}`);
            }
          });
        }
        uniqueCategoriesMap.set(cat.id, {
          ...cat,
          other_categories: Array.from(uniqueChildrenMap.values()),
        });
      }
    });
    
    const categories = Array.from(uniqueCategoriesMap.values());
    
    // 🔥 调试：打印分类结构
    console.log('📊 [Admin Categories] 顶级分类数量:', categories.length);
    categories.forEach((cat: any) => {
      console.log(`📁 [Admin Categories] 分类: ${cat.name} (${cat.slug}), 子分类数: ${cat.other_categories?.length || 0}`);
      if (cat.other_categories && cat.other_categories.length > 0) {
        cat.other_categories.forEach((child: any) => {
          console.log(`  └─ 子分类: ${child.name} (${child.slug}), ID: ${child.id}`);
        });
      }
    });

    // 🔥 调试：打印前3个分类的详细信息
    if (categories.length > 0) {

      categories.slice(0, 3).forEach((cat, index) => {

      });
    }

    // 🔥 处理 BigInt 序列化问题：确保所有数值字段都是 Number 类型
      const convertToNumber = (value: any): number => {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'bigint') {
        try { return Number(value); } catch { return 0; }
        }
        if (typeof value === 'string') {
          const parsed = parseFloat(value);
          return isNaN(parsed) ? 0 : parsed;
        }
        const num = Number(value);
        return isNaN(num) || !isFinite(num) ? 0 : num;
      };

    // 🔥 递归函数：获取分类及其所有子分类的 ID
    const getAllCategoryIds = (category: any, allCategories: any[]): string[] => {
      const ids = [category.id];
      const children = allCategories.filter(c => c.parentId === category.id);
      children.forEach(child => {
        ids.push(...getAllCategoryIds(child, allCategories));
      });
      return ids;
    };

    // 🔥 为每个分类计算基于 templateId 去重的市场数量
    const categoriesWithUniqueCount = await Promise.all(
      categories.map(async (category) => {
        try {
          // 🚀 核心修复：判断是否为热门分类（slug === "hot" 或 name === "热门"）
          const isHotCategory = category.slug === "hot" || category.slug === "-1" || category.name === "热门";
          
          // 🚀 热门分类：使用统一的 buildHotMarketFilter 函数（基于 isHot: true）
          // 非热门分类：使用 BASE_MARKET_FILTER + categoryId
          const whereCondition = isHotCategory 
            ? await buildHotMarketFilter()
            : {
                ...BASE_MARKET_FILTER,
                market_categories: {
                  some: {
                    categoryId: category.id
                  }
                }
              };

          // 🚀 使用统一的查询条件进行统计
          // 🚀 关键修复：必须查询与前端相同的字段，以便进行相同的时间过滤
          const marketsWithBaseFilter = await prisma.markets.findMany({
            where: whereCondition,
            select: {
              id: true,
              templateId: true,
              title: true,
              period: true,
              closingDate: true,
              status: true,
              isFactory: true,
            },
          });
          
          // 🚀 关键修复：后台统计必须使用与前端相同的聚合逻辑
          // 使用 aggregateMarketsByTemplate 而不是 countUniqueMarketSeries
          // 这样可以确保统计数量与前端显示数量完全一致（包括时间过滤）
          const { aggregateMarketsByTemplate } = await import('@/lib/marketAggregation');
          const aggregatedMarkets = aggregateMarketsByTemplate(marketsWithBaseFilter);
          const uniqueMarketCount = aggregatedMarkets.length;
          
          // 保留原有 markets 查询用于调试日志（如果需要）
          const markets = await prisma.markets.findMany({
            where: {
              ...BASE_MARKET_FILTER,
              market_categories: {
                some: {
                  categoryId: { in: getAllCategoryIds(category, categories) },
                },
              },
            },
            select: {
              id: true,
              templateId: true,
              isFactory: true,
              title: true,
              period: true,
              closingDate: true,
              status: true,
            },
          });

          const marketsWithTemplate = markets.filter(m => m.templateId);
          const independentMarkets = markets.filter(m => !m.templateId);
          const uniqueTemplateIds = new Set(marketsWithTemplate.map(m => m.templateId));

          return {
            ...category,
            uniqueMarketCount,
          };
        } catch (error) {
          console.error(`❌ [Admin Categories API] 计算分类 "${category.name}" 市场数量失败:`, error);
      return {
        ...category,
            uniqueMarketCount: 0,
          };
        }
      })
    );

    // 🔥 修复：再次过滤，只处理顶级分类（parentId 为 null）
    // 因为 categoriesWithUniqueCount 可能包含子分类，我们需要确保只返回顶级分类
    const topLevelCategoriesWithCount = categoriesWithUniqueCount.filter((cat: any) => !cat.parentId);
    
    // 🔥 简化处理：直接映射，确保不抛出任何错误
    const sanitizedCategories: any[] = [];
    
    for (const category of topLevelCategoriesWithCount) {
      try {
        const totalCount = (category as any).uniqueMarketCount || 0;
        
        // 🔥 安全处理所有字段，避免序列化错误（包括 Date 字段）
        const sanitizedCategory: any = {
          id: String(category.id || ''),
          name: String(category.name || ''),
          slug: String(category.slug || ''),
          icon: category.icon ? String(category.icon) : null,
        displayOrder: convertToNumber(category.displayOrder),
        sortOrder: convertToNumber(category.sortOrder || category.displayOrder),
        level: convertToNumber(category.level || 0),
          status: String(category.status || 'active'),
          parentId: category.parentId ? String(category.parentId) : null,
          marketCount: totalCount,
          publishedCount: totalCount,
          marketCountDisplay: `${totalCount}/${totalCount}`,
          // 🔥 处理 Date 字段，转换为 ISO 字符串
          createdAt: category.createdAt ? new Date(category.createdAt).toISOString() : null,
          updatedAt: category.updatedAt ? new Date(category.updatedAt).toISOString() : null,
        };
        
        // 🔥 安全处理 parent 对象（categories 关系）
        if (category.categories) {
          try {
            sanitizedCategory.parent = {
              id: String(category.categories.id || ''),
              name: String(category.categories.name || ''),
              slug: String(category.categories.slug || ''),
            };
          } catch {
            sanitizedCategory.parent = null;
          }
        } else {
          sanitizedCategory.parent = null;
        }
        
        // 🔥 修复：包含子分类数据（children），并去重
        if (category.other_categories && Array.isArray(category.other_categories) && category.other_categories.length > 0) {
          try {
            // 🔥 去重：使用 Map 根据 id 去重，避免重复显示
            const uniqueChildrenMap = new Map();
            category.other_categories.forEach((child: any) => {
              const childId = String(child.id || '');
              // 如果已存在相同 ID，保留第一个（或根据需求选择保留哪个）
              if (!uniqueChildrenMap.has(childId)) {
                uniqueChildrenMap.set(childId, {
                  id: childId,
                  name: String(child.name || ''),
                  slug: String(child.slug || ''),
                  level: convertToNumber(child.level || 0),
                  displayOrder: convertToNumber(child.displayOrder || 0),
                  sortOrder: convertToNumber(child.sortOrder || child.displayOrder || 0),
                  status: String(child.status || 'active'),
                });
              }
            });
            sanitizedCategory.children = Array.from(uniqueChildrenMap.values());
          } catch {
            sanitizedCategory.children = [];
          }
        } else {
          sanitizedCategory.children = [];
        }
        
        sanitizedCategories.push(sanitizedCategory);
      } catch (mapError: any) {
        console.error(`❌ [Admin Categories GET] 映射分类失败 (ID: ${category?.id}):`, mapError);
        // 跳过错误的分类，继续处理其他的
      }
    }

    // 2. 严格返回前端期待的结构
    try {
      const response = {
        success: true,
        data: sanitizedCategories
      };

      // 🔥 使用 JSON.stringify 验证数据是否可以序列化
      const jsonString = JSON.stringify(response);

      return NextResponse.json(response);
    } catch (jsonError: any) {
      console.error('❌ [Admin Categories GET] JSON 序列化失败:', jsonError);
      // 如果序列化失败，返回空数组
    return NextResponse.json({
      success: true,
        data: []
    });
    }
  } catch (error: any) {
    console.error("❌ [Admin Categories GET] 后台分类接口崩溃:");
    console.error('错误类型:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('错误消息:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error) {
      console.error('错误堆栈:', error.stack);
    }
    // 🔥 详细错误信息用于调试
    console.error('完整错误对象:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    return NextResponse.json({
      success: false,
      error: error.message || "获取分类列表失败",
      data: [],
      debug: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack,
      } : undefined,
    }, { status: 500 });
  }
}

/**
 * 管理后台 - 创建分类 API
 * POST /api/admin/categories
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
    const adminEmails = ['yesno@yesno.com', 'guanliyuan@yesno.com']; // 管理员邮箱列表
    
    // 检查是否为管理员：角色为 ADMIN 或邮箱在管理员列表中
    const isAdmin = userRole === 'ADMIN' || (userEmail && adminEmails.includes(userEmail));
    
    if (!isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized. Admin access required.',
        },
        { status: 401 }
      );
    }

    // 🔥 运行时验证 prisma 实例
    if (!prisma || !prisma.categories) {
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
    const allCategories = await prisma.categories.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
      },
    });

    allCategories.forEach(cat => {

    });

    // 🔥 数据库已允许 name 重名，代码层严禁再进行任何 name 字段的重复性校验
    // 🔥 只确保 slug 是唯一的即可（自动添加父类前缀作为 slug）

    // 🔥 处理父级分类（必须在生成 slug 之前处理）
    let finalParentId: string | null = null;
    let level = 0;
    let parentSlug: string | null = null;
    
    if (parentId) {
      const parentCategory = await prisma.categories.findUnique({
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
      parentSlug = parentCategory.slug; // 🔥 获取父分类的 slug
    }

    // 🔥 生成带前缀的 Slug：强制使用 父类Slug-用户输入名称 作为生成的 Slug
    // 例如：crypto-meizhou（即使名字都叫'每周'，Slug 也是唯一的）
    let finalSlug: string;
    
    if (finalParentId && parentSlug) {
      // 🔥 停止使用 Date.now() 做 Slug，使用 父类-名称 格式
      // 将用户输入的名称转换为 slug 格式（小写、替换空格为横线、保留中文字符）
      const childSlugPart = name.trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[<>:"|?*\\]/g, ''); // 只移除文件系统不安全的字符，保留中文字符
      let baseSlug = `${parentSlug}-${childSlugPart}`;
      
      // 🔥 检查 slug 是否已存在，如果存在则添加后缀
    let slugSuffix = 1;
      finalSlug = baseSlug;
    
    while (true) {
      const existingSlug = await prisma.categories.findFirst({
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
          // 如果100次都冲突，使用时间戳（最后的保险）
        finalSlug = `${baseSlug}-${Date.now()}`;
        break;
      }
    }
    } else {
      // 🔥 停止使用 Date.now() 做 Slug，顶级分类直接从名称转换（保留中文字符）
      const baseSlug = name.trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[<>:"|?*\\]/g, ''); // 只移除文件系统不安全的字符，保留中文字符
      
      let slugSuffix = 1;
      finalSlug = baseSlug;

      // 检查 slug 是否已存在
      while (true) {
        const existingSlug = await prisma.categories.findFirst({
          where: {
            slug: finalSlug,
          },
      });
      
        if (!existingSlug) {
          break;
        }
        
        finalSlug = `${baseSlug}-${slugSuffix}`;
        slugSuffix++;
        
        if (slugSuffix > 100) {
          // 如果100次都冲突，使用时间戳（最后的保险）
          finalSlug = `${baseSlug}-${Date.now()}`;
          break;
        }
      }
    }

    // 如果没有指定 sortOrder，使用当前分类数量
    let finalSortOrder = displayOrder; // 兼容旧字段名
    if (finalSortOrder === undefined || finalSortOrder === null) {
      const categoryCount = await prisma.categories.count({
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

    // 🔥 修复：确保新创建的分类状态默认为 'active'，这样前端才能立即显示
    const finalStatus = status && status.trim() ? status.trim() : 'active';
    
    const newCategory = await prisma.categories.create({
      data: {
        id: randomUUID(),
        name: name.trim(),
        slug: finalSlug,
        icon: icon || null,
        displayOrder: finalDisplayOrder,
        sortOrder: finalSortOrder,
        parentId: finalParentId, // 确保 parentId 正确保存
        level: level,
        status: finalStatus, // 🔥 确保状态为 'active'
        updatedAt: new Date(),
      },
    });
    
    // 🔥 调试：打印创建的分类信息
    console.log('✅ [Admin Categories POST] 创建分类成功:', {
      id: newCategory.id,
      name: newCategory.name,
      slug: newCategory.slug,
      status: newCategory.status,
      parentId: newCategory.parentId,
      level: newCategory.level,
    });

    return NextResponse.json({
      success: true,
      data: newCategory,
    });
  } catch (error: any) {
    console.error('❌ [Admin Categories POST] ========== 创建分类失败 ==========');
    console.error('错误类型:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('错误消息:', error instanceof Error ? error.message : String(error));
    
    // 🔥 深度打印错误对象
    console.error('❌ [Admin Categories POST] 错误对象完整详情:');
    console.dir(error, { depth: null, colors: true });
    
    // 打印错误堆栈
    if (error instanceof Error) {
      console.error('❌ [Admin Categories POST] 完整错误堆栈:');
      console.error(error.stack);
    }
    
    console.error('❌ [Admin Categories POST] ===============================');

    return NextResponse.json(
      {
        success: false,
        error: '创建分类失败',
        // 开发环境下返回详细错误信息
        ...(process.env.NODE_ENV === 'development' && error instanceof Error
          ? {
              details: error.message,
              stack: error.stack,
              name: error.name,
            }
          : {}),
      },
      { status: 500 }
    );
  }
}
