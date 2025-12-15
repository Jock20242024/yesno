"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { MarketEvent } from "@/lib/data";
import {
  Bitcoin,
  Building2,
  Flag,
  Rocket,
  Bot,
  Coins,
  Mic,
  Globe,
  Activity,
  Film,
  LucideIcon,
  BarChart3,
  MessageCircle,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Bitcoin,
  Building2,
  Flag,
  Rocket,
  Bot,
  Coins,
  Mic,
  Globe,
  Activity,
  Film,
};

interface MarketCardProps {
  event: MarketEvent;
}

export default function MarketCard({ event }: MarketCardProps) {
  const { isLoggedIn } = useAuth();
  const router = useRouter();
  const IconComponent = iconMap[event.icon] || Bitcoin;

  const handleTradeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoggedIn) {
      router.push(`/login?redirect=/markets/${event.id}`);
    } else {
      router.push(`/markets/${event.id}`);
    }
  };

  return (
    <Link
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
              <div
                className={`w-full h-full ${event.iconColor} flex items-center justify-center`}
              >
                <IconComponent className="w-7 h-7 text-white" />
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
              onClick={handleTradeClick}
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
              onClick={handleTradeClick}
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
  );
}
