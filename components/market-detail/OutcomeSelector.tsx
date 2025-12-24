"use client";

import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { formatUSD } from "@/lib/utils";

interface OutcomeSelectorProps {
  yesPercent: number;
  noPercent: number;
  marketId: number;
}

export default function OutcomeSelector({
  yesPercent,
  noPercent,
  marketId,
}: OutcomeSelectorProps) {
  const { isLoggedIn } = useAuth();
  const router = useRouter();
  const yesPrice = formatUSD(yesPercent / 100);
  const noPrice = formatUSD(noPercent / 100);

  const handleTrade = (outcome: "yes" | "no") => {
    if (!isLoggedIn) {
      router.push(`/login?redirect=/markets/${marketId}`);
      return;
    }
    // TODO: 实现交易逻辑
    console.log("执行交易", outcome);
  };

  return (
    <div className="mb-12">
      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
        <span className="text-pm-green">●</span>
        预测选项
      </h3>
      <div className="flex flex-col gap-3">
        {/* Yes Option */}
        <div className="group relative flex items-center justify-between p-1 rounded-xl bg-pm-card border border-pm-border hover:border-pm-green/50 transition-all cursor-pointer overflow-hidden">
          <div className="flex-1 flex items-center justify-between p-3 relative z-10">
            <div className="flex items-center gap-4">
              <div className="size-10 rounded-full bg-pm-green flex items-center justify-center text-pm-bg shadow-glow-green">
                <Check className="w-5 h-5 font-bold" />
              </div>
              <span className="font-bold text-lg text-white">Yes</span>
            </div>
            <div className="flex items-center gap-8 mr-4">
              <div className="text-right">
                <div className="font-mono font-bold text-pm-green text-lg">
                  {yesPrice}
                </div>
                <div className="text-xs font-medium text-pm-green">+2.4%</div>
              </div>
            </div>
          </div>
          {/* 🔥 交易区尺寸缩小：YES/NO按钮缩小 */}
          <button
            onClick={() => handleTrade("yes")}
            className="relative z-10 bg-pm-green hover:bg-green-400 text-pm-bg font-bold py-2 px-4 text-sm rounded-lg mr-2 transition-colors shadow-lg shadow-pm-green/20"
          >
            {isLoggedIn ? "买入" : "登录以交易"}
          </button>
          <div
            className="absolute left-0 top-0 bottom-0 bg-pm-green-dim transition-all duration-700 ease-out border-r border-pm-green/20"
            style={{ width: `${yesPercent}%` }}
          />
        </div>

        {/* No Option */}
        <div className="group relative flex items-center justify-between p-1 rounded-xl bg-pm-card border border-pm-border hover:border-pm-red/50 transition-all cursor-pointer overflow-hidden">
          <div className="flex-1 flex items-center justify-between p-3 relative z-10">
            {/* 🔥 交易区尺寸缩小：NO选项缩小 */}
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-full bg-pm-card-hover border border-pm-border flex items-center justify-center text-pm-red shadow-inner">
                <X className="w-4 h-4 font-bold" />
              </div>
              <span className="font-bold text-base text-pm-text-dim group-hover:text-white transition-colors">
                No
              </span>
            </div>
            <div className="flex items-center gap-6 mr-3">
              <div className="text-right">
                <div className="font-mono font-bold text-pm-red text-base">
                  {noPrice}
                </div>
                <div className="text-xs font-medium text-pm-red">-1.2%</div>
              </div>
            </div>
          </div>
          {/* 🔥 交易区尺寸缩小：NO按钮缩小 */}
          <button
            onClick={() => handleTrade("no")}
            className="relative z-10 bg-pm-card-hover border border-pm-border hover:bg-pm-red hover:text-white hover:border-pm-red text-pm-text-dim font-bold py-2 px-4 text-sm rounded-lg ml-2 transition-all"
          >
            {isLoggedIn ? "买入" : "登录以交易"}
          </button>
          <div
            className="absolute left-0 top-0 bottom-0 bg-pm-red-dim transition-all duration-700 ease-out border-r border-pm-red/20"
            style={{ width: `${noPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

