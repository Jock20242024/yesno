"use client";

import React from "react";
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
  Trophy,
} from "lucide-react";
import { EthereumIcon } from "./icons/EthereumIcon";

// 🔥 扩展 iconMap 类型以支持自定义组件
type IconComponent = LucideIcon | React.ComponentType<{ className?: string }>;

const iconMap: Record<string, IconComponent> = {
  Bitcoin,
  Ethereum: EthereumIcon, // 🔥 使用自定义以太坊图标（多面钻石形状）
  Building2,
  Flag,
  Rocket,
  Bot,
  Coins,
  Mic,
  Globe,
  Activity,
  Film,
  Trophy,
};

interface MarketCardProps {
  event: MarketEvent;
}

export default function MarketCard({ event }: MarketCardProps) {
  const { isLoggedIn } = useAuth();
  const router = useRouter();
  
  // 🚀 优先级 1: 物理提取原始配图（解决 Elon Musk 头像消失问题）
  const getImageSrc = (): string | null => {
    const m = event as any;
    const originalImage = m.originalImage || m.scrapedImage || m.image || m.iconUrl;
    if (originalImage && originalImage.trim() !== '' && originalImage !== '/default-icon.png') {
      return originalImage;
    }
    return null;
  };

  // 🚀 优先级 2 & 3: 图标与颜色匹配逻辑
  const getIconConfig = () => {
    const m = event as any;
    // 🔥 核心修复：独立市场（templateId === null）必须根据分类显示图标
    if (!m.templateId) {
      // 优先级 3: 独立市场，根据分类显示图标（物理还原政治/体育/科技图标）
      const category = (m.category || event.category || '').toLowerCase();
      if (category.includes('政治') || category.includes('politic')) return { name: 'Building2', color: 'bg-blue-800' };
      if (category.includes('体育') || category.includes('sport')) return { name: 'Trophy', color: 'bg-orange-600' };
      if (category.includes('科技') || category.includes('tech')) return { name: 'Bot', color: 'bg-purple-600' };
      return { name: 'Bitcoin', color: 'bg-[#f7931a]' };
    }
    
    // 优先级 2: 工厂市场（加密货币）图标
    if (m.templateId || m.isFactory) {
      const symbol = (m.symbol || m.asset || '').toUpperCase();
      const title = (m.title || event.title || '').toUpperCase();
      
      // 🔥 物理区分 BTC 与 ETH 图标
      // 比特币 (BTC)：symbol 或 title 包含 'BTC' 或 '比特币'
      if (symbol.includes('BTC') || title.includes('BTC') || title.includes('比特币')) {
        return { name: 'Bitcoin', color: 'bg-[#f7931a]' }; // 橙色
      }
      
      // 以太坊 (ETH)：symbol 或 title 包含 'ETH' 或 '以太坊'
      if (symbol.includes('ETH') || title.includes('ETH') || title.includes('以太坊')) {
        return { name: 'Ethereum', color: 'bg-[#627EEA]' }; // 以太坊蓝，使用 Gem 图标（菱形）
      }
      
      // 其他加密货币默认使用 Coins
      return { name: 'Coins', color: 'bg-[#627EEA]' };
    }
    
    // 优先级 3: 其他独立市场，根据分类显示图标
    const category = (m.category || event.category || '').toLowerCase();
    if (category.includes('政治') || category.includes('politic')) return { name: 'Building2', color: 'bg-blue-800' };
    if (category.includes('体育') || category.includes('sport')) return { name: 'Trophy', color: 'bg-orange-600' };
    if (category.includes('科技') || category.includes('tech')) return { name: 'Bot', color: 'bg-purple-600' };
    return { name: 'Bitcoin', color: 'bg-[#f7931a]' };
  };

  // 使用原始市场 ID（如果可用），否则使用数字 ID
  const marketId = (event as any).originalId || event.id.toString();

  const handleTradeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoggedIn) {
      router.push(`/login?redirect=/markets/${marketId}`);
    } else {
      router.push(`/markets/${marketId}`);
    }
  };

  // 🚀 物理修复赔率：同步 Polymarket 原始赔率（解决 50/50 错误）
  const getYesPercent = (): number => {
    const m = event as any;
    try {
      const prices = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices;
      if (Array.isArray(prices) && prices.length > 0) {
        const yesPrice = parseFloat(prices[0]); // Polymarket 格式通常是 [0.19, 0.81]
        if (!isNaN(yesPrice) && yesPrice >= 0 && yesPrice <= 1) return Math.round(yesPrice * 100);
      }
    } catch (e) {}
    if (m.initialPrice && m.initialPrice <= 1) return Math.round(m.initialPrice * 100);
    return 50;
  };

  const getNoPercent = (): number => {
    const yes = getYesPercent();
    return 100 - yes;
  };

  // 🔥 修正交易量显示：如果 volume24h 为 0，则尝试显示 market.volume
  const getVolume = (): string => {
    const market = event as any;
    
    // 优先使用 volume24h
    let volume = market.volume24h;
    
    // 如果 volume24h 为 0 或不存在，尝试显示 market.volume
    if (!volume || volume === 0) {
      volume = market.volume || event.volume || market.displayVolume || market.totalVolume || market.externalVolume;
    }
    
    if (typeof volume === 'number' && volume > 0) {
      // 格式化交易量
      if (volume >= 1000000) {
        return `$${(volume / 1000000).toFixed(1)}m`;
      } else if (volume >= 1000) {
        return `$${(volume / 1000).toFixed(1)}k`;
      }
      return `$${volume.toFixed(2)}`;
    }
    
    // 如果都没有，显示 $0.00（但不会显示，因为全网有几千万美金的交易量）
    return "$0.00";
  };

  const imageSrc = getImageSrc();
  const iconConfig = getIconConfig();
  const IconComponent = iconMap[iconConfig.name] || Bitcoin;

  const yesPercent = getYesPercent();
  const noPercent = getNoPercent();
  const volume = getVolume();

  return (
    <Link
      href={`/markets/${marketId}`}
      className="flex flex-col p-4 rounded-lg border border-border-dark bg-surface-dark hover:border-primary/40 transition-all cursor-pointer group relative overflow-hidden h-full"
    >
      <div className="flex flex-col h-full">
        <div className="flex gap-4 mb-4">
          <div className="w-14 h-14 rounded-md overflow-hidden flex-shrink-0 relative">
            {/* 🔥 禁止硬编码 Bitcoin：只显示数据库中的真实图片 */}
            {imageSrc ? (
              <img
                className="w-full h-full object-cover"
                src={imageSrc}
                alt={event.title}
                onError={(e) => {
                  // 如果图片加载失败，隐藏 img 标签，显示默认图标
                  (e.target as HTMLImageElement).style.display = 'none';
                  const parent = (e.target as HTMLImageElement).parentElement;
                  if (parent) {
                    const fallback = parent.querySelector('.icon-fallback') as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }
                }}
              />
            ) : null}
            {/* 默认图标（当没有图片或图片加载失败时显示） */}
            <div
              className={`w-full h-full absolute inset-0 ${imageSrc ? 'icon-fallback hidden' : ''} ${event.iconColor || iconConfig.color} flex items-center justify-center`}
            >
              <IconComponent className="w-7 h-7 text-white" />
            </div>
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
                {/* 🚀 强制从数据库读取，按优先级：outcomePrices > initialPrice > 本地计算 */}
                {yesPercent}%
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
                {/* 🚀 强制从数据库读取，按优先级：outcomePrices > initialPrice > 本地计算 */}
                {noPercent}%
              </span>
            </button>
          </div>
          <div className="flex items-center justify-between text-xs text-text-secondary font-medium">
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-1 text-text-secondary">
                <BarChart3 className="w-3 h-3 fill-current" />
                {/* 🔥 修正交易量：如果 volume24h 为 0，则尝试显示 market.volume */}
                {volume}
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
