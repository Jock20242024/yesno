import MarketTable from "@/components/MarketTable";
import MarketOverview from "@/components/MarketOverview";
import { MARKET_DATA } from "@/lib/data";
import { Globe, TrendingUp, Shield } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="layout-container flex h-full grow flex-col w-full lg:max-w-[1440px] lg:mx-auto px-4 lg:px-10 py-8">
      {/* Hero Section */}
      <section className="flex flex-col md:flex-row justify-between items-end gap-6 mb-10 pb-8 border-b border-border-dark">
        <div className="flex flex-col gap-4 max-w-[720px]">
          <h1 className="text-white text-3xl md:text-4xl lg:text-5xl font-black leading-tight tracking-tight">
            <span className="text-primary">预测未来</span>，赢取丰厚奖励
          </h1>
          <p className="text-text-secondary text-lg font-normal leading-normal max-w-[600px]">
            加入全球预测市场。不仅是旁观者，更是参与者。交易您对世界大事的看法，在每一份不确定中发现价值。
          </p>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-2 text-sm text-text-secondary bg-surface-dark px-3 py-1.5 rounded-full border border-border-dark">
              <Globe className="w-[18px] h-[18px] text-primary" />
              全球热点
            </div>
            <div className="flex items-center gap-2 text-sm text-text-secondary bg-surface-dark px-3 py-1.5 rounded-full border border-border-dark">
              <TrendingUp className="w-[18px] h-[18px] text-primary" />
              实时赔率
            </div>
            <div className="flex items-center gap-2 text-sm text-text-secondary bg-surface-dark px-3 py-1.5 rounded-full border border-border-dark">
              <Shield className="w-[18px] h-[18px] text-primary" />
              安全透明
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* 左侧：排行榜 - 75% */}
        <main className="lg:col-span-9 flex flex-col gap-6">
          <MarketTable data={MARKET_DATA} />
        </main>
        
        {/* 右侧：市场概览 - 25% */}
        <aside className="lg:col-span-3 flex flex-col gap-6">
          {/* 占位区域，与左侧标题区域高度一致 */}
          <div className="h-[52px]">
            {/* 空占位，确保右侧面板顶部边框与左侧表格容器顶部边框对齐 */}
          </div>
          <div className="sticky top-24">
            <MarketOverview />
          </div>
        </aside>
      </div>
    </div>
  );
}

