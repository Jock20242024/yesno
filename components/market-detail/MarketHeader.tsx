"use client";

import { useState, useEffect } from "react";
import { Clock, TrendingUp } from "lucide-react";
import { MarketEvent } from "@/lib/data";
import dayjs from "@/lib/dayjs"; // 🔥 使用全局初始化的 dayjs
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";
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
  Share2,
} from "lucide-react";
import { EthereumIcon } from "@/components/icons/EthereumIcon";

// 🔥 扩展 iconMap 类型以支持自定义组件
type IconComponent = LucideIcon | React.ComponentType<{ className?: string }>;

const iconMap: Record<string, IconComponent> = {
  Bitcoin,
  Ethereum: EthereumIcon, // 🔥 使用自定义以太坊图标
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

export type MarketStatus = "open" | "closed";
export type MarketResult = "YES_WON" | "NO_WON" | null;

interface MarketHeaderProps {
  event: MarketEvent;
  status?: MarketStatus;
  result?: MarketResult;
  closingDate?: string; // ISO 8601 格式的关闭时间
  period?: number | null; // 🔥 周期（分钟数），用于计算时间区间
  isFactory?: boolean; // 🔥 是否为工厂市场
  imageUrl?: string | null; // 🔥 市场头像图片URL（从Polymarket抓取的原始图片）
}

// 倒计时计算函数
function calculateCountdown(closingDate: string): { days: number; hours: number; minutes: number; seconds: number; isExpired: boolean } {
  try {
    const now = new Date().getTime();
    const closing = new Date(closingDate).getTime();
    
    // 🔥 验证日期有效性
    if (isNaN(closing)) {
      console.warn('⚠️ [MarketHeader] 无效的 closingDate，无法计算倒计时:', closingDate);
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
    }
    
    const diff = closing - now;

    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds, isExpired: false };
  } catch (error) {
    console.error('❌ [MarketHeader] 倒计时计算错误:', error, 'closingDate:', closingDate);
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
  }
}

