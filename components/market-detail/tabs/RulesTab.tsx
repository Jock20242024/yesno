"use client";

interface RulesTabProps {
  marketTitle?: string;
  endDate?: string;
}

export default function RulesTab({ marketTitle, endDate }: RulesTabProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="p-6 bg-pm-card border border-pm-border rounded-xl">
        <div className="flex flex-col gap-6 text-white">
          {/* 结算规则 */}
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-bold text-white">结算规则</h2>
            <div className="flex flex-col gap-2 text-sm text-pm-text-dim leading-relaxed">
              <p>
                此市场将根据以下条件进行结算：
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>
                  如果事件在截止日期前发生，市场将结算为 <span className="text-pm-green font-bold">YES</span>
                </li>
                <li>
                  如果事件在截止日期前未发生，市场将结算为 <span className="text-pm-red font-bold">NO</span>
                </li>
                <li>
                  结算结果将由官方数据源和可验证的信息确定
                </li>
              </ul>
            </div>
          </div>

          {/* 截止日期 */}
          <div className="flex flex-col gap-3 pt-4 border-t border-pm-border">
            <h2 className="text-lg font-bold text-white">截止日期</h2>
            <div className="flex flex-col gap-2 text-sm text-pm-text-dim">
              <p>
                市场将在以下日期和时间关闭：
              </p>
              <p className="text-white font-mono font-bold">
                {endDate || "2024-12-31 23:59:59 UTC"}
              </p>
            </div>
          </div>

          {/* 信息来源 */}
          <div className="flex flex-col gap-3 pt-4 border-t border-pm-border">
            <h2 className="text-lg font-bold text-white">信息来源</h2>
            <div className="flex flex-col gap-2 text-sm text-pm-text-dim leading-relaxed">
              <p>
                结算将基于以下官方和可验证的信息来源：
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>
                  官方公告和新闻发布
                </li>
                <li>
                  可验证的公共数据源
                </li>
                <li>
                  权威机构确认的信息
                </li>
              </ul>
              <p className="mt-2">
                如有争议，将根据最权威和可验证的信息源进行最终裁决。
              </p>
            </div>
          </div>

          {/* 重要条款 */}
          <div className="flex flex-col gap-3 pt-4 border-t border-pm-border">
            <h2 className="text-lg font-bold text-white">重要条款</h2>
            <div className="flex flex-col gap-2 text-sm text-pm-text-dim leading-relaxed">
              <p>
                <span className="text-primary font-bold">注意：</span> 请确保在参与交易前充分理解市场规则和风险。
              </p>
              <p>
                所有交易都是不可逆的，请在做出决定前仔细考虑。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

