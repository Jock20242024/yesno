"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const categories = [
  { slug: "politics", label: "政治" },
  { slug: "sports", label: "体育" },
  { slug: "tech", label: "科技" },
  { slug: "finance", label: "商业" },
];

export default function MobileCategoryBar() {
  const pathname = usePathname();

  const getIsActive = (slug: string): boolean => {
    return pathname === `/category/${slug}`;
  };

  return (
    <div className="block md:hidden w-full overflow-x-auto no-scrollbar">
      <div className="flex gap-3 p-3 bg-black border-b border-zinc-800 sticky top-0 z-40">
        {categories.map((category) => {
          const isActive = getIsActive(category.slug);
          return (
            <Link
              key={category.slug}
              href={`/category/${category.slug}`}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                isActive
                  ? "bg-white text-black"
                  : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
              }`}
            >
              {category.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

