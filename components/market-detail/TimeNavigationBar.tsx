"use client";

import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronUp } from "lucide-react";
import dayjs from "@/lib/dayjs";
import { useLanguage } from "@/i18n/LanguageContext";

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
  const { t } = useLanguage();
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

  // 🔥 修复：只处理已生成的市场，不触发生成逻辑
  // 市场应该由后台任务提前批量生成，不应该由用户点击触发
  const handleSlotClick = (slot: any) => {
    // 只有场次已生成且有marketId时，才允许跳转
    if (slot.marketId && slot.marketId !== currentMarketId) {
      router.push(`/markets/${slot.marketId}`);
    }
    // 如果场次未生成，不做任何操作（市场应该提前生成好）
  };

  // 计算槽位数据（必须在 hooks 之后，但在早期返回之前）
  const shouldRender = period && period >= 15 && period <= 1440;
  const hasSlots = slotsProp && slotsProp.length > 0;

  // 🔥 修复：只显示后端返回的已生成市场，不生成全天的空槽位
  // 参考Polymarket：只显示已存在的市场，不显示未生成的市场
  const navigationData = shouldRender && hasSlots ? (() => {
    // 将后端返回的slots转换为前端格式
    const mappedSlots = (slotsProp || []).map((slot) => {
      const startTimeLocal = dayjs(slot.startTime).local();
      const endTimeLocal = dayjs(slot.endTime).local();
      const slotKey = startTimeLocal.format('YYYY-MM-DD-HH-mm');
      
      return {
        slotKey,
        startTime: startTimeLocal,
        endTime: endTimeLocal,
        marketId: slot.id, // 🔥 使用slot.id作为marketId
        slotData: slot,
      };
    });
    
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

  // 🔥 修复：只处理已生成的市场，不触发生成逻辑
  // 市场应该由后台任务提前批量生成，不应该由用户点击触发
  const handleMenuSlotClick = (slot: any) => {
    // 如果点击的是当前市场，只关闭菜单
    if (slot.marketId === currentMarketId) {
      setIsMenuOpen(false);
      return;
    }
    
    // 只有场次已生成且有marketId时，才允许跳转
    if (slot.marketId) {
      setIsMenuOpen(false);
      router.push(`/markets/${slot.marketId}`);
          } else {
      // 如果场次未生成，只关闭菜单，不做任何操作（市场应该提前生成好）
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
          {visibleSlots.map((slot, index) => {
            const slotStatus = calculateSlotStatus(slot.startTime, slot.endTime);
            const isActive = slot.marketId === currentMarketId;
            const isHighlighted = isActive || slotStatus === 'active';
            const timeStr = formatTime(slot.startTime);
            
            // 🔥 修复：visibleSlots中只包含已生成的市场（marketId不为null）
            // 所以这里不需要检查hasMarket，直接显示即可
            return (
              <button
                key={`${slot.slotKey}-${index}`}
                ref={isHighlighted ? activeSlotRef : null}
                onClick={() => handleSlotClick(slot)}
                className={`
                  flex-shrink-0 px-4 py-1 rounded-full text-sm font-medium transition-all relative
                  border border-gray-700 cursor-pointer
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
            <span>{t('market.chart.more')}</span>
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
              {allMappedSlots.map((slot, index) => {
                const now = dayjs().local();
                const startTimeLocal = slot.startTime.local();
                const endTimeLocal = slot.endTime.local();
                const isActive = now.isSameOrAfter(startTimeLocal) && now.isBefore(endTimeLocal);
                const isCurrent = slot.marketId === currentMarketId;
                const isHighlighted = isActive || isCurrent;
                const timeStr = startTimeLocal.format('HH:mm');
                
                // 🔥 修复：allMappedSlots中只包含已生成的市场（marketId不为null）
                // 所以这里不需要检查hasMarket，直接显示即可
                return (
                  <div
                    key={`${slot.slotKey}-${index}`}
                    onClick={() => handleMenuSlotClick(slot)}
                    className={`px-4 py-3 text-sm transition-colors cursor-pointer ${
                      isHighlighted
                        ? "bg-[#2d3339] text-white"
                        : "text-[#94a3b8] hover:bg-[#2d3339]"
                    }`}
                  >
                    {t('market.time.local_time')} {timeStr}
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
