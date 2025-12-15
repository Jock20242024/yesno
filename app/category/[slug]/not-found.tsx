import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h1 className="text-4xl font-bold text-white">404</h1>
      <p className="text-pm-text-dim">分类不存在</p>
      <Link
        href="/"
        className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-[#18181b] font-bold transition-colors"
      >
        返回首页
      </Link>
    </div>
  );
}