export default function MarketHeader({ event, status = "open", result = null, closingDate, period, isFactory, imageUrl }: MarketHeaderProps) {
  const { t, language } = useLanguage();
  
  // 🔥 实时翻译已完全禁用：不再发送任何翻译请求
  // 翻译已通过以下方式实现：
  // 1. 批量翻译脚本：一次性翻译历史数据
  // 2. 采集时自动翻译：新市场自动翻译
  // 前端不再进行实时翻译，避免 API 调用和性能问题
  
  // 🔥 逻辑守卫：确保 event 存在
  if (!event || !event.id) {
    return (
      <div className="text-center py-4 text-gray-400">加载中...</div>
    );
  }

  // 🔥 修复：从 event 中提取 icon 和 iconColor，如果没有则根据 symbol/title 动态计算
  const getIconAndColor = () => {
    // 优先使用 API 返回的 icon 和 iconColor（即使iconColor为空也使用icon）
    if ((event as any).icon) {
      return {
        icon: (event as any).icon,
        iconColor: (event as any).iconColor || 'bg-[#f7931a]',
      };
    }
    
    // 如果没有，根据 symbol/title 动态判断
    const symbol = (event as any).symbol || '';
    const title = event.title || '';
    const symbolUpper = symbol.toUpperCase();
    const titleUpper = title.toUpperCase();
    
    if (symbolUpper.includes('ETH') || titleUpper.includes('ETH') || titleUpper.includes('以太坊') || titleUpper.includes('ETHEREUM')) {
      return {
        icon: 'Ethereum',
        iconColor: 'bg-[#627EEA]', // 以太坊蓝色
      };
    }
    if (symbolUpper.includes('BTC') || titleUpper.includes('BTC') || titleUpper.includes('比特币') || titleUpper.includes('BITCOIN')) {
      return {
        icon: 'Bitcoin',
        iconColor: 'bg-[#f7931a]', // 比特币橙色
      };
    }
    
    // 🔥 修复：不默认使用Bitcoin，根据分类或其他逻辑判断
    // 如果event.icon存在，使用它；否则根据分类判断
    if (event.icon) {
      return {
        icon: event.icon,
        iconColor: (event as any).iconColor || 'bg-[#f7931a]',
      };
    }
    
    // 根据分类判断图标
    const category = (event as any).category || '';
    const categoryUpper = category.toUpperCase();
    
    if (categoryUpper.includes('CRYPTO') || categoryUpper.includes('加密货币')) {
      // 加密货币分类，但不确定是BTC还是ETH，使用Coins图标
      return {
        icon: 'Coins',
        iconColor: 'bg-[#f7931a]',
      };
    }
    if (categoryUpper.includes('POLITICS') || categoryUpper.includes('政治')) {
      return {
        icon: 'Flag',
        iconColor: 'bg-[#ef4444]',
      };
    }
    if (categoryUpper.includes('SPORTS') || categoryUpper.includes('体育')) {
      return {
        icon: 'Activity',
        iconColor: 'bg-[#22c55e]',
      };
    }
    if (categoryUpper.includes('FINANCE') || categoryUpper.includes('金融')) {
      return {
        icon: 'Building2',
        iconColor: 'bg-[#3b82f6]',
      };
    }
    if (categoryUpper.includes('TECH') || categoryUpper.includes('科技')) {
      return {
        icon: 'Rocket',
        iconColor: 'bg-[#8b5cf6]',
      };
    }
    
    // 最后的后备方案：使用Coins而不是Bitcoin
    return {
      icon: 'Coins',
      iconColor: 'bg-[#f7931a]',
    };
  };

  const { icon, iconColor } = getIconAndColor();
  // 🔥 修复：确保icon在iconMap中存在，否则使用Coins而不是Bitcoin
  const IconComponent = icon && iconMap[icon] ? iconMap[icon] : Coins;
  
  // 🔥 修复状态判断：对于工厂市场，如果 closingDate 已过期，即使状态还是 OPEN，也应该视为"已结束"
  const isExpired = (() => {
    if (!closingDate) return false;
    try {
      const date = new Date(closingDate);
      if (isNaN(date.getTime())) {
        console.warn('⚠️ [MarketHeader] 无效的 closingDate:', closingDate);
        return false;
      }
      return date.getTime() <= Date.now();
    } catch (e) {
      console.error('❌ [MarketHeader] 日期比较错误:', e, 'closingDate:', closingDate);
      return false;
    }
  })();
  const isResolved = (status === "closed" || (isFactory && isExpired)) && result !== null;
  const isYesWon = result === "YES_WON";
  // 🔥 工厂市场：即使状态是 OPEN，如果时间已过期，也显示为已结束
  const displayStatus = isFactory && isExpired && status === "open" ? "closed" : status;
  
  // 倒计时状态
  const [countdown, setCountdown] = useState<{ days: number; hours: number; minutes: number; seconds: number; isExpired: boolean } | null>(null);
  
  // 🔥 计算时间区间：StartTime = EndTime - 周期时间（参考 Polymarket 风格）
  // 🔥 动态使用用户本地时区，确保与导航按钮时间完全对齐
  const getTimeInterval = (): string | null => {
    if (!closingDate || !isFactory || !period) return null;
    
    try {
      // 🔥 安全日期验证
      const testDate = new Date(closingDate);
      if (isNaN(testDate.getTime())) {
        console.warn('⚠️ [MarketHeader] 无效的 closingDate，无法计算时间区间:', closingDate);
        return null;
      }
      
      // 🔥 动态获取用户时区（仅用于时间转换，不显示）
      const userTimeZone = typeof window !== 'undefined' 
        ? Intl.DateTimeFormat().resolvedOptions().timeZone 
        : 'Asia/Shanghai';
      
      // 后端返回的 closingDate 视为 UTC，转换为用户本地时区
      const endTime = dayjs(closingDate).tz(userTimeZone);
      if (!endTime.isValid()) {
        console.warn('⚠️ [MarketHeader] dayjs 解析失败:', closingDate);
        return null;
      }
      const startTime = endTime.subtract(period, 'minute'); // 减去周期（分钟）
      
      // 🔥 根据语言切换日期格式
      const dateFormat = language === 'en' ? 'MMM D' : 'M月D日';
      const dateStr = startTime.format(dateFormat);
      const startTimeStr = startTime.format('HH:mm');
      const endTimeStr = endTime.format('HH:mm');
      
      // 🔥 规范化格式：使用翻译的"当地时间"
      return `${dateStr}, ${t('market.time.local_time')} ${startTimeStr}–${endTimeStr}`;
    } catch (error) {
      console.error('❌ [MarketHeader] 计算时间区间失败:', error, 'closingDate:', closingDate);
      return null;
    }
  };
  
  const timeInterval = getTimeInterval();
  
  // 计算倒计时
  useEffect(() => {
    // 🔥 修复：对于工厂市场，如果已过期但状态还是 open，也停止倒计时
    if (!closingDate || isResolved || (isFactory && isExpired)) {
      setCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const result = calculateCountdown(closingDate);
      setCountdown(result);
      // 🔥 如果倒计时过期，停止更新
      if (result.isExpired) {
        setCountdown(null);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [closingDate, isResolved, isFactory, isExpired]);

  return (
    <div className="flex flex-col gap-4 mb-8">
      {/* 市场已结束 Banner */}
      {isResolved && (
        <div
          className={`w-full px-6 py-4 rounded-xl border-2 shadow-lg ${
            isYesWon
              ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/50 text-rose-400"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`flex-shrink-0 w-2 h-2 rounded-full ${
              isYesWon ? "bg-emerald-500" : "bg-rose-500"
            } animate-pulse`} />
            <div className="flex-1">
              <p className="text-sm font-bold">
                市场已结束：{isYesWon ? "YES" : "NO"} 获胜
              </p>
              <p className="text-xs opacity-80 mt-0.5">
                Market Resolved: {isYesWon ? "YES" : "NO"} Won
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start gap-4">
      <div className="size-16 rounded-xl bg-white/5 p-1.5 flex-shrink-0 border border-pm-border overflow-hidden">
        {imageUrl ? (
          // 🔥 优先使用从Polymarket抓取的原始头像图片
          <img 
            src={imageUrl} 
            alt={event.title}
            className="w-full h-full rounded-lg object-cover"
            onError={(e) => {
              // 如果图片加载失败，fallback到图标
              (e.target as HTMLImageElement).style.display = 'none';
              const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        ) : null}
        <div
          className={`w-full h-full rounded-lg ${iconColor} flex items-center justify-center text-white shadow-inner ${imageUrl ? 'hidden' : ''}`}
        >
          <IconComponent className="w-10 h-10" />
        </div>
      </div>
      <div className="flex-1">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="text-2xl md:text-3xl lg:text-[32px] font-bold text-white leading-tight flex-1">
            {(() => {
              // 🔥 根据语言环境显示对应的标题（不再使用实时翻译）
              const market = event as any;
              if (language === 'zh' && market.titleZh) {
                // 优先使用已有的 titleZh
                return market.titleZh;
              }
              // 英文环境或没有 titleZh，显示原始标题
              return event.title;
            })()}
          </h1>
          {/* 🔥 新增：分享按钮 */}
          <button
            onClick={async () => {
              try {
                const marketTitle = (() => {
                  const market = event as any;
                  if (language === 'zh' && market.titleZh) {
                    return market.titleZh;
                  }
                  return event.title;
                })();
                const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/markets/${event.id}`;
                const shareText = `${marketTitle} - ${shareUrl}`;
                
                // 🔥 修复：检查是否支持原生分享（移动端）
                if (navigator.share && typeof navigator.share === 'function') {
                  try {
                    // 移动端使用原生分享
                    await navigator.share({
                      title: marketTitle,
                      text: marketTitle,
                      url: shareUrl,
                    });
                    // 如果分享成功，不显示 toast（原生分享会自己处理）
                    return;
                  } catch (shareError: any) {
                    // 如果用户取消分享，不显示错误
                    if (shareError.name === 'AbortError') {
                      return;
                    }
                    // 其他错误，继续尝试复制到剪贴板
                    console.warn('⚠️ [MarketHeader] 原生分享失败，尝试复制到剪贴板:', shareError);
                  }
                }
                
                // 桌面端或原生分享失败时，复制到剪贴板
                if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                  await navigator.clipboard.writeText(shareText);
                  toast.success(t('market.chart.share_success'));
                } else {
                  // 降级方案：使用传统的复制方法
                  const textArea = document.createElement('textarea');
                  textArea.value = shareText;
                  textArea.style.position = 'fixed';
                  textArea.style.opacity = '0';
                  document.body.appendChild(textArea);
                  textArea.select();
                  try {
                    document.execCommand('copy');
                    toast.success(t('market.chart.share_success'));
                  } catch (fallbackError) {
                    console.error('❌ [MarketHeader] 降级复制也失败:', fallbackError);
                    toast.error(t('market.chart.share_error'));
                  } finally {
                    document.body.removeChild(textArea);
                  }
                }
              } catch (error) {
                console.error('❌ [MarketHeader] 分享失败:', error);
                toast.error(t('market.chart.share_error'));
              }
            }}
            className="flex-shrink-0 p-2 rounded-lg bg-pm-card border border-pm-border hover:bg-pm-card-hover transition-colors text-pm-text-dim hover:text-white"
            title={t('market.chart.share_market')}
            aria-label={t('market.chart.share_market')}
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
        {/* 🔥 时间区间显示（参考 Polymarket 风格） */}
        {timeInterval && (
          <div className="mb-3 text-sm text-pm-text-dim font-medium">
            {timeInterval}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 text-xs font-medium text-pm-text-dim">
          {/* 🔥 如果市场已结束（包括工厂市场时间过期），显示"已结束"标签 */}
          {isResolved || (isFactory && isExpired) ? (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-pm-card border border-pm-border text-white shadow-sm ring-1 ring-white/5">
              <Clock className="w-[18px] h-[18px] text-pm-text-dim" />
              <span className="font-bold text-sm text-pm-text-dim">已结束</span>
            </div>
          ) : countdown && !countdown.isExpired ? (
            /* 如果市场未结束且有倒计时，显示倒计时 */
            <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-pm-card border border-pm-border text-white shadow-sm ring-1 ring-white/5">
              <Clock className="w-[18px] h-[18px] text-pm-blue animate-pulse" />
              <div className="flex items-baseline gap-1" suppressHydrationWarning>
                <span className="font-mono font-bold tracking-wide text-sm">
                  {String(countdown.days).padStart(2, '0')}<span className="text-[10px] text-pm-text-dim font-sans ml-0.5 mr-1">
                    {t('market.time.days')}
                  </span>
                  {String(countdown.hours).padStart(2, '0')}:{String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')}
                </span>
              </div>
            </div>
          ) : (
            /* 如果倒计时已过期但状态还是 open，显示"已结束" */
            <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-pm-card border border-pm-border text-white shadow-sm ring-1 ring-white/5">
              <Clock className="w-[18px] h-[18px] text-pm-text-dim" />
              <span className="font-bold text-sm text-pm-text-dim">已结束</span>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

