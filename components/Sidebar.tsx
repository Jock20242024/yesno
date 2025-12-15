"use client";

import { UserCircle, TrendingUp, BarChart3, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function Sidebar() {
  return (
    <aside className="lg:col-span-4 xl:col-span-3 flex flex-col gap-6 sticky top-24 h-fit">
      {/* 注册提示卡片 */}
      <div className="rounded-xl border border-primary bg-surface-dark p-6 shadow-[0_4px_20px_rgba(236,156,19,0.1)] relative overflow-hidden group">
        <div className="absolute -right-6 -top-6 size-24 bg-primary/10 rounded-full blur-xl"></div>
        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-white text-lg font-bold flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-primary" />
              开启您的预测之旅
            </h3>
            <p className="text-text-secondary text-sm">
              注册 YesNo 账户，即可参与全球数千个热门话题的预测交易。
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Link
              href="/login"
              className="w-full h-10 rounded-lg bg-primary hover:bg-primary-hover text-[#18181b] text-sm font-bold shadow-md transition-all flex items-center justify-center"
            >
              创建免费账户
            </Link>
            <Link
              href="/login"
              className="w-full h-10 rounded-lg bg-[#3f3f46] hover:bg-[#52525b] text-white text-sm font-bold border border-border-dark transition-all flex items-center justify-center"
            >
              已有账号？登录
            </Link>
          </div>
        </div>
      </div>

      {/* 新人福利卡片 */}
      <div className="relative overflow-hidden rounded-xl border border-border-dark bg-surface-dark group cursor-pointer">
        <div
          className="bg-cover bg-center h-48 w-full transition-transform duration-500 group-hover:scale-105"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(24, 24, 27, 0) 0%, rgba(24, 24, 27, 0.9) 100%), url("https://lh3.googleusercontent.com/aida-public/AB6AXuCnGlWcCxtjxTO-wwzz9JZHtVLYW2edfD42CdHXzrv3fP4Xcc0HDULq0CYuiwGlYmELPs8BPknh5JlfDbWxFFOM0RVWCDqgm7nPpzY8tXFig4IvNPn8UplPBYa320CfBu5Cq_bznBgkoUBd-eXxzRdtP2JuWQY9IMWquGZyFqX5zGiRj-WV_Jhz_Pz0BcFog802k6gXwjLAPtsR3lfcBmjpjpB2WFq4a37rgrLq9NQMbIjBs2d6lc5uZste2eb8NkozYDkmPplnb_l8")`,
          }}
        />
        <div className="absolute bottom-0 left-0 w-full p-5 flex flex-col gap-2">
          <div className="inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded bg-primary text-[#18181b] text-[10px] font-bold uppercase tracking-wider">
            新人限定
          </div>
          <h3 className="text-white text-lg font-bold leading-tight">
            注册即送 100 体验金
          </h3>
          <p className="text-text-secondary text-xs">
            零风险体验预测市场，盈利归您，亏损免单。
          </p>
          <div className="mt-2 flex items-center text-primary text-xs font-bold gap-1 group-hover:gap-2 transition-all">
            领取福利 <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* 实时数据统计 */}
      <div className="rounded-xl border border-border-dark bg-surface-dark p-5">
        <h3 className="text-white text-sm font-bold mb-4 flex items-center gap-2">
          <BarChart3 className="w-[18px] h-[18px] text-text-secondary" />
          预测市场实时数据
        </h3>
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center pb-3 border-b border-border-dark/50">
            <span className="text-text-secondary text-xs">24h 交易量</span>
            <span className="text-white font-mono font-medium">
              $12,405,920
            </span>
          </div>
          <div className="flex justify-between items-center pb-3 border-b border-border-dark/50">
            <span className="text-text-secondary text-xs">活跃预测事件</span>
            <span className="text-white font-mono font-medium">2,840</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-secondary text-xs">累计发放奖励</span>
            <span className="text-primary font-mono font-medium">$45M+</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

