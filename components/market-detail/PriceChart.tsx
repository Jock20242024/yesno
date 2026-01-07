"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, ChevronUp, X } from "lucide-react";
import type { MarketStatus, MarketResult } from "./MarketHeader";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useMemo } from "react";
import dayjs from "@/lib/dayjs"; // 🔥 使用全局初始化的 dayjs
import { Drawer } from "vaul";
import { useLanguage } from "@/i18n/LanguageContext";

interface SlotItem {
  id: string;
  startTime: string; // ISO 8601 格式
  endTime: string; // ISO 8601 格式
  status: 'ended' | 'active' | 'upcoming';
}

interface PriceChartProps {
  yesPercent: number;
  noPercent?: number; // 🔥 新增：NO 百分比
  marketStatus?: MarketStatus;
  marketResult?: MarketResult;
  slots?: SlotItem[]; // 🔥 同模板今天的所有场次
  currentMarketId?: string; // 🔥 当前市场 ID
  period?: number | null; // 🔥 周期（分钟数），用于判断是否显示场次导航
  templateId?: string | null; // 🔥 模板 ID，用于未生成场次的生成接口
  height?: number; // 🔥 图表高度
  data?: Array<{ time: string; value: number; timestamp: number }>; // 🔥 图表数据（历史价格数据，YES）
  noData?: Array<{ time: string; value: number; timestamp: number }>; // 🔥 新增：NO 图表数据
  hideNavigation?: boolean; // 🔥 是否隐藏内部导航栏
  isFactory?: boolean; // 🔥 是否是工厂市场
  volume?: number; // 🔥 新增：市场交易量
}

// 🔥 移除假数据生成函数：现在使用真实历史数据
// 如果数据为空，返回一个默认数据点
const getDefaultChartData = (currentPrice: number) => {
  const now = Date.now();
  return [
    {
      time: new Date(now - 24 * 60 * 60 * 1000).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      value: 0.5, // 初始价格 50%
      timestamp: now - 24 * 60 * 60 * 1000,
    },
    {
      time: new Date(now).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      value: currentPrice, // 当前价格
      timestamp: now,
    },
  ];
};

