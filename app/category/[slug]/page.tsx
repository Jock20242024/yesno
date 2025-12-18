import { notFound } from "next/navigation";
import { CATEGORY_MAP } from "@/lib/categories";
import { CATEGORY_FILTERS_CONFIG } from "@/lib/constants/categoryFilters";
import CategoryClient from "./CategoryClient";

interface CategoryPageProps {
  params: {
    slug: string;
  };
}

export default function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = params;

  // 检查该分类是否有筛选配置
  const hasFilters = !!CATEGORY_FILTERS_CONFIG[slug];

  let categoryName: string;
  let pageTitle: string;

  // 确定分类名称
  if (slug === "all") {
    categoryName = "所有市场";
    pageTitle = "所有市场";
  } else if (slug === "trending") {
    categoryName = "热门";
    pageTitle = "热门趋势";
  } else {
    if (!CATEGORY_MAP[slug]) {
      notFound();
    }
    categoryName = CATEGORY_MAP[slug];
    pageTitle = categoryName;
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
