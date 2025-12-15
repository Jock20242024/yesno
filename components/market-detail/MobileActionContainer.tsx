'use client';

interface MobileActionContainerProps {
  onOpenTrade: (type: 'buy' | 'sell') => void;
}

export default function MobileActionContainer({ onOpenTrade }: MobileActionContainerProps) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-900 border-t border-zinc-800">
      <div className="flex gap-2 p-4">
        <button
          onClick={() => onOpenTrade('buy')}
          className="flex-1 py-4 bg-pm-green hover:bg-green-400 text-pm-bg font-bold rounded-xl transition-colors active:scale-[0.98]"
        >
          买入 (Buy)
        </button>
        <button
          onClick={() => onOpenTrade('sell')}
          className="flex-1 py-4 bg-pm-red hover:bg-red-500 text-white font-bold rounded-xl transition-colors active:scale-[0.98]"
        >
          卖出 (Sell)
        </button>
      </div>
    </div>
  );
}

