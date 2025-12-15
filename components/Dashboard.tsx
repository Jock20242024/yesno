"use client";

import { MARKET_DATA } from "@/lib/data";
import { Bitcoin, Building2, Trophy, DollarSign, Cpu, LucideIcon } from "lucide-react";
import { BarChart3, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";

const iconMap: Record<string, LucideIcon> = {
  Bitcoin,
  Building2,
  Trophy,
  DollarSign,
  Cpu,
};

export default function Dashboard() {
  const { isLoggedIn } = useAuth();
  const router = useRouter();

  const handleTradeClick = (e: React.MouseEvent, eventId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoggedIn) {
      router.push(`/login?redirect=/markets/${eventId}`);
    } else {
      router.push(`/markets/${eventId}`);
    }
  };

  return (
    <div className="flex flex-1 max-w-[1600px] mx-auto w-full">
      <main className="flex-1 min-w-0 flex flex-col">

        {/* Market Cards Grid */}
        <div className="p-4 md:p-6 flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {MARKET_DATA.map((event) => (
              <Link
                key={event.id}
                href={`/markets/${event.id}`}
                className="flex flex-col p-4 rounded-lg border border-border-dark bg-surface-dark hover:border-primary/40 transition-all cursor-pointer group relative overflow-hidden h-full"
              >
                <div className="flex flex-col h-full">
                  <div className="flex gap-4 mb-4">
                    <div className="w-14 h-14 rounded-md overflow-hidden flex-shrink-0">
                      {event.imageUrl ? (
                        <img
                          className="w-full h-full object-cover"
                          src={event.imageUrl}
                          alt={event.title}
                        />
                      ) : (
                        <div className={`w-full h-full ${event.iconColor} flex items-center justify-center`}>
                          {(() => {
                            const IconComponent = iconMap[event.icon];
                            return IconComponent ? (
                              <IconComponent className="w-7 h-7 text-white" />
                            ) : null;
                          })()}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <h3 className="text-white font-bold text-lg leading-snug line-clamp-2 group-hover:underline decoration-text-secondary/50 underline-offset-2 transition-all">
                        {event.title}
                      </h3>
                    </div>
                  </div>
                  <div className="mt-auto">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <button
                        onClick={(e) => handleTradeClick(e, event.id)}
                        className="relative flex items-center justify-between px-3 py-2.5 rounded-md bg-poly-green/10 hover:bg-poly-green/20 border border-transparent hover:border-poly-green/30 transition-all group/yes"
                      >
                        <span className="text-xs font-bold text-poly-green uppercase">
                          Yes
                        </span>
                        <span className="text-sm font-bold text-poly-green font-mono">
                          {event.yesPercent}%
                        </span>
                      </button>
                      <button
                        onClick={(e) => handleTradeClick(e, event.id)}
                        className="relative flex items-center justify-between px-3 py-2.5 rounded-md bg-poly-red/10 hover:bg-poly-red/20 border border-transparent hover:border-poly-red/30 transition-all group/no"
                      >
                        <span className="text-xs font-bold text-poly-red uppercase">
                          No
                        </span>
                        <span className="text-sm font-bold text-poly-red font-mono">
                          {event.noPercent}%
                        </span>
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-xs text-text-secondary font-medium">
                      <div className="flex items-center gap-1.5">
                        <span className="flex items-center gap-1 text-text-secondary">
                          <BarChart3 className="w-3 h-3 fill-current" />
                          {event.volume || "$0"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageCircle className="w-3 h-3 text-text-secondary" />
                        <span>{event.comments || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="flex justify-center py-10 opacity-70">
            <div className="flex flex-col items-center gap-2">
              <div className="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

