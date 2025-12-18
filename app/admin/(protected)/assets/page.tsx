import { getAssetStats } from "@/app/actions/admin/get-asset-stats";

export default async function AssetsPage() {
  const stats = await getAssetStats();

  // 格式化金额显示
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-[#111418] dark:text-white">用户资产数据</h1>
        <p className="text-sm text-[#637588] dark:text-[#9da8b9] mt-1">
          平台财务汇总情况
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 总用户余额 */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-500 rounded-lg">
              <span className="material-symbols-outlined text-white text-2xl">account_balance_wallet</span>
            </div>
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded">
              总余额
            </span>
          </div>
          <div>
            <p className="text-sm text-[#637588] dark:text-[#9da8b9] mb-1">总用户余额</p>
            <p className="text-3xl font-bold text-[#111418] dark:text-white">
              {formatCurrency(stats.totalUserBalance)}
            </p>
          </div>
        </div>

        {/* 总充值金额 */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500 rounded-lg">
              <span className="material-symbols-outlined text-white text-2xl">trending_up</span>
            </div>
            <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/50 px-2 py-1 rounded">
              充值
            </span>
          </div>
          <div>
            <p className="text-sm text-[#637588] dark:text-[#9da8b9] mb-1">总充值金额</p>
            <p className="text-3xl font-bold text-[#111418] dark:text-white">
              {formatCurrency(stats.totalDeposits)}
            </p>
          </div>
        </div>

        {/* 总提现金额 */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-500 rounded-lg">
              <span className="material-symbols-outlined text-white text-2xl">trending_down</span>
            </div>
            <span className="text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/50 px-2 py-1 rounded">
              提现
            </span>
          </div>
          <div>
            <p className="text-sm text-[#637588] dark:text-[#9da8b9] mb-1">总提现金额</p>
            <p className="text-3xl font-bold text-[#111418] dark:text-white">
              {formatCurrency(stats.totalWithdrawals)}
            </p>
          </div>
        </div>
      </div>

      {/* 额外信息卡片 */}
      <div className="bg-card-light dark:bg-card-dark border border-[#e5e7eb] dark:border-[#283545] rounded-xl p-6">
        <h2 className="text-lg font-semibold text-[#111418] dark:text-white mb-4">统计说明</h2>
        <div className="space-y-2 text-sm text-[#637588] dark:text-[#9da8b9]">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-base mt-0.5">info</span>
            <p>
              <strong className="text-[#111418] dark:text-white">总用户余额：</strong>
              所有用户账户余额的总和
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-base mt-0.5">info</span>
            <p>
              <strong className="text-[#111418] dark:text-white">总充值金额：</strong>
              统计所有已完成状态的充值交易
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-base mt-0.5">info</span>
            <p>
              <strong className="text-[#111418] dark:text-white">总提现金额：</strong>
              统计所有已完成状态的提现交易
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
