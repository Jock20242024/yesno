"use client";

interface MobileActionBarProps {
  onBuyClick: () => void;
  onSellClick: () => void;
  yesPercent: number;
  noPercent: number;
}

export default function MobileActionBar({
  onBuyClick,
  onSellClick,
  yesPercent,
  noPercent,
}: MobileActionBarProps) {
  return (
    <div className="block lg:hidden fixed bottom-0 left-0 w-full p-4 bg-zinc-900 border-t border-zinc-800 z-50">
      <div className="grid grid-cols-2 gap-3 max-w-[600px] mx-auto">
        <button
          onClick={onBuyClick}
          className="flex flex-col items-center justify-center py-4 px-4 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white font-bold transition-colors active:scale-[0.98]"
        >
          <span className="text-lg font-black uppercase mb-1">买入</span>
          <span className="text-xs opacity-90 font-medium">Yes {yesPercent}%</span>
        </button>
        <button
          onClick={onSellClick}
          className="flex flex-col items-center justify-center py-4 px-4 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold transition-colors active:scale-[0.98]"
        >
          <span className="text-lg font-black uppercase mb-1">卖出</span>
          <span className="text-xs opacity-90 font-medium">No {noPercent}%</span>
        </button>
      </div>
    </div>
  );
}

