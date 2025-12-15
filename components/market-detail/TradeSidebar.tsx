"use client";

import { useState, useRef, forwardRef, useImperativeHandle, useEffect } from "react";
import { CheckCircle2, Trophy, Loader2 } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useNotification } from "@/components/providers/NotificationProvider";
import { useStore } from "@/app/context/StoreContext";
import { formatUSD } from "@/lib/utils";
import { toast } from "sonner";
import confetti from "canvas-confetti";

interface UserPosition {
  yesShares: number;
  noShares: number;
  yesAvgPrice: number;
  noAvgPrice: number;
}

interface TradeSidebarProps {
  yesPercent?: number;
  noPercent?: number;
  marketId?: number;
  userPosition?: UserPosition | null;
  marketTitle?: string;
  marketStatus: "OPEN" | "RESOLVED";
  winningOutcome?: "YES" | "NO" | null;
  activeTab: "buy" | "sell";
  onTabChange: (tab: "buy" | "sell") => void;
  amount: string;
  onAmountChange: (val: string) => void;
  feeRate?: number; // 交易费率（例如 0.02 表示 2%）
}

export interface TradeSidebarRef {
  focusInput: () => void;
  switchToSell: () => void;
}

// 滑点常量（0.1%）
const SLIPPAGE = 0.001;