export default function PriceChart({ yesPercent, noPercent, marketStatus = "open", marketResult = null, slots = [], currentMarketId, period, templateId, height = 300, data, noData, hideNavigation = false, isFactory = false, volume }: PriceChartProps) {
  // 🔥 关键：所有 hooks 必须在早期返回之前调用
  const router = useRouter();
  const { t, language } = useLanguage();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const activeSlotRef = useRef<HTMLButtonElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // 🔥 新增：时间范围选择状态（1H/24H/7D/30D/ALL）
  const [timeRange, setTimeRange] = useState<"1H" | "24H" | "7D" | "30D" | "ALL">("24H");
  
  // 🔥 生成全天槽位数组函数（纯函数，不依赖 hooks）
  const generateAllDaySlots = (periodMinutes: number): Array<{ startTime: dayjs.Dayjs; endTime: dayjs.Dayjs; slotKey: string }> => {
    const slots: Array<{ startTime: dayjs.Dayjs; endTime: dayjs.Dayjs; slotKey: string }> = [];
    const todayStart = dayjs().local().startOf('day');
    const minutesPerDay = 24 * 60;
    const slotCount = Math.floor(minutesPerDay / periodMinutes);
    
    for (let i = 0; i < slotCount; i++) {
      const startTime = todayStart.add(i * periodMinutes, 'minute');
      const endTime = startTime.add(periodMinutes, 'minute');
      const slotKey = startTime.local().format('YYYY-MM-DD-HH-mm');
      slots.push({ startTime, endTime, slotKey });
    }
    
    return slots;
  };
  
  // 🔥 映射市场数据函数（纯函数）
  const mapSlotsToAllDaySlots = (allDaySlots: Array<{ startTime: dayjs.Dayjs; endTime: dayjs.Dayjs; slotKey: string }>, apiSlots: SlotItem[]): Array<{ startTime: dayjs.Dayjs; endTime: dayjs.Dayjs; slotKey: string; marketId: string | null; slotData: SlotItem | null }> => {
    const slotsMap = new Map<string, SlotItem>();
    
    if (apiSlots && apiSlots.length > 0) {
      apiSlots.forEach((slot) => {
        const startTimeLocal = dayjs(slot.startTime).local();
        const key = startTimeLocal.format('YYYY-MM-DD-HH-mm');
        slotsMap.set(key, slot);
      });
    }
    
    return allDaySlots.map((daySlot) => {
      const key = daySlot.slotKey;
      const marketSlot = slotsMap.get(key);
      
      return {
        ...daySlot,
        marketId: marketSlot?.id || null,
        slotData: marketSlot || null,
      };
    });
  };

  // 🔥 计算可见槽位和滚动相关数据（使用 useMemo 确保一致性）
  const slotNavigationData = useMemo(() => {
    if (!period || period < 15 || period > 1440 || hideNavigation) {
      return { visibleSlots: [], currentIndex: 0, mappedSlots: [], activeSlotIndex: -1 };
    }
    
    const allDaySlots = generateAllDaySlots(period);
    const mappedSlots = mapSlotsToAllDaySlots(allDaySlots, slots);
    
    const now = dayjs().local();
    const activeSlotIndex = mappedSlots.findIndex(slot => {
      if (!slot.marketId) return false;
      const startTimeLocal = slot.startTime.local();
      const endTimeLocal = slot.endTime.local();
      return now.isSameOrAfter(startTimeLocal) && now.isBefore(endTimeLocal);
    });
    
    const targetSlotIndex = activeSlotIndex >= 0 
      ? activeSlotIndex 
      : mappedSlots.findIndex(slot => slot.marketId === currentMarketId);
    const currentIndex = targetSlotIndex >= 0 ? targetSlotIndex : Math.floor(mappedSlots.length / 2);
    
    const startIndex = Math.max(0, currentIndex - 2);
    const endIndex = Math.min(mappedSlots.length, currentIndex + 3);
    const visibleSlots = mappedSlots.slice(startIndex, endIndex);
    
    return { visibleSlots, currentIndex, mappedSlots, activeSlotIndex };
  }, [period, slots, currentMarketId, hideNavigation]);

  // 🔥 自动滚动 useEffect - 必须在早期返回之前
  useEffect(() => {
    if (!slotNavigationData.visibleSlots.length) return;
    
    if (activeSlotRef.current && scrollContainerRef.current) {
      const timer = setTimeout(() => {
        const button = activeSlotRef.current;
        const container = scrollContainerRef.current;
        if (button && container) {
          const scrollLeft = button.offsetLeft - (container.offsetWidth / 2) + (button.offsetWidth / 2);
          container.scrollTo({
            left: scrollLeft,
            behavior: 'smooth',
          });
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [slotNavigationData.currentIndex, slotNavigationData.visibleSlots.length]);
  
  // 🔥 逻辑守卫：确保必要数据存在（必须在所有 hooks 之后）
  if (typeof yesPercent !== 'number' || isNaN(yesPercent)) {
    return (
      <div className="mb-10 h-[300px] flex items-center justify-center bg-pm-card rounded-xl border border-pm-border">
        <div className="text-pm-text-dim">加载图表数据中...</div>
      </div>
    );
  }

  // 🔥 使用真实数据：优先使用传入的 data，如果没有则使用默认数据
  const currentValue = yesPercent / 100;
  const currentNoValue = noPercent !== undefined ? noPercent / 100 : (1 - currentValue);
  const allChartData = data && data.length > 0 
    ? data 
    : getDefaultChartData(currentValue);
  // 🔥 新增：NO 数据（如果没有传入，则从 YES 数据计算）
  const allNoChartData = noData && noData.length > 0 
    ? noData 
    : allChartData.map(point => ({ ...point, value: 1 - point.value }));
  const isResolved = marketStatus === "closed" && marketResult !== null;
  
  // 🔥 新增：根据时间范围过滤数据
  const chartData = useMemo(() => {
    if (!allChartData || allChartData.length === 0) return allChartData;
    
    const now = Date.now();
    let cutoffTime: number;
    
    switch (timeRange) {
      case "1H":
        cutoffTime = now - 60 * 60 * 1000; // 1小时前
        break;
      case "24H":
        cutoffTime = now - 24 * 60 * 60 * 1000; // 24小时前
        break;
      case "7D":
        cutoffTime = now - 7 * 24 * 60 * 60 * 1000; // 7天前
        break;
      case "30D":
        cutoffTime = now - 30 * 24 * 60 * 60 * 1000; // 30天前
        break;
      case "ALL":
      default:
        return allChartData; // 显示所有数据
    }
    
    // 过滤数据：只保留时间戳在cutoffTime之后的数据点
    return allChartData.filter((point) => point.timestamp >= cutoffTime);
  }, [allChartData, timeRange]);

  // 🔥 新增：NO 数据过滤（与 YES 数据使用相同的时间范围）
  const noChartData = useMemo(() => {
    if (!allNoChartData || allNoChartData.length === 0) return allNoChartData;
    
    const now = Date.now();
    let cutoffTime: number;
    
    switch (timeRange) {
      case "1H":
        cutoffTime = now - 60 * 60 * 1000;
        break;
      case "24H":
        cutoffTime = now - 24 * 60 * 60 * 1000;
        break;
      case "7D":
        cutoffTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case "30D":
        cutoffTime = now - 30 * 24 * 60 * 60 * 1000;
        break;
      case "ALL":
      default:
        return allNoChartData;
    }
    
    return allNoChartData.filter((point) => point.timestamp >= cutoffTime);
  }, [allNoChartData, timeRange]);
  
  // 🔥 计算24小时价格变化百分比（基于真实历史数据）
  const priceChange24h = useMemo(() => {
    if (!allChartData || allChartData.length === 0) {
      return null; // 没有历史数据，无法计算
    }
    
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
    
    // 找到24小时前最接近的价格点
    let price24hAgo: number | null = null;
    let minTimeDiff = Infinity;
    
    for (const point of allChartData) {
      const timeDiff = Math.abs(point.timestamp - twentyFourHoursAgo);
      if (timeDiff < minTimeDiff && point.timestamp <= twentyFourHoursAgo) {
        minTimeDiff = timeDiff;
        price24hAgo = point.value;
      }
    }
    
    // 如果找不到24小时前的数据，尝试找最早的数据点
    if (price24hAgo === null && allChartData.length > 0) {
      const firstPoint = allChartData[0];
      // 如果最早的数据点在24小时前，使用它
      if (firstPoint.timestamp <= twentyFourHoursAgo) {
        price24hAgo = firstPoint.value;
      }
    }
    
    // 如果仍然找不到，返回null
    if (price24hAgo === null) {
      return null;
    }
    
    // 计算变化百分比：((当前价格 - 24小时前价格) / 24小时前价格) * 100
    const currentPrice = currentValue;
    const changePercent = ((currentPrice - price24hAgo) / price24hAgo) * 100;
    
    return {
      percent: changePercent,
      isPositive: changePercent >= 0,
    };
  }, [allChartData, currentValue]);

  // 🔥 新增：计算 NO 的24小时价格变化百分比
  const noPriceChange24h = useMemo(() => {
    if (!allNoChartData || allNoChartData.length === 0) {
      return null;
    }
    
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
    
    let price24hAgo: number | null = null;
    let minTimeDiff = Infinity;
    
    for (const point of allNoChartData) {
      const timeDiff = Math.abs(point.timestamp - twentyFourHoursAgo);
      if (timeDiff < minTimeDiff && point.timestamp <= twentyFourHoursAgo) {
        minTimeDiff = timeDiff;
        price24hAgo = point.value;
      }
    }
    
    if (price24hAgo === null && allNoChartData.length > 0) {
      const firstPoint = allNoChartData[0];
      if (firstPoint.timestamp <= twentyFourHoursAgo) {
        price24hAgo = firstPoint.value;
      }
    }
    
    if (price24hAgo === null) {
      return null;
    }
    
    const changePercent = ((currentNoValue - price24hAgo) / price24hAgo) * 100;
    
    return {
      percent: changePercent,
      isPositive: changePercent >= 0,
    };
  }, [allNoChartData, currentNoValue]);
  
  // 🔥 动态获取用户时区（使用浏览器本地时区，不硬编码）
  const userTimeZone = typeof window !== 'undefined' 
    ? Intl.DateTimeFormat().resolvedOptions().timeZone 
    : 'UTC'; // SSR fallback（仅在服务端渲染时使用）
  
  // 🔥 实时计算状态：对比当前时间（客户端时间）与 startTime 和 endTime
  // 进行中 (Live)：now >= startTime && now < endTime
  // 未开始 (Upcoming)：now < startTime
  // 已结束 (Ended)：now >= endTime
  const calculateSlotStatus = (startTime: dayjs.Dayjs, endTime: dayjs.Dayjs): 'active' | 'ended' | 'upcoming' => {
    // 使用客户端当前时间（系统本地时区）
    const now = dayjs().local();
    
    // 将 startTime 和 endTime 转换为本地时区进行比较（确保都是本地时区）
    const startTimeLocal = startTime.local();
    const endTimeLocal = endTime.local();
    
    // 🔥 修复状态逻辑：确保正确判断
    // 进行中 (Live)：now >= startTime && now < endTime
    if (now.isSameOrAfter(startTimeLocal) && now.isBefore(endTimeLocal)) {
      return 'active';
    }
    
    // 未开始 (Upcoming)：now < startTime
    if (now.isBefore(startTimeLocal)) {
      return 'upcoming';
    }
    
    // 已结束 (Ended)：now >= endTime
    return 'ended';
  };
  
  // 🔥 格式化时间：使用用户本地时区显示（HH:mm），确保显示的是电脑时钟对应的时间
  const formatTime = (date: dayjs.Dayjs): string => {
    // 使用 .local() 确保显示的是系统本地时区（电脑时钟对应的时间）
    return date.local().format('HH:mm');
  };
  
  // 🔥 格式化日期：用于标题显示，根据语言切换格式
  const formatDate = (date: dayjs.Dayjs): string => {
    const dateFormat = language === 'en' ? 'MMM D' : 'M月D日';
    return date.local().format(dateFormat);
  };
  
  // 条件渲染：如果 period 在 15-1440 分钟之间，显示场次导航；否则显示周期切换栏
  // 如果 hideNavigation 为 true，则不显示导航栏
  const shouldShowSlotNavigation = !hideNavigation && period && period >= 15 && period <= 1440;
  
  if (!shouldShowSlotNavigation) {
    // 原有的周期切换栏（1H, 6H, 1D...）
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex items-baseline justify-between mb-2">
          <div className="flex items-baseline gap-3 flex-wrap">
            {/* YES 价格显示 */}
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-bold text-pm-green tracking-tight">
                {yesPercent}%
              </span>
              <span className="text-xs font-bold text-pm-green">{t('market.chart.yes')}</span>
              {priceChange24h !== null ? (
                <span className={`flex items-center text-xs font-bold ${priceChange24h.isPositive ? 'text-pm-green bg-pm-green-dim' : 'text-red-500 bg-red-500/20'} px-2 py-0.5 rounded ml-2`}>
                  {priceChange24h.isPositive ? (
                    <TrendingUp className="w-3 h-3 mr-0.5" />
                  ) : (
                    <TrendingDown className="w-3 h-3 mr-0.5" />
                  )}
                  {priceChange24h.isPositive ? '+' : ''}{priceChange24h.percent.toFixed(1)}% (24h)
                </span>
              ) : null}
            </div>
            {/* NO 价格显示 */}
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-bold text-pm-red tracking-tight">
                {noPercent !== undefined ? noPercent : (100 - yesPercent)}%
              </span>
              <span className="text-xs font-bold text-pm-red">{t('market.chart.no')}</span>
              {noPriceChange24h !== null ? (
                <span className={`flex items-center text-xs font-bold ${noPriceChange24h.isPositive ? 'text-pm-green bg-pm-green-dim' : 'text-red-500 bg-red-500/20'} px-2 py-0.5 rounded ml-2`}>
                  {noPriceChange24h.isPositive ? (
                    <TrendingUp className="w-3 h-3 mr-0.5" />
                  ) : (
                    <TrendingDown className="w-3 h-3 mr-0.5" />
                  )}
                  {noPriceChange24h.isPositive ? '+' : ''}{noPriceChange24h.percent.toFixed(1)}% (24h)
                </span>
              ) : null}
            </div>
          </div>
          {/* 🔥 时间范围选择器 */}
          <div className="flex gap-1.5">
            {(["1H", "24H", "7D", "30D", "ALL"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                  timeRange === range
                    ? "bg-pm-green/10 text-pm-green border border-pm-green/30"
                    : "bg-transparent text-pm-text-dim hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
        <div id="chart-container" className="w-full bg-[#0a0b0d] relative outline-none flex-1" style={{ height: `${height}px`, minHeight: `${height}px`, maxHeight: `${height}px`, outline: 'none' }} tabIndex={-1}>
          <ResponsiveContainer width="100%" height={height} className="outline-none">
            <AreaChart data={chartData.map((point, index) => ({
              ...point,
              noValue: noChartData[index]?.value ?? (1 - point.value),
            }))} margin={{ top: 5, right: 5, left: 5, bottom: 5 }} className="outline-none">
              <defs>
                <linearGradient id="colorYes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorNo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="time" 
                height={40}
                tick={{fill: '#4a4a4a', fontSize: 12}}
                stroke="#4a4a4a"
                tickLine={false}
              />
              <YAxis 
                domain={[0, 1]}
                tickFormatter={(value) => `${Math.round(value * 100)}%`}
                stroke="#4a4a4a"
                fontSize={12}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                  color: "#fff",
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#colorYes)"
                dot={false}
                name={t('market.chart.yes')}
              />
              {/* 🔥 新增：NO K线 */}
              <Area
                type="monotone"
                dataKey="noValue"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#colorNo)"
                dot={false}
                name={t('market.chart.no')}
              />
              {isResolved && (
                <ReferenceLine 
                  x={chartData[chartData.length - 1]?.time} 
                  stroke="#ef4444" 
                  strokeDasharray="5 5"
                  label={{ value: language === 'zh' ? "结算点" : "Settlement", position: "top", fill: "#ef4444" }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
          <div className="absolute top-4 left-[65%] bg-pm-card border border-pm-border px-3 py-2 rounded-lg shadow-xl hidden group-hover:block z-10">
            <div className="text-[10px] text-pm-text-dim mb-0.5 font-medium uppercase tracking-wider">
              {formatDate(dayjs().local())}, {t('market.time.local_time')} ({userTimeZone})
            </div>
            <div className="text-lg font-bold text-pm-green leading-none">
              {yesPercent}% Yes
            </div>
          </div>
        </div>
        {/* 🔥 所有市场都隐藏时间导航栏和时区显示 */}
        {/* 已删除：1H 6H 1D 1W 1M 导航栏和 Asia/Shanghai 时区显示 */}
        {/* 🔥 增加底部间距，确保与标签页有足够距离 */}
        <div className="mb-6"></div>
      </div>
    );
  }
  
  // 使用 useMemo 计算的数据
  const { visibleSlots, mappedSlots, activeSlotIndex } = slotNavigationData;
  
  // 在图表数据中找到结束时间点
  const resolvedTimeIndex = chartData.length - 1;
  
  // 获取当前日期（用户本地时区）用于标题显示
  const currentDate = dayjs().local();
  
  // 处理场次点击
  const handleSlotClick = async (slot: typeof slotNavigationData.mappedSlots[0]) => {
    const isGenerated = !!slot.marketId;
    
    if (isGenerated && slot.marketId && slot.marketId !== currentMarketId) {
      router.push(`/markets/${slot.marketId}`);
    } else if (!isGenerated && templateId) {
      // 未生成场次：调用生成接口
      try {
        const endTime = slot.endTime.utc().toISOString();
        
        // 🔥 参数验证：确保 templateId 不为空
        if (!templateId || templateId.trim() === '') {
          console.warn('⚠️ [PriceChart] templateId 为空，跳过 API 请求');
          return;
        }
        const response = await fetch(`/api/admin/factory/templates/${templateId}/trigger`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            overrideEndTime: endTime,
          }),
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data?.marketId) {
            router.push(`/markets/${result.data.marketId}`);
          }
        }
      } catch (error) {
        console.error('生成市场失败:', error);
      }
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-baseline gap-3 mb-2 flex-wrap">
        {/* YES 价格显示 */}
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-bold text-pm-green tracking-tight">
            {yesPercent}%
          </span>
          <span className="text-xs font-bold text-pm-green">{t('market.chart.yes')}</span>
          {priceChange24h !== null ? (
            <span className={`flex items-center text-xs font-bold ${priceChange24h.isPositive ? 'text-pm-green bg-pm-green-dim' : 'text-red-500 bg-red-500/20'} px-2 py-0.5 rounded ml-2`}>
              {priceChange24h.isPositive ? (
                <TrendingUp className="w-3 h-3 mr-0.5" />
              ) : (
                <TrendingDown className="w-3 h-3 mr-0.5" />
              )}
              {priceChange24h.isPositive ? '+' : ''}{priceChange24h.percent.toFixed(1)}% (24h)
            </span>
          ) : null}
        </div>
        {/* NO 价格显示 */}
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-bold text-pm-red tracking-tight">
            {noPercent !== undefined ? noPercent : (100 - yesPercent)}%
          </span>
          <span className="text-xs font-bold text-pm-red">{t('market.chart.no')}</span>
          {noPriceChange24h !== null ? (
            <span className={`flex items-center text-xs font-bold ${noPriceChange24h.isPositive ? 'text-pm-green bg-pm-green-dim' : 'text-red-500 bg-red-500/20'} px-2 py-0.5 rounded ml-2`}>
              {noPriceChange24h.isPositive ? (
                <TrendingUp className="w-3 h-3 mr-0.5" />
              ) : (
                <TrendingDown className="w-3 h-3 mr-0.5" />
              )}
              {noPriceChange24h.isPositive ? '+' : ''}{noPriceChange24h.percent.toFixed(1)}% (24h)
            </span>
          ) : null}
        </div>
      </div>
        <div id="chart-container" className="w-full bg-[#0a0b0d] relative outline-none flex-1" style={{ height: `${height}px`, minHeight: `${height}px`, maxHeight: `${height}px`, outline: 'none' }} tabIndex={-1}>
          <ResponsiveContainer width="100%" height={height} className="outline-none">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }} className="outline-none">
            <defs>
              <linearGradient id="colorYes" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              height={40}
              hide={false}
              tick={{fill: '#4a4a4a', fontSize: 12}}
              stroke="#4a4a4a"
              tickLine={false}
            />
            <YAxis
              domain={[0, 1]}
              tickFormatter={(value) => `${Math.round(value * 100)}%`}
              stroke="#4a4a4a"
              fontSize={12}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "8px",
                color: "#fff",
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#22c55e"
              strokeWidth={2}
              fill="url(#colorYes)"
              dot={false}
              name={t('market.chart.yes')}
            />
            {/* 🔥 新增：NO K线 */}
            <Area
              type="monotone"
              dataKey="noValue"
              stroke="#ef4444"
              strokeWidth={2}
              fill="url(#colorNo)"
              dot={false}
              name={t('market.chart.no')}
            />
            {isResolved && (
              <ReferenceLine
                x={chartData[resolvedTimeIndex]?.time}
                stroke="#ef4444"
                strokeDasharray="5 5"
                label={{ value: language === 'zh' ? "结算点" : "Settlement", position: "top", fill: "#ef4444" }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
        <div className="absolute top-4 left-[65%] bg-pm-card border border-pm-border px-3 py-2 rounded-lg shadow-xl hidden group-hover:block z-10">
          <div className="text-[10px] text-pm-text-dim mb-0.5 font-medium uppercase tracking-wider">
            {formatDate(currentDate)}, {t('market.time.local_time')} ({userTimeZone})
          </div>
          <div className="text-lg font-bold text-pm-green leading-none">
            {yesPercent}% {t('market.chart.yes')}
          </div>
          <div className="text-lg font-bold text-pm-red leading-none mt-1">
            {noPercent !== undefined ? noPercent : (100 - yesPercent)}% {t('market.chart.no')}
          </div>
        </div>
        {/* 🔥 新增：右下角交易量统计 */}
        {volume !== undefined && (
          <div className="absolute bottom-4 right-4 bg-pm-card/90 border border-pm-border px-3 py-2 rounded-lg shadow-xl z-10">
            <div className="text-[10px] text-pm-text-dim mb-0.5 font-medium uppercase tracking-wider">
              {t('market.chart.volume')}
            </div>
            <div className="text-sm font-bold text-white leading-none">
              ${typeof volume === 'number' ? volume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : volume}
            </div>
          </div>
        )}
      </div>
      
      {/* 🔥 场次导航：核心滚动条 + 向上抽屉 */}
      <div className="flex justify-between items-center pt-3">
        {/* 核心滚动条：当前场次前后各 2 个 */}
        <div 
          ref={scrollContainerRef}
          className="flex gap-2 overflow-x-auto pb-2 no-scrollbar flex-1"
        >
          {visibleSlots.map((slot, index) => {
            // 🔥 实时计算状态（使用客户端时间）
            const slotStatus = calculateSlotStatus(slot.startTime, slot.endTime);
            const isActive = slot.marketId === currentMarketId;
            // 🔥 判断是否是当前正在进行的场次（用于自动滚动定位）
            const isCurrentActive = activeSlotIndex >= 0 && mappedSlots.indexOf(slot) === activeSlotIndex;
            const isHighlighted = isActive || slotStatus === 'active' || isCurrentActive;
            const isGenerated = !!slot.marketId;
            const timeStr = formatTime(slot.startTime);
            
            return (
              <button
                key={slot.slotKey}
                ref={isHighlighted ? activeSlotRef : null}
                onClick={() => handleSlotClick(slot)}
                className={`
                  flex-shrink-0 px-4 py-1 rounded-full text-sm font-medium transition-all relative
                  border border-gray-700
                  ${
                    isHighlighted
                      ? "bg-blue-600 text-white shadow-lg"
                      : isGenerated
                      ? "bg-pm-card-hover/50 text-pm-text-dim hover:bg-pm-card opacity-70"
                      : "bg-pm-card/30 text-pm-text-dim/50 hover:bg-pm-card/50 opacity-50 border-dashed"
                  }
                `}
                title={slotStatus === 'active' ? '进行中' : isGenerated ? undefined : undefined}
              >
                {/* 当前场次或进行中：左侧红色闪烁圆点 */}
                {isHighlighted && (
                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                )}
                <span className={isHighlighted ? "ml-2" : ""}>{timeStr}</span>
                {!isGenerated && (
                  <span className="ml-1 text-[10px] opacity-50">+</span>
                )}
          </button>
            );
          })}
        </div>
        
        {/* 更多按钮：打开向上抽屉 */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-pm-card text-pm-text-dim hover:bg-pm-card-hover border border-pm-border transition-all flex-shrink-0"
        >
          <span>{t('market.chart.more')}</span>
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>
      
      {/* 🔥 向上抽屉（Bottom Sheet）：使用 vaul 库实现，支持上滑查看全天场次 */}
      <Drawer.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Drawer.Content className="bg-pm-card border-t border-pm-border rounded-t-2xl shadow-2xl z-50 flex flex-col max-h-[80vh] h-[70vh]">
            {/* 抽屉头部 */}
            <div className="flex items-center justify-between p-4 border-b border-pm-border flex-shrink-0">
              <div>
                <Drawer.Title className="text-lg font-bold text-white mb-1">选择交易场次</Drawer.Title>
                <p className="text-sm text-pm-text-dim">{formatDate(currentDate)}, {t('market.time.local_time')} ({userTimeZone})</p>
              </div>
              <Drawer.Close className="p-2 hover:bg-pm-card-hover rounded-lg transition-colors cursor-pointer">
                <X className="w-5 h-5 text-pm-text-dim" />
              </Drawer.Close>
            </div>
            
            {/* 抽屉内容：4列网格，支持纵向滚动 */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-4 gap-2">
                {mappedSlots.map((slot) => {
                  try {
                    // 🔥 实时计算状态（使用客户端时间）
                    const slotStatus = calculateSlotStatus(slot.startTime, slot.endTime);
                    const isActive = slot.marketId === currentMarketId;
                    const isGenerated = !!slot.marketId;
                    const timeStr = formatTime(slot.startTime);
                    
                    return (
                      <button
                        key={slot.slotKey}
                        onClick={() => {
                          setDrawerOpen(false);
                          handleSlotClick(slot);
                        }}
                        className={`
                          px-3 py-2 rounded-lg text-sm font-medium transition-all relative
                          border
                          ${
                            isActive || slotStatus === 'active'
                              ? "bg-blue-600 text-white border-blue-500 shadow-lg"
                              : isGenerated
                              ? "bg-pm-card-hover/50 text-pm-text-dim border-pm-border hover:bg-pm-card-hover"
                              : "bg-pm-card/30 text-pm-text-dim/50 border-pm-border/30 hover:bg-pm-card/50 border-dashed"
                          }
                        `}
                        title={slotStatus === 'active' ? '进行中' : undefined}
                      >
                        {/* 当前场次或进行中：左侧红色闪烁圆点 */}
                        {(isActive || slotStatus === 'active') && (
                          <span className="absolute left-1.5 top-1.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                        )}
                        <span className={isActive || slotStatus === 'active' ? "ml-3" : ""}>
                          {timeStr}
                        </span>
                        {!isGenerated && (
                          <span className="ml-1 text-[10px] opacity-50">+</span>
                        )}
                      </button>
                    );
                  } catch (error) {
                    console.error('渲染槽位失败:', error, slot);
                    return null;
                  }
                })}
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}
