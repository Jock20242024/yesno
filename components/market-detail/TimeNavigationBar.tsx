"use client";

import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronUp } from "lucide-react";
import dayjs from "@/lib/dayjs";

interface SlotItem {
  id: string;
  startTime: string;
  endTime: string;
  status: 'ended' | 'active' | 'upcoming';
}

interface TimeNavigationBarProps {
  slots: SlotItem[];
  currentMarketId: string;
  period?: number | null;
  templateId?: string | null;
  onOpenDrawer?: () => void; // 🔥 打开抽屉的回调函数
}

export default function TimeNavigationBar({
  slots: slotsProp,
  currentMarketId,
  period = 15,
  templateId,
  onOpenDrawer,
}: TimeNavigationBarProps) {
  // 🔥 关键修复：所有 hooks 必须在早期返回之前调用
  const router = useRouter();
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const activeSlotRef = useRef<HTMLButtonElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);

  // 生成全天槽位
  const generateAllDaySlots = (periodMinutes: number) => {
    const slots = [];
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

  // 映射市场数据
  const mapSlotsToAllDaySlots = (allDaySlots: any[], apiSlots: SlotItem[]) => {
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

  // 计算状态
  const calculateSlotStatus = (startTime: dayjs.Dayjs, endTime: dayjs.Dayjs) => {
    const now = dayjs().local();
    const startTimeLocal = startTime.local();
    const endTimeLocal = endTime.local();
    
    if (now.isSameOrAfter(startTimeLocal) && now.isBefore(endTimeLocal)) {
      return 'active';
    }
    
    if (now.isBefore(startTimeLocal)) {
      return 'upcoming';
    }
    
    return 'ended';
  };

  // 格式化时间：简单格式 HH:mm
  const formatTime = (date: dayjs.Dayjs): string => {
    return date.local().format('HH:mm');
  };

  // 处理场次点击（这个函数用于导航栏中的按钮，菜单点击在 page.tsx 中处理）
  // 🔥 修复：允许选择未来场次和已结束场次，即使它们还没有生成
  const handleSlotClick = async (slot: any) => {
    // 如果场次已生成，直接跳转
    if (slot.marketId && slot.marketId !== currentMarketId) {
      router.push(`/markets/${slot.marketId}`);
      return;
    }
    
    // 🔥 如果场次未生成但有 templateId，调用生成接口
    if (!slot.marketId && templateId) {
      try {
        const endTime = slot.endTime.utc().toISOString();
        
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
          } else {
            console.warn('生成市场失败:', result.error || '未知错误');
          }
        } else {
          console.warn('生成市场请求失败:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('生成市场失败:', error);
      }
      return;
    }
    
    // 如果没有 templateId，无法生成，但至少允许用户看到提示
    if (!slot.marketId && !templateId) {
      console.warn('该场次尚未预生成，且没有模板ID，无法生成');
    }
  };

  // 计算槽位数据（必须在 hooks 之后，但在早期返回之前）
  const shouldRender = period && period >= 15 && period <= 1440;
  const hasSlots = slotsProp && slotsProp.length > 0;

  // 生成数据（仅在需要时计算）
  const navigationData = shouldRender && hasSlots ? (() => {
    const allDaySlots = generateAllDaySlots(period);
    const mappedSlots = mapSlotsToAllDaySlots(allDaySlots, slotsProp || []);
    
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

    return { visibleSlots, currentIndex, allMappedSlots: mappedSlots };
  })() : { visibleSlots: [], currentIndex: 0, allMappedSlots: [] };

  const { visibleSlots, currentIndex, allMappedSlots } = navigationData;

  // 处理菜单中的场次点击
  // 🔥 修复：允许选择未来场次和已结束场次，即使它们还没有生成
  const handleMenuSlotClick = async (slot: any) => {
    // 如果场次已生成，直接跳转
    if (slot.marketId && slot.marketId !== currentMarketId) {
      router.push(`/markets/${slot.marketId}`);
      setIsMenuOpen(false);
      return;
    }
    
    // 🔥 如果场次未生成但有 templateId，调用生成接口
    if (!slot.marketId && templateId) {
      setIsMenuOpen(false); // 先关闭菜单
      try {
        const endTime = slot.endTime.utc().toISOString();
        
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
          } else {
            console.warn('生成市场失败:', result.error || '未知错误');
          }
        } else {
          console.warn('生成市场请求失败:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('生成市场失败:', error);
      }
      return;
    }
    
    // 如果没有 templateId，无法生成，但至少允许用户看到提示
    if (!slot.marketId && !templateId) {
      console.warn('该场次尚未预生成，且没有模板ID，无法生成');
      setIsMenuOpen(false);
    }
  };

  // 点击外部关闭菜单
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        moreButtonRef.current &&
        !moreButtonRef.current.contains(target)
      ) {
        setIsMenuOpen(false);
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  // 🔥 useEffect 必须在早期返回之前
  useEffect(() => {
    if (!shouldRender || !hasSlots) return;
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
  }, [currentIndex, visibleSlots.length, shouldRender, hasSlots]);

  // 早期返回：必须在所有 hooks 之后
  if (!shouldRender) {
    return null;
  }

  if (!hasSlots) {
    return (
      <div className="relative mb-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex-shrink-0 px-4 py-1 rounded-full text-sm bg-gray-800/30 text-gray-500 border border-gray-700/30 animate-pulse"
            >
              加载中...
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative mb-6" style={{ overflow: 'visible' }}>
      <div className="flex items-center gap-2 overflow-x-auto pb-2" style={{ overflowY: 'visible' }}>
        <div 
          ref={scrollContainerRef}
          className="flex gap-2 flex-1 overflow-x-auto"
        >
          {visibleSlots.map((slot) => {
            const slotStatus = calculateSlotStatus(slot.startTime, slot.endTime);
            const isActive = slot.marketId === currentMarketId;
            const isHighlighted = isActive || slotStatus === 'active';
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
                      : "bg-gray-800/50 text-gray-300 hover:bg-gray-800 opacity-70"
                  }
                `}
              >
                {isHighlighted && (
                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                )}
                <span className={isHighlighted ? "ml-2" : ""}>{timeStr}</span>
              </button>
            );
          })}
        </div>
        
        {/* 更多按钮：切换菜单 */}
        <div className="relative flex-shrink-0">
          <button
            ref={moreButtonRef}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              
              // 计算按钮位置
              if (moreButtonRef.current) {
                const rect = moreButtonRef.current.getBoundingClientRect();
                // 菜单定位在按钮正上方，右对齐
                setMenuPosition({
                  top: rect.top, // 按钮顶部位置
                  right: window.innerWidth - rect.right, // 从右边计算距离，右对齐
                });
              }
              
              setIsMenuOpen(!isMenuOpen);
              onOpenDrawer?.(); // 保留向后兼容的回调
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700 transition-all"
          >
            <span>更多的</span>
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Popover 菜单：使用 Portal 渲染到 document.body */}
      {isMenuOpen && menuPosition && typeof window !== 'undefined' && createPortal(
        <>
          {/* 透明背景遮罩 */}
          <div 
            className="fixed inset-0 bg-transparent z-[99998]" 
            onClick={() => setIsMenuOpen(false)} 
          />
          
          {/* 菜单内容 */}
          <div 
            ref={menuRef}
            className="fixed w-auto whitespace-nowrap bg-[#1e2226] border border-[#2d3339] rounded-xl shadow-2xl py-2 overflow-hidden z-[99999]"
            onClick={(e) => e.stopPropagation()}
            style={{ 
              maxHeight: '320px',
              top: `${menuPosition.top}px`,
              right: `${menuPosition.right}px`,
              transform: 'translateY(calc(-100% - 12px))', // 向上偏移100%高度 + 12px 间距
            }}
          >
            <div className="max-h-[320px] overflow-y-auto">
              {allMappedSlots.map((slot) => {
                const now = dayjs().local();
                const startTimeLocal = slot.startTime.local();
                const endTimeLocal = slot.endTime.local();
                const isActive = now.isSameOrAfter(startTimeLocal) && now.isBefore(endTimeLocal);
                const isCurrent = slot.marketId === currentMarketId;
                const isHighlighted = isActive || isCurrent;
                const timeStr = startTimeLocal.format('HH:mm');
                
                return (
                  <div
                    key={slot.slotKey}
                    onClick={() => handleMenuSlotClick(slot)}
                    className={`px-4 py-3 text-sm cursor-pointer transition-colors ${
                      isHighlighted
                        ? "bg-[#2d3339] text-white"
                        : "text-[#94a3b8] hover:bg-[#2d3339]"
                    }`}
                  >
                    当地时间 {timeStr}
                  </div>
                );
              })}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
