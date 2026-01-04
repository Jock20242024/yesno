"use client";

// 🔥 强制动态渲染：防止构建时数据请求失败
export const dynamic = 'force-dynamic';

import RankingTable from "@/components/RankingTable";
import MaxWinsSidebar from "@/components/MaxWinsSidebar";
import { useLanguage } from "@/i18n/LanguageContext";

export default function RankPage() {
  const { t } = useLanguage();
  return (
    <div className="flex-1 w-full max-w-[1600px] mx-auto px-6 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white">{t('rank.title')}</h1>
      </div>

      {/* 主内容区域 - 左右两栏布局 */}
      <div className="flex gap-8">
        {/* 左侧 - 主榜单 */}
        <div className="flex-1">
          <RankingTable />
        </div>

        {/* 右侧 - 侧边栏 */}
        <aside className="w-80 flex-shrink-0">
          <div className="sticky top-24">
            <MaxWinsSidebar />
          </div>
        </aside>
      </div>
    </div>
  );
}

