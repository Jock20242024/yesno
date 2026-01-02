import { notFound } from "next/navigation";
// 🔥 物理隔离：移除外部配置依赖，使用本地判断
import CategoryClient from "./CategoryClient";
import prisma from '@/lib/prisma';

export const dynamic = "force-dynamic";

interface CategoryPageProps {
  params: Promise<{
    slug: string;
  }>;
}

/**
 * 动态分类页面
 * 所有分类共用的模板页面，根据 URL 中的 slug 参数从数据库查询分类信息
 * 如果找不到分类，返回 404 页面
 */
export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;

  // 🔥 恢复数据库子分类设计：移除硬编码的筛选配置判断
  // 所有子分类都从数据库读取，不需要硬编码判断

  let categoryName: string;
  let pageTitle: string;

  // 确定分类名称 - 支持特殊路由和数据库查询
  // 🔥 修复：支持数据库中的实际 slug（-1）以及常用别名（hot, trending）
  if (slug === "hot" || slug === "trending" || slug === "-1") {
    categoryName = "热门";
    pageTitle = "热门市场";
  } else {
    // 🔥 从数据库查询分类信息（动态路由）
    try {
      const category = await prisma.categories.findFirst({
        where: {
          slug: slug,
          status: 'active',
        },
      });

      if (!category) {
        console.error(`❌ [Category Page] 分类不存在: slug="${slug}"`);
        notFound(); // 返回 404 页面
      }

      categoryName = category.name;
      pageTitle = category.name;
    } catch (error) {
      console.error('❌ [Category Page] 查询分类失败:', error);
      notFound(); // 返回 404 页面
    }
  }

  return (
    <CategoryClient 
      slug={slug}
      categoryName={categoryName}
      pageTitle={pageTitle}
      hasFilters={false}
    />
  );
}
