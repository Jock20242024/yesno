"use client";

import { useState, useMemo } from "react";
import { X, Copy, Check, ChevronDown, CreditCard } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { CRYPTO_CONFIG, generateMockAddress } from "@/lib/constants/cryptoConfig";
import { formatUSD } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type CryptoType = "USDT" | "USDC";
type NetworkId = "TRC20" | "ERC20" | "BEP20" | "POLYGON";
type DepositTab = "crypto" | "fiat";

interface PaymentProvider {
  id: string;
  name: string;
  description: string;
  fee: number; // 费率百分比
  recommended?: boolean;
}

const PAYMENT_PROVIDERS: PaymentProvider[] = [
  {
    id: "moonpay",
    name: "MoonPay",
    description: "支持 Visa/Mastercard",
    fee: 1.0,
    recommended: true,
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "支持 Apple Pay",
    fee: 2.0,
  },
];

export default function DepositModal({ isOpen, onClose }: DepositModalProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<DepositTab>("crypto");
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoType>("USDC");
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkId>("POLYGON");
  const [copied, setCopied] = useState(false);
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);
  
  // 法币购买相关状态
  const [fiatAmount, setFiatAmount] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string>("moonpay");

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

  // 生成当前网络的钱包地址
  const walletAddress = useMemo(() => {
    return generateMockAddress(selectedNetwork);
  }, [selectedNetwork]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      try {
        toast.success(t('wallet.deposit.copy_success'), {
          description: t('wallet.deposit.copy_success_desc'),
          duration: 2000,
        });
      } catch (e) {
        console.error("toast failed", e);
      }
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      try {
        toast.error(t('wallet.deposit.copy_failed'), {
          description: t('wallet.deposit.copy_failed_desc'),
        });
      } catch (e) {
        console.error("toast failed", e);
      }
    }
  };

  const selectedNetworkConfig = availableNetworks.find(n => n.id === selectedNetwork);

  // 计算法币购买的估算金额
  const estimatedReceive = useMemo(() => {
    const amount = parseFloat(fiatAmount) || 0;
    if (amount === 0) return 0;
    const provider = PAYMENT_PROVIDERS.find(p => p.id === selectedProvider);
    if (!provider) return 0;
    const feeAmount = amount * (provider.fee / 100);
    return amount - feeAmount;
  }, [fiatAmount, selectedProvider]);

  const handleFiatPurchase = () => {
    const provider = PAYMENT_PROVIDERS.find(p => p.id === selectedProvider);
    if (!provider) return;
    
    try {
      toast.info(t('wallet.deposit.redirect_payment'), {
        description: t('wallet.deposit.redirect_payment_desc', { provider: provider.name }),
        duration: 3000,
      });
    } catch (e) {
      console.error("toast failed", e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-pm-card rounded-xl border border-white/10 shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* 模态框头部 */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-pm-card z-10">
          <h2 className="text-xl font-bold text-white">{t('wallet.deposit.title')}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab("crypto")}
            className={`flex-1 px-4 py-3 text-sm font-bold transition-all border-b-2 ${
              activeTab === "crypto"
                ? "border-pm-green text-pm-green"
                : "border-transparent text-zinc-500 hover:text-white"
            }`}
          >
            {t('wallet.deposit.tab_crypto')}
          </button>
          <button
            onClick={() => setActiveTab("fiat")}
            className={`flex-1 px-4 py-3 text-sm font-bold transition-all border-b-2 ${
              activeTab === "fiat"
                ? "border-pm-green text-pm-green"
                : "border-transparent text-zinc-500 hover:text-white"
            }`}
          >
            <CreditCard className="w-4 h-4 inline-block mr-2" />
            {t('wallet.deposit.tab_fiat')}
          </button>
        </div>

        {/* 模态框内容 */}
        <div className="p-6 space-y-6">
          {activeTab === "crypto" ? (
            <>
              {/* 数字货币充值面板 */}
          {/* 步骤一：选择币种 */}
          <div>
            <label className="block text-sm font-medium text-zinc-500 mb-2">
              {t('wallet.deposit.select_crypto')}
            </label>
            <div className="flex gap-2">
              <button
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

          {/* 步骤二：选择网络 */}
          <div>
            <label className="block text-sm font-medium text-zinc-500 mb-2">
              {t('wallet.deposit.select_network')}
            </label>
            <div className="relative">
              <button
                onClick={() => setShowNetworkDropdown(!showNetworkDropdown)}
                className="w-full flex items-center justify-between px-4 py-3 bg-pm-bg border border-white/10 rounded-lg text-white hover:border-emerald-500/50 transition-all"
              >
                <div className="text-left">
                  <div className="text-sm font-bold">{selectedNetworkConfig?.name}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {t('wallet.deposit.network_fee')} {selectedNetworkConfig?.fee ?? ''} · {t('wallet.deposit.est_arrival', { time: selectedNetworkConfig?.arrival ?? '' })}
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
                          {t('wallet.deposit.network_fee')} {network.fee} · {t('wallet.deposit.est_arrival', { time: network.arrival })}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 步骤三：显示地址和二维码 */}
          <div className="flex flex-col items-center gap-4 p-6 bg-pm-bg rounded-xl border border-white/10">
            <div className="bg-white p-4 rounded-lg">
              <QRCodeSVG
                value={walletAddress}
                size={200}
                level="H"
                includeMargin={false}
              />
            </div>
            <div className="text-center">
              <p className="text-xs text-zinc-500 mb-2">{t('wallet.deposit.scan_qr')}</p>
            </div>
          </div>

          {/* 地址栏 */}
          <div>
            <label className="block text-sm font-medium text-zinc-500 mb-2">
              {t('wallet.deposit.wallet_address')}
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-pm-bg border border-white/10 rounded-lg px-4 py-3 font-mono text-sm text-white break-all">
                {walletAddress}
              </div>
              <button
                onClick={handleCopy}
                className="flex-shrink-0 px-4 py-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-500 font-bold transition-all flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    {t('wallet.deposit.copied')}
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    {t('wallet.deposit.copy')}
                  </>
                )}
              </button>
            </div>
          </div>

              {/* 提示语 */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                <p className="text-xs text-amber-500 leading-relaxed">
                  ⚠️ {t('wallet.deposit.warning', { crypto: selectedCrypto, network: selectedNetworkConfig?.name || '' })}
                </p>
              </div>
            </>
          ) : (
            <>
              {/* 银行卡购买面板 */}
              {/* 金额输入 */}
              <div>
                <label className="block text-sm font-medium text-zinc-500 mb-2">
                  {t('wallet.deposit.amount_label')}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={fiatAmount}
                    onChange={(e) => setFiatAmount(e.target.value)}
                    placeholder={t('wallet.deposit.amount_placeholder')}
                    min="0"
                    step="0.01"
                    className="w-full bg-pm-bg border border-white/10 rounded-lg px-4 py-3 pr-16 text-white placeholder-zinc-500 focus:border-pm-green focus:ring-1 focus:ring-pm-green transition-all font-mono text-lg"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <span className="text-sm font-bold text-zinc-500">USD</span>
                  </div>
                </div>
              </div>

              {/* 估算预览 */}
              {fiatAmount && parseFloat(fiatAmount) > 0 && (
                <div className="bg-pm-bg rounded-lg border border-white/10 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-zinc-500">{t('wallet.deposit.est_receive')}</span>
                    <span className="text-lg font-bold font-mono text-emerald-500">
                      {estimatedReceive.toFixed(2)} USDC
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    {t('wallet.deposit.fees_included')}
                  </p>
                </div>
              )}

              {/* 服务商选择 */}
              <div>
                <label className="block text-sm font-medium text-zinc-500 mb-3">
                  {t('wallet.deposit.select_provider')}
                </label>
                <div className="space-y-2">
                  {PAYMENT_PROVIDERS.map((provider) => (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => setSelectedProvider(provider.id)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        selectedProvider === provider.id
                          ? "border-pm-green bg-pm-green/10"
                          : "border-white/10 bg-pm-bg hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">
                              {provider.name}
                            </span>
                            {provider.recommended && (
                              <span className="text-xs px-2 py-0.5 rounded bg-pm-green/20 text-pm-green font-medium">
                                {t('wallet.deposit.recommended')}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500 mt-1">
                            {provider.description}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-zinc-400">
                            {t('wallet.deposit.fee_rate', { fee: provider.fee })}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 购买按钮 */}
              <button
                onClick={handleFiatPurchase}
                disabled={!fiatAmount || parseFloat(fiatAmount) <= 0}
                className="w-full bg-pm-green hover:bg-green-400 text-pm-bg font-bold py-3.5 rounded-lg transition-all shadow-lg shadow-pm-green/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('wallet.deposit.continue_pay')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
