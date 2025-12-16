"use client";

import { useEffect } from "react";
import TradeSidebar, { TradeSidebarRef } from "./TradeSidebar";

interface UserPosition {
  yesShares: number;
  noShares: number;
  yesAvgPrice: number;
  noAvgPrice: number;
}

interface MobileTradeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  yesPercent: number;
  noPercent: number;
  marketId: string | number; // Market ID 修复：支持 UUID 字符串格式，兼容旧的数字格式
  userPosition: UserPosition | null;
  marketTitle: string;
  marketStatus: "OPEN" | "RESOLVED";
  winningOutcome: "YES" | "NO" | null;
  activeTab: "buy" | "sell";
  onTabChange: (tab: "buy" | "sell") => void;
  amount: string;
  onAmountChange: (val: string) => void;
  feeRate: number;
  tradeSidebarRef: React.RefObject<TradeSidebarRef>;
}

export default function MobileTradeDrawer({
  isOpen,
  onClose,
  yesPercent,
  noPercent,
  marketId,
  userPosition,
  marketTitle,
  marketStatus,
  winningOutcome,
  activeTab,
  onTabChange,
  amount,
  onAmountChange,
  feeRate,
  tradeSidebarRef,
}: MobileTradeDrawerProps) {
  // 阻止背景滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="block lg:hidden fixed inset-0 z-50 bg-black/80"
      onClick={onClose}
    >
      <div 
        className="absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-2xl border-t border-zinc-800 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 关闭按钮 */}
        <div className="sticky top-0 z-10 flex items-center justify-end p-4 bg-zinc-900 border-b border-zinc-800">
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-zinc-800 transition-colors text-white"
            aria-label="关闭"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* TradeSidebar 内容 */}
        <div className="px-4 pb-6">
          <TradeSidebar
            ref={tradeSidebarRef}
            yesPercent={yesPercent}
            noPercent={noPercent}
            marketId={marketId}
            userPosition={userPosition}
            marketTitle={marketTitle}
            marketStatus={marketStatus}
            winningOutcome={winningOutcome}
            activeTab={activeTab}
            onTabChange={onTabChange}
            amount={amount}
            onAmountChange={onAmountChange}
            feeRate={feeRate}
          />
        </div>
      </div>
    </div>
  );
}