const TradeSidebar = forwardRef<TradeSidebarRef, TradeSidebarProps>(({
  marketStatus,
  winningOutcome,
  userPosition,
  yesPercent = 50,
  noPercent = 50,
  marketId = 1,
  marketTitle = "市场",
  activeTab,
  onTabChange,
  amount,
  onAmountChange,
  feeRate = 0, // 默认费率为 0，如果父组件没传的话
}, ref) => {
  const { isLoggedIn, user, updateBalance } = useAuth();
  const { addNotification } = useNotification();
  const { executeTrade, balance: storeBalance, updateBalance: updateStoreBalance } = useStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tradeType, setTradeType] = useState<"YES" | "NO">("YES");
  const [selectedOutcome, setSelectedOutcome] = useState<"yes" | "no">("yes");
  const [internalAmount, setInternalAmount] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  
  // 使用内部状态或外部传入的 amount
  const displayAmount = amount || internalAmount;
  const handleAmountChange = (val: string) => {
    setInternalAmount(val);
    if (onAmountChange) {
      onAmountChange(val);
    }
  };
  const hasInitialized = useRef(false);
  const lastBalanceRef = useRef<number>(0);

  // 当切换到卖出模式时，自动选择持仓的方向
  useEffect(() => {
    if (activeTab === "sell" && userPosition) {
      if (userPosition.yesShares > 0) {
        setSelectedOutcome("yes");
        setTradeType("YES");
      } else if (userPosition.noShares > 0) {
        setSelectedOutcome("no");
        setTradeType("NO");
      }
    }
  }, [activeTab, userPosition]);
  
  // 同步 selectedOutcome 和 tradeType
  useEffect(() => {
    setTradeType(selectedOutcome === "yes" ? "YES" : "NO");
  }, [selectedOutcome]);

  // 同步 Store 余额到 AuthContext（当 Store 余额变化时）
  // 使用 useRef 防止无限循环 - 仅在组件 Mount 时执行一次，之后只在余额真正变化时更新
  useEffect(() => {
    if (!isLoggedIn || !user) {
      hasInitialized.current = false;
      return;
    }
    
    // 只在首次挂载时初始化，避免死循环
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      lastBalanceRef.current = storeBalance;
      // 只在首次挂载时同步一次，避免触发循环
      const currentBalanceStr = user.balance.replace(/[$,]/g, '');
      const currentBalance = parseFloat(currentBalanceStr) || 0;
      // 如果余额差异较大，才更新
      if (Math.abs(storeBalance - currentBalance) > 0.01) {
        updateBalance(formatUSD(storeBalance));
      }
      return;
    }
    
    // 之后只在余额真正变化时更新（变化超过 0.01）
    const balanceChanged = Math.abs(storeBalance - lastBalanceRef.current) > 0.01;
    if (balanceChanged) {
      lastBalanceRef.current = storeBalance;
      updateBalance(formatUSD(storeBalance));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeBalance, isLoggedIn]); // 移除 user 从依赖项，使用 useRef 防止循环

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    focusInput: () => {
      inputRef.current?.focus();
    },
    switchToSell: () => {
      onTabChange("sell");
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    },
  }));

  // 处理兑换奖金
  const handleRedeem = async () => {
    if (!isLoggedIn) {
      toast.error("请先登录", {
        description: "您需要登录才能兑换奖金",
        duration: 3000,
      });
      return;
    }

    if (!userPosition || !winningOutcome) {
      toast.error("错误", {
        description: "您没有可兑换的持仓",
        duration: 3000,
      });
      return;
    }

    const winAmount = winningOutcome === "YES" 
      ? (userPosition.yesShares || 0) 
      : (userPosition.noShares || 0);

    if (winAmount <= 0) {
      toast.error("错误", {
        description: "您没有可兑换的持仓",
        duration: 3000,
      });
      return;
    }

    setIsLoading(true);

    // 模拟 API 调用延迟
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 触发烟花特效
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'],
    });

    // 更新余额（通过 Store 的 updateBalance）
    updateStoreBalance(storeBalance + winAmount);
    
    // 持仓会自动从 Store 更新，不需要手动设置

    // 显示成功提示
    toast.success("奖金已到账！", {
      description: `已成功兑换 ${formatUSD(winAmount)}`,
      duration: 5000,
    });

    addNotification({
      title: "奖金已到账",
      message: `成功兑换 ${winAmount} ${winningOutcome} 份额，获得 ${formatUSD(winAmount)}`,
      type: "success",
    });

    setIsLoading(false);
  };

  // 1. 如果市场已结束 (RESOLVED) -> 显示兑换面板
  if (marketStatus === "RESOLVED") {
    const isWinner = (winningOutcome === "YES" && userPosition?.yesShares && userPosition.yesShares > 0) ||
                     (winningOutcome === "NO" && userPosition?.noShares && userPosition.noShares > 0);

    const winAmount = winningOutcome === "YES" 
      ? (userPosition?.yesShares || 0) 
      : (userPosition?.noShares || 0);

    return (
      <div className="w-full lg:w-[380px] flex-shrink-0">
        <div className="sticky top-24 flex flex-col gap-4 bg-pm-card border border-pm-border p-6 rounded-2xl">
          <h2 className="text-xl font-bold text-white mb-2">市场已结束</h2>
          
          {isWinner ? (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6 text-center">
              <div className="text-blue-400 font-bold text-lg mb-1 flex items-center justify-center gap-2">
                <Trophy className="w-5 h-5" />
                恭喜获胜!
              </div>
              <div className="text-zinc-400 text-sm mb-4">您压中了 {winningOutcome}</div>
              <div className="text-3xl font-bold text-white mb-2 font-mono">
                {formatUSD(winAmount)}
              </div>
              <div className="text-zinc-500 text-sm mb-6">可兑换金额</div>
              <button
                onClick={handleRedeem}
                disabled={isLoading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    处理中...
                  </>
                ) : (
                  "兑换奖金 (Redeem)"
                )}
              </button>
            </div>
          ) : (
            <div className="bg-zinc-800/50 rounded-xl p-6 text-center text-zinc-500">
              <div className="text-sm">市场已结束 (Market Closed)</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. 如果市场进行中 (OPEN) -> 显示正常交易面板
  const yesPrice = yesPercent / 100;
  const noPrice = noPercent / 100;
  const selectedPrice = selectedOutcome === "yes" ? yesPrice : noPrice;
  const amountNum = parseFloat(amount) || 0;

  // 手续费常量（与 StoreContext 保持一致）
  const FEE_RATE = 0.02; // 2%

  // 计算逻辑（与 StoreContext 完全一致）
  let estShares = 0;
  let estReturn = 0;
  let priceImpact = 0;

  if (activeTab === "buy" && amountNum > 0) {
    // Buy 模式：预估份额 = (amount * (1 - 0.02)) / price
    // 与 StoreContext 中的 netInvest = inputVal * (1 - FEE_RATE) 和 newShares = netInvest / price 一致
    const netInvest = amountNum * (1 - FEE_RATE);
    estShares = netInvest > 0 && selectedPrice > 0
      ? netInvest / selectedPrice
      : 0;
    estReturn = estShares * 1.0; // 潜在回报 = 份额 * $1
    priceImpact = 0; // 不显示滑点，保持简洁
  } else if (activeTab === "sell" && amountNum > 0) {
    // Sell 模式：预估收到 = (amountShares * price) * (1 - 0.02)
    // 与 StoreContext 中的 grossValue = shares * price 和 netReturn = grossValue * (1 - FEE_RATE) 一致
    const grossValue = amountNum * selectedPrice;
    estReturn = grossValue * (1 - FEE_RATE);
    estShares = amountNum; // 卖出份额就是输入的份额
    priceImpact = 0; // 不显示滑点，保持简洁
  }

  // ROI 计算
  const roi = activeTab === "buy"
    ? (amountNum > 0 ? ((estReturn - amountNum) / amountNum) * 100 : 0)
    : (userPosition && amountNum > 0
      ? ((estReturn - (amountNum * (selectedOutcome === "yes" ? userPosition.yesAvgPrice : userPosition.noAvgPrice))) / (amountNum * (selectedOutcome === "yes" ? userPosition.yesAvgPrice : userPosition.noAvgPrice))) * 100
      : 0);

  // 优先使用 Store 的余额，如果没有则使用 AuthContext 的余额
  const availableBalance = isLoggedIn 
    ? (storeBalance > 0 ? storeBalance : (user?.balance ? parseFloat(user.balance.replace(/[$,]/g, '')) || 0 : 0))
    : 0;

  // 可用份额（卖出模式）
  const availableShares = activeTab === "sell" && userPosition
    ? (selectedOutcome === "yes" ? userPosition.yesShares : userPosition.noShares)
    : 0;

  // 余额/份额校验
  const isInsufficientBalance = activeTab === "buy"
    ? amountNum > availableBalance
    : amountNum > availableShares;

  const handleTrade = async () => {
    if (!isLoggedIn) {
      toast.error("请先登录", {
        description: "您需要登录才能进行交易",
        duration: 3000,
      });
      return;
    }

    if (amountNum <= 0) {
      toast.error("请输入" + (activeTab === "buy" ? "金额" : "份额"), {
        description: `请输入大于 0 的${activeTab === "buy" ? "金额" : "份额"}`,
        duration: 3000,
      });
      return;
    }

    if (isInsufficientBalance) {
      toast.error(activeTab === "buy" ? "余额不足" : "份额不足", {
        description: activeTab === "buy"
          ? `您的余额不足，当前余额: ${formatUSD(availableBalance)}`
          : `您持有的 ${selectedOutcome === "yes" ? "Yes" : "No"} 份额不足，当前持有 ${availableShares.toFixed(2)} 份额`,
        duration: 3000,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // 调用全局 Store 进行交易
      const marketIdStr = marketId.toString();
      const outcome = selectedOutcome === "yes" ? "YES" : "NO";
      
      // 重要：Buy 模式传入金额，Sell 模式传入份额
      const inputValue = amountNum;
      
      await executeTrade(
        activeTab,
        marketIdStr,
        outcome,
        inputValue,
        selectedPrice
      );

      // 成功反馈
      onAmountChange("");
      
      toast.success(activeTab === "buy" ? "订单已提交！" : "卖出成功！", {
        description: activeTab === "buy"
          ? `已成功买入 ${outcome} ${estShares.toFixed(2)} 份额`
          : `已成功卖出 ${outcome} ${amountNum.toFixed(2)} 份额，收到 ${formatUSD(estReturn)}`,
        duration: 3000,
      });

      addNotification({
        title: "订单已成交",
        message: `${activeTab === "buy" ? "买入" : "卖出"} ${outcome} - ${marketTitle}`,
        type: "success",
      });
    } catch (error) {
      console.error("交易失败:", error);
      toast.error("交易失败", {
        description: "请稍后重试",
        duration: 3000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full lg:w-[380px] flex-shrink-0">
      <div className="flex flex-col gap-4 bg-pm-card border border-pm-border p-6 rounded-2xl lg:sticky lg:top-24">
        {/* Buy/Sell Tabs */}
        <div className="flex bg-pm-bg p-1 rounded-lg border border-pm-border">
          <button
            onClick={() => onTabChange("buy")}
            className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
              activeTab === "buy"
                ? "bg-pm-card text-white shadow-sm border border-pm-border/50"
                : "text-pm-text-dim hover:text-white"
            }`}
          >
            买入
          </button>
          <button
            onClick={() => onTabChange("sell")}
            className={`flex-1 py-2 text-sm font-bold transition-all ${
              activeTab === "sell"
                ? "bg-pm-card text-white shadow-sm border border-pm-border/50"
                : "text-pm-text-dim hover:text-white"
            }`}
          >
            卖出
          </button>
        </div>

        {/* Outcome Selection */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setSelectedOutcome("yes")}
            className={`relative flex flex-col items-center justify-center py-3 px-4 rounded-xl border-2 transition-all ${
              selectedOutcome === "yes"
                ? "border-pm-green bg-pm-green/10"
                : "border-pm-border bg-transparent hover:border-pm-text-dim/50"
            }`}
          >
            <span className={`text-lg font-black uppercase tracking-wide ${
              selectedOutcome === "yes" ? "text-pm-green" : "text-pm-text-dim"
            }`}>
              Yes
            </span>
            <span className={`text-xs font-mono font-bold mt-1 ${
              selectedOutcome === "yes" ? "text-white" : "text-pm-text-dim"
            }`}>
              {formatUSD(yesPrice)}
            </span>
            {selectedOutcome === "yes" && (
              <div className="absolute -top-2 -right-2 bg-pm-bg rounded-full">
                <CheckCircle2 className="w-5 h-5 text-pm-green bg-white rounded-full" />
              </div>
            )}
          </button>
          <button
            onClick={() => setSelectedOutcome("no")}
            className={`flex flex-col items-center justify-center py-3 px-4 rounded-xl border-2 transition-all ${
              selectedOutcome === "no"
                ? "border-pm-red bg-pm-red/10"
                : "border-pm-border bg-transparent hover:border-pm-text-dim/50"
            }`}
          >
            <span className={`text-lg font-black uppercase tracking-wide ${
              selectedOutcome === "no" ? "text-pm-red" : "text-pm-text-dim"
            }`}>
              No
            </span>
            <span className={`text-xs font-mono font-bold mt-1 ${
              selectedOutcome === "no" ? "text-white" : "text-pm-text-dim"
            }`}>
              {formatUSD(noPrice)}
            </span>
            {selectedOutcome === "no" && (
              <div className="absolute -top-2 -right-2 bg-pm-bg rounded-full">
                <CheckCircle2 className="w-5 h-5 text-pm-green bg-white rounded-full" />
              </div>
            )}
          </button>
        </div>

        {/* 输入框 Label */}
        <div className="flex justify-between text-xs font-medium">
          <span className="text-pm-text-dim">
            {activeTab === "buy" ? "金额 (Amount)" : "份额 (Shares)"}
          </span>
          <span className="text-pm-text-dim flex items-center gap-1">
            可用:{" "}
            {activeTab === "buy" ? (
              <span className="text-white font-mono">
                {formatUSD(availableBalance)} USD
              </span>
            ) : (
              <span className="text-white font-mono">
                {availableShares.toFixed(2)} {selectedOutcome === "yes" ? "Yes" : "No"}
              </span>
            )}
          </span>
        </div>

        {/* 金额/份额输入 */}
        <div className="relative">
          <input
            ref={inputRef}
            type="number"
            placeholder="0"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            className="w-full bg-pm-bg border border-pm-border rounded-xl px-4 py-4 pr-20 text-2xl font-bold text-white placeholder:text-pm-border focus:outline-none focus:border-pm-green focus:ring-1 focus:ring-pm-green"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 font-medium text-sm">
            {activeTab === "buy" ? "USD" : "Shares"}
          </span>
        </div>

        {/* 交易信息摘要 - Polymarket 简洁风格 */}
        <div className="space-y-3 py-3 bg-pm-bg rounded-xl border border-pm-border/50 p-4">
          {/* 平均价格 */}
          <div className="flex justify-between items-center text-sm">
            <span className="text-pm-text-dim">平均价格</span>
            <span className="text-white font-mono font-medium">{formatUSD(selectedPrice)}</span>
          </div>

          {/* 滑点提示（小字显示） */}
          {priceImpact > 0 && amountNum > 0 && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-500">价格影响</span>
              <span className="text-zinc-500 font-mono">{priceImpact.toFixed(2)}%</span>
            </div>
          )}

          {/* 重点展示区域 */}
          {activeTab === "buy" ? (
            <>
              {/* Buy 模式：大字显示预估份额 */}
              <div className="pt-2 mt-2 border-t border-pm-border/50">
                <div className="flex justify-between items-baseline">
                  <span className="text-pm-text-dim text-sm">预估份额</span>
                  <span className="text-2xl font-bold text-white font-mono tabular-nums">
                    {estShares > 0 ? estShares.toFixed(4) : "0.0000"}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Sell 模式：大字显示预估收到 */}
              <div className="pt-2 mt-2 border-t border-pm-border/50">
                <div className="flex justify-between items-baseline">
                  <span className="text-pm-text-dim text-sm">预估收到</span>
                  <span className="text-2xl font-bold text-white font-mono tabular-nums">
                    {estReturn > 0 ? formatUSD(estReturn) : "$0.00"}
                  </span>
                </div>
              </div>
              {userPosition && (
                <div className="flex justify-between items-center text-xs text-zinc-500">
                  <span>平均成本</span>
                  <span className="font-mono">
                    {formatUSD(selectedOutcome === "yes" ? userPosition.yesAvgPrice : userPosition.noAvgPrice)}
                  </span>
                </div>
              )}
            </>
          )}

          {/* ROI */}
          {amountNum > 0 && (
            <div className="pt-2 mt-2 border-t border-pm-border/50 flex justify-between items-center text-sm">
              <span className="text-pm-text-dim">收益率 (ROI)</span>
              <span className={`font-mono font-bold ${
                roi >= 0 ? "text-pm-green" : "text-pm-red"
              }`}>
                {roi >= 0 ? "+" : ""}{roi.toFixed(2)}%
              </span>
            </div>
          )}
        </div>

        {/* 余额/份额不足提示 */}
        {isInsufficientBalance && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
            <p className="text-xs text-rose-500 font-medium text-center">
              {activeTab === "buy" ? "余额不足" : "份额不足"}
            </p>
          </div>
        )}

        {/* 卖出模式：无持仓提示 */}
        {activeTab === "sell" && (!userPosition || (selectedOutcome === "yes" && userPosition.yesShares === 0) || (selectedOutcome === "no" && userPosition.noShares === 0)) && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-amber-500 font-medium text-center">
              您当前没有持仓，无法卖出
            </p>
          </div>
        )}

        {/* 底部按钮 */}
        <button
          onClick={handleTrade}
          disabled={!isLoggedIn || amountNum <= 0 || isInsufficientBalance || isSubmitting || (activeTab === "sell" && (!userPosition || (selectedOutcome === "yes" && userPosition.yesShares === 0) || (selectedOutcome === "no" && userPosition.noShares === 0)))}
          className={`w-full py-3.5 font-bold rounded-xl transition-transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
            activeTab === "buy"
              ? "bg-pm-green hover:bg-green-400 text-pm-bg disabled:hover:bg-pm-green"
              : "bg-pm-red hover:bg-red-500 text-white disabled:hover:bg-pm-red"
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              正在处理...
            </>
          ) : isLoggedIn ? (
            `${activeTab === "buy" ? "买入" : "卖出"} ${selectedOutcome === "yes" ? "Yes" : "No"}`
          ) : (
            "登录以交易"
          )}
        </button>
      </div>
    </div>
  );
});

TradeSidebar.displayName = "TradeSidebar";

export default TradeSidebar;
