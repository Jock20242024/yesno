"use client";

import { useState, useMemo } from "react";
import { X, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { formatUSD } from "@/lib/utils";
import { CRYPTO_CONFIG, parseFee } from "@/lib/constants/cryptoConfig";

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalance: number;
}

type CryptoType = "USDT" | "USDC";
type NetworkId = "TRC20" | "ERC20" | "BEP20" | "POLYGON";

export default function WithdrawModal({
  isOpen,
  onClose,
  availableBalance,
}: WithdrawModalProps) {
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoType>("USDC");
  const [address, setAddress] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkId>("POLYGON");
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);

  // 根据选中的币种获取可用网络
  const availableNetworks = useMemo(() => {
    return CRYPTO_CONFIG[selectedCrypto]?.networks || [];
  }, [selectedCrypto]);

  // 初始化时设置默认网络
  useMemo(() => {
    if (availableNetworks.length > 0 && !availableNetworks.find(n => n.id === selectedNetwork)) {
      setSelectedNetwork(availableNetworks[0].id as NetworkId);
    }
  }, [availableNetworks, selectedNetwork]);

  // 获取当前选中网络的手续费
  const networkFee = useMemo(() => {
    const network = availableNetworks.find(n => n.id === selectedNetwork);
    return network ? parseFee(network.fee) : 0;
  }, [availableNetworks, selectedNetwork]);

  if (!isOpen) return null;

  const amountNum = parseFloat(amount) || 0;
  const actualAmount = Math.max(0, amountNum - networkFee);
  const isValid =
    address.length > 0 &&
    amountNum > 0 &&
    amountNum <= availableBalance &&
    networkFee < amountNum;

  const handleMax = () => {
    setAmount(availableBalance.toString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setIsLoading(true);

    // 模拟 API 调用
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setIsLoading(false);
    const selectedNetworkConfig = availableNetworks.find(n => n.id === selectedNetwork);
    try {
      toast.success("提现成功", {
        description: `已提交提现申请，预计 ${selectedNetworkConfig?.arrival || "5-10 分钟"} 到账`,
        duration: 3000,
      });
    } catch (e) {
      console.error("toast failed", e);
    }

    // 重置表单并关闭
    setAddress("");
    setAmount("");
    onClose();
  };

  const selectedNetworkConfig = availableNetworks.find(n => n.id === selectedNetwork);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-pm-card rounded-xl border border-white/10 shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* 模态框头部 */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-pm-card z-10">
          <h2 className="text-xl font-bold text-white">提现</h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 模态框内容 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 步骤一：选择币种 */}
          <div>
            <label className="block text-sm font-medium text-zinc-500 mb-2">
              选择币种
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedCrypto("USDC");
                  const usdcNetworks = CRYPTO_CONFIG.USDC.networks;
                  if (usdcNetworks.length > 0) {
                    setSelectedNetwork(usdcNetworks[0].id as NetworkId);
                  }
                }}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold transition-all border ${
                  selectedCrypto === "USDC"
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : "bg-pm-bg text-zinc-500 border-white/10 hover:bg-white/10"
                }`}
              >
                USDC
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedCrypto("USDT");
                  const usdtNetworks = CRYPTO_CONFIG.USDT.networks;
                  if (usdtNetworks.length > 0) {
                    setSelectedNetwork(usdtNetworks[0].id as NetworkId);
                  }
                }}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold transition-all border ${
                  selectedCrypto === "USDT"
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : "bg-pm-bg text-zinc-500 border-white/10 hover:bg-white/10"
                }`}
              >
                USDT
              </button>
            </div>
          </div>

          {/* 步骤二：提现地址 */}
          <div>
            <label
              htmlFor="withdraw-address"
              className="block text-sm font-medium text-zinc-500 mb-2"
            >
              提现地址
            </label>
            <input
              id="withdraw-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={selectedNetwork === "TRC20" ? "TX8..." : "0x..."}
              disabled={isLoading}
              className="w-full bg-pm-bg border border-white/10 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all disabled:opacity-50 font-mono text-sm"
              required
            />
          </div>

          {/* 步骤三：转账网络 */}
          <div>
            <label className="block text-sm font-medium text-zinc-500 mb-2">
              转账网络
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNetworkDropdown(!showNetworkDropdown)}
                disabled={isLoading}
                className="w-full flex items-center justify-between px-4 py-3 bg-pm-bg border border-white/10 rounded-lg text-white hover:border-emerald-500/50 transition-all disabled:opacity-50"
              >
                <div className="text-left">
                  <div className="text-sm font-bold">{selectedNetworkConfig?.name}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    手续费 {selectedNetworkConfig?.fee} · 预计 {selectedNetworkConfig?.arrival} 到账
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${showNetworkDropdown ? "rotate-180" : ""}`} />
              </button>

              {showNetworkDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowNetworkDropdown(false)}
                  />
                  <div className="absolute top-full left-0 right-0 mt-2 bg-pm-bg border border-white/10 rounded-lg shadow-xl z-20 max-h-64 overflow-y-auto">
                    {availableNetworks.map((network) => (
                      <button
                        key={network.id}
                        type="button"
                        onClick={() => {
                          setSelectedNetwork(network.id as NetworkId);
                          setShowNetworkDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0 ${
                          selectedNetwork === network.id ? "bg-emerald-500/10" : ""
                        }`}
                      >
                        <div className="text-sm font-bold text-white">{network.name}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          手续费 {network.fee} · 预计 {network.arrival} 到账
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 步骤四：提现金额 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="withdraw-amount"
                className="block text-sm font-medium text-zinc-500"
              >
                提现金额
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">
                  可用: {formatUSD(availableBalance)}
                </span>
                <button
                  type="button"
                  onClick={handleMax}
                  disabled={isLoading}
                  className="text-xs text-emerald-500 hover:text-emerald-400 font-bold px-2 py-1 rounded hover:bg-emerald-500/10 transition-all disabled:opacity-50"
                >
                  Max
                </button>
              </div>
            </div>
            <div className="relative">
              <input
                id="withdraw-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                max={availableBalance}
                step="0.01"
                disabled={isLoading}
                className="w-full bg-pm-bg border border-white/10 rounded-lg px-4 py-3 pr-16 text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all disabled:opacity-50 font-mono text-lg"
                required
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <span className="text-sm font-bold text-zinc-500">{selectedCrypto}</span>
              </div>
            </div>
          </div>

          {/* 信息汇总 - 实时更新 */}
          <div className="bg-pm-bg rounded-lg border border-white/10 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">网络手续费 (Network Fee)</span>
              <span className="font-mono font-bold text-white">
                {formatUSD(networkFee)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm pt-2 border-t border-white/10">
              <span className="text-zinc-500">实际到账 (Receive Amount)</span>
              <span className="font-mono font-bold text-emerald-500">
                {formatUSD(actualAmount)}
              </span>
            </div>
          </div>

          {/* 确认按钮 */}
          <button
            type="submit"
            disabled={!isValid || isLoading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-pm-bg font-bold py-3.5 rounded-lg transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                处理中...
              </>
            ) : (
              "确认提现"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
