import { notFound } from "next/navigation";
import { CATEGORY_FILTERS_CONFIG } from "@/lib/constants/categoryFilters";
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

  // 检查该分类是否有筛选配置
  const hasFilters = !!CATEGORY_FILTERS_CONFIG[slug];

  let categoryName: string;
  let pageTitle: string;

  // 确定分类名称 - 支持特殊路由和数据库查询
  if (slug === "hot" || slug === "trending") {
    categoryName = "热门";
    pageTitle = "热门市场";
  } else {
    // 🔥 从数据库查询分类信息（动态路由）
    try {
      const category = await prisma.category.findFirst({
        where: {
          slug: slug,
          status: 'active',
        },
      });

      if (!category) {
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
      hasFilters={hasFilters}
    />
  );
}
