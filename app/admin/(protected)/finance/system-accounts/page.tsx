"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

interface SystemAccount {
  id: string;
  email: string;
  balance: number;
  createdAt: string; // 统一使用字符串格式（ISO 8601）
}

interface SystemAccountsData {
  fee: SystemAccount;
  amm: SystemAccount;
  liquidity: SystemAccount;
}

interface Transaction {
  id: string;
  userId: string;
  userEmail: string;
  amount: number;
  type: string;
  reason: string | null;
  createdAt: string;
  status: string;
  balanceAfter: number; // 🔥 第三步：变动后余额
}

export default function SystemAccountsPage() {
  const [accounts, setAccounts] = useState<SystemAccountsData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "fee" | "amm" | "liquidity">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState<{
    accountType: "fee" | "amm" | "liquidity";
    action: "withdraw" | "deposit";
    title: string;
  } | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 获取系统账户数据
  useEffect(() => {
    const fetchAccounts = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/admin/system-accounts", {
          credentials: "include",
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          const errorMessage = result.error || "获取系统账户失败";
          console.error("获取系统账户失败:", errorMessage, result);
          toast.error(errorMessage);
          // 即使失败，也设置默认值，避免页面显示错误
          setAccounts({
            fee: {
              id: '',
              email: 'system.fee@yesno.com',
              balance: 0,
              createdAt: new Date().toISOString(), // 🔥 修复类型：使用 ISO 字符串格式
            },
            amm: {
              id: '',
              email: 'system.amm@yesno.com',
              balance: 0,
              createdAt: new Date().toISOString(), // 🔥 修复类型：使用 ISO 字符串格式
            },
            liquidity: {
              id: '',
              email: 'system.liquidity@yesno.com',
              balance: 0,
              createdAt: new Date().toISOString(), // 🔥 修复类型：使用 ISO 字符串格式
            },
          });
          return;
        }

        if (result.data) {
          setAccounts(result.data);
        } else {
          throw new Error("返回数据格式错误");
        }
      } catch (error) {
        console.error("获取系统账户失败:", error);
        toast.error(error instanceof Error ? error.message : "获取系统账户失败");
        // 设置默认值，避免页面崩溃
        setAccounts({
          fee: {
            id: '',
            email: 'system.fee@yesno.com',
            balance: 0,
            createdAt: new Date().toISOString(), // 🔥 修复类型：使用 ISO 字符串格式
          },
          amm: {
            id: '',
            email: 'system.amm@yesno.com',
            balance: 0,
            createdAt: new Date().toISOString(), // 🔥 修复类型：使用 ISO 字符串格式
          },
          liquidity: {
            id: '',
            email: 'system.liquidity@yesno.com',
            balance: 0,
            createdAt: new Date().toISOString(), // 🔥 修复类型：使用 ISO 字符串格式
          },
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchAccounts();
  }, []);

  // 🔥 第三步：获取交易流水
  useEffect(() => {
    const fetchTransactions = async () => {
      if (!accounts) return;

      try {
        // 根据 activeTab 决定查询哪个账户的交易
        const accountType = activeTab === 'all' ? 'all' : activeTab;
        
        const response = await fetch(`/api/admin/system-accounts/transactions?accountType=${accountType}`, {
          credentials: 'include',
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          console.error("获取交易流水失败:", result.error);
          setTransactions([]);
          return;
        }

        // 根据 activeTab 过滤交易（如果 activeTab 不是 'all'）
        let filteredTransactions = result.data || [];
        
        if (activeTab !== 'all') {
          const accountEmailMap: Record<string, string> = {
            fee: 'system.fee@yesno.com',
            amm: 'system.amm@yesno.com',
            liquidity: 'system.liquidity@yesno.com',
          };
          
          const targetEmail = accountEmailMap[activeTab];
          filteredTransactions = filteredTransactions.filter((tx: any) => 
            tx.userEmail === targetEmail
          );
        }

        setTransactions(filteredTransactions);
      } catch (error) {
        console.error("获取交易流水失败:", error);
        setTransactions([]);
      }
    };

    fetchTransactions();
  }, [accounts, activeTab]);

  // 格式化金额
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // 打开操作 Modal
  const openModal = (
    accountType: "fee" | "amm" | "liquidity",
    action: "withdraw" | "deposit"
  ) => {
    const titles = {
      fee: {
        withdraw: "提取手续费利润",
        deposit: "补充手续费账户",
      },
      amm: {
        withdraw: "提取 AMM 资金",
        deposit: "补充 AMM 资金池",
      },
      liquidity: {
        withdraw: "提取流动性资金",
        deposit: "补充流动性账户",
      },
    };

    setModalData({
      accountType,
      action,
      title: titles[accountType][action],
    });
    setAmount("");
    setReason("");
    setIsModalOpen(true);
  };

  // 提交操作
  const handleSubmit = async () => {
    if (!modalData) return;

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("请输入有效的金额");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/system-accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          accountType: modalData.accountType,
          action: modalData.action,
          amount: amountNum,
          reason: reason || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "操作失败");
      }

      toast.success("操作成功");
      setIsModalOpen(false);
      
      // 刷新账户数据
      const refreshResponse = await fetch("/api/admin/system-accounts", {
        credentials: "include",
      });
      if (refreshResponse.ok) {
        const refreshResult = await refreshResponse.json();
        if (refreshResult.success && refreshResult.data) {
          setAccounts(refreshResult.data);
        }
      }
    } catch (error) {
      console.error("操作失败:", error);
      toast.error(error instanceof Error ? error.message : "操作失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">加载中...</div>
      </div>
    );
  }

  if (!accounts) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-red-600">获取系统账户失败</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          系统账户资金监控
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          管理手续费账户、AMM 资金池和流动性账户
        </p>
      </div>

      {/* 账户卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 手续费账户 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-green-600 dark:text-green-400">
                  account_balance_wallet
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  手续费账户
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Fee Collector
                </p>
              </div>
            </div>
          </div>
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              累计盈利
            </p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(accounts.fee.balance)}
            </p>
          </div>
          <button
            onClick={() => openModal("fee", "withdraw")}
            className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            提取利润
          </button>
        </div>

        {/* AMM 资金池 */}
        <div
          className={`bg-white dark:bg-gray-800 rounded-xl border p-6 shadow-sm ${
            accounts.amm.balance < 0
              ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20"
              : "border-gray-200 dark:border-gray-700"
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  accounts.amm.balance < 0
                    ? "bg-red-100 dark:bg-red-900/30"
                    : "bg-blue-100 dark:bg-blue-900/30"
                }`}
              >
                <span
                  className={`material-symbols-outlined ${
                    accounts.amm.balance < 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-blue-600 dark:text-blue-400"
                  }`}
                >
                  account_balance
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  AMM 资金池
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  AMM Pool
                </p>
              </div>
            </div>
          </div>
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              资金池沉淀
            </p>
            <p
              className={`text-2xl font-bold ${
                accounts.amm.balance < 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-blue-600 dark:text-blue-400"
              }`}
            >
              {formatCurrency(accounts.amm.balance)}
            </p>
            {accounts.amm.balance < 0 && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                ⚠️ 亏空警告
              </p>
            )}
          </div>
        </div>

        {/* 流动性账户 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-purple-600 dark:text-purple-400">
                  trending_up
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  流动性账户
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Liquidity Provider
                </p>
              </div>
            </div>
          </div>
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              做市本金
            </p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {formatCurrency(accounts.liquidity.balance)}
            </p>
          </div>
          <button
            onClick={() => openModal("liquidity", "deposit")}
            className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            补充资金
          </button>
        </div>
      </div>

      {/* 资金流水 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            资金流水
          </h2>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
            {[
              { key: "all", label: "全部流水" },
              { key: "fee", label: "手续费记录" },
              { key: "amm", label: "AMM变动" },
              { key: "liquidity", label: "注资记录" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 表格 */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    时间
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    关联订单ID
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    变动金额
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    变动后余额
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    描述
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-center py-8 text-gray-500 dark:text-gray-400"
                    >
                      暂无交易记录
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                        {new Date(tx.createdAt).toLocaleString("zh-CN")}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                        {tx.id.substring(0, 8)}...
                      </td>
                      <td
                        className={`py-3 px-4 text-sm text-right font-medium ${
                          tx.amount >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {tx.amount >= 0 ? "+" : ""}
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-gray-900 dark:text-white font-medium">
                        {formatCurrency(tx.balanceAfter)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                        {tx.reason || "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 操作 Modal */}
      {isModalOpen && modalData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {modalData.title}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  金额 (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  备注（可选）
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="请输入备注信息..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                disabled={isSubmitting}
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !amount}
                className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "处理中..." : "确认"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
