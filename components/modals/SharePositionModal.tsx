"use client";

import { useRef, useState } from "react";
import { X, Download, Share2 } from "lucide-react";
import { toPng } from "html-to-image";
import download from "downloadjs";
import { formatUSD } from "@/lib/utils";

interface Position {
  id: number;
  eventTitle: string;
  type: "YES" | "NO";
  investedAmount: number;
  buyPrice: number;
  currentPrice: number;
  profitAndLoss: number;
  purchaseTime: string;
}

interface SharePositionModalProps {
  position: Position | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function SharePositionModal({
  position,
  isOpen,
  onClose,
}: SharePositionModalProps) {
  const imageRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen || !position) return null;

  const profitPercent =
    position.profitAndLoss >= 0
      ? ((position.profitAndLoss / position.investedAmount) * 100).toFixed(1)
      : ((Math.abs(position.profitAndLoss) / position.investedAmount) * 100).toFixed(1);
  const isProfit = position.profitAndLoss >= 0;

  const handleDownload = async () => {
    if (!imageRef.current) return;

    setIsGenerating(true);
    try {
      const dataUrl = await toPng(imageRef.current, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: "#0e1217",
      });
      download(dataUrl, `yesno-position-${position.id}.png`, "image/png");
    } catch (error) {
      console.error("Failed to generate image:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-pm-card rounded-xl border border-pm-border shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* 模态框头部 */}
        <div className="flex items-center justify-between p-6 border-b border-pm-border">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            分享持仓
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-pm-card-hover text-pm-text-dim hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 可生成图片的内容区域 */}
        <div className="p-6">
          <div
            ref={imageRef}
            className="bg-pm-bg rounded-xl border-2 border-pm-border p-8 relative overflow-hidden"
            style={{ width: "600px", minHeight: "400px" }}
          >
            {/* Logo 和标题 */}
            <div className="flex items-center gap-3 mb-8">
              <div className="size-12 text-primary flex-shrink-0">
                <svg
                  className="w-full h-full"
                  fill="none"
                  viewBox="0 0 100 100"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="50" cy="50" fill="currentColor" r="50" />
                  <circle
                    cx="50"
                    cy="50"
                    opacity="0.3"
                    r="44"
                    stroke="#000"
                    strokeWidth="2"
                  />
                  <path
                    d="M50 6 A 44 44 0 0 1 50 94"
                    fill="#000"
                    fillOpacity="0.1"
                  />
                  <line
                    stroke="#000"
                    strokeLinecap="round"
                    strokeWidth="4"
                    x1="50"
                    x2="50"
                    y1="10"
                    y2="90"
                  />
                  <text
                    fill="#000"
                    fontFamily="sans-serif"
                    fontSize="18"
                    fontWeight="900"
                    textAnchor="middle"
                    transform="rotate(-90, 35, 50)"
                    x="35"
                    y="55"
                  >
                    YES
                  </text>
                  <text
                    fill="#000"
                    fontFamily="sans-serif"
                    fontSize="18"
                    fontWeight="900"
                    textAnchor="middle"
                    transform="rotate(90, 65, 50)"
                    x="65"
                    y="55"
                  >
                    NO
                  </text>
                </svg>
              </div>
              <h1 className="text-2xl font-black text-white">YesNo</h1>
            </div>

            {/* 核心持仓信息 */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-4 leading-tight">
                {position.eventTitle}
              </h2>

              <div className="flex items-center gap-4 mb-6">
                <span
                  className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-bold ${
                    position.type === "YES"
                      ? "bg-pm-green/20 text-pm-green border border-pm-green/30"
                      : "bg-pm-red/20 text-pm-red border border-pm-red/30"
                  }`}
                >
                  {position.type}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <div className="text-xs text-pm-text-dim mb-1">买入价格</div>
                  <div className="text-lg font-mono font-bold text-white">
                    {formatUSD(position.buyPrice)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-pm-text-dim mb-1">当前价格</div>
                  <div className="text-lg font-mono font-bold text-white">
                    {formatUSD(position.currentPrice)}
                  </div>
                </div>
              </div>

              <div className="bg-pm-card rounded-lg border border-pm-border p-4 mb-6">
                <div className="text-xs text-pm-text-dim mb-2">盈亏</div>
                <div className="flex items-baseline gap-3">
                  <div
                    className={`text-4xl font-black font-mono ${
                      isProfit ? "text-pm-green" : "text-pm-red"
                    }`}
                  >
                    {isProfit ? "+" : "-"}
                    {formatUSD(Math.abs(position.profitAndLoss))}
                  </div>
                  <div
                    className={`text-xl font-bold font-mono ${
                      isProfit ? "text-pm-green" : "text-pm-red"
                    }`}
                  >
                    {isProfit ? "+" : ""}
                    {profitPercent}%
                  </div>
                </div>
              </div>
            </div>

            {/* 底部邀请信息 */}
            <div className="flex items-center justify-between pt-6 border-t border-pm-border">
              <div className="flex-1">
                <div className="text-sm font-bold text-white mb-2">
                  我的邀请码: <span className="text-pm-green">888888</span>
                </div>
                <div className="text-xs text-pm-text-dim">
                  扫码加入全球最大的预测市场
                </div>
              </div>
              <div className="ml-6">
                {/* 占位二维码图片 */}
                <div className="size-24 bg-pm-card border-2 border-pm-border rounded-lg flex items-center justify-center">
                  <div className="text-xs text-pm-text-dim text-center">
                    QR Code
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 下载按钮 */}
          <div className="mt-6 flex justify-center">
            <button
              onClick={handleDownload}
              disabled={isGenerating}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-pm-green hover:bg-green-400 text-pm-bg font-bold transition-all shadow-lg shadow-pm-green/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-5 h-5" />
              {isGenerating ? "生成中..." : "下载图片"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

