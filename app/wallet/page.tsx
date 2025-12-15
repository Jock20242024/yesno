'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  History, 
  TrendingUp, 
  DollarSign, 
  CheckCircle2, 
  ArrowUp, 
  ArrowDown 
} from 'lucide-react';
import DepositModal from '@/components/modals/DepositModal';
import WithdrawModal from '@/components/modals/WithdrawModal';
import { formatUSD } from '@/lib/utils';
import { useStore } from '@/app/context/StoreContext';

// 定义时间范围类型
type TimeRange = '1D' | '1W' | '1M' | '1Y';

// 市场标题映射（用于显示）
const MARKET_TITLES: Record<string, string> = {
  '1': '2024年比特币会达到10万美元吗？',
  '2': '美联储 5 月宣布降息？',
  '3': '星舰 (Starship) 轨道飞行成功？',
};

export default function WalletPage() {
  // 1. 从 Store 获取数据
  const { balance, positions: storePositions, history: storeHistory } = useStore();

  // 2. 状态管理
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'positions' | 'history' | 'funding'>('positions');
  const [timeRange, setTimeRange] = useState<TimeRange>('1D');

  // 3. 计算资产数据
  const availableBalance = balance;
  // 计算持仓总价值（简单预估：shares * avgPrice）
  const positionsValue = useMemo(() => {
    return storePositions.reduce((acc, pos) => {
      // 简单计算：使用平均价格作为当前价格（实际应该从市场数据获取）
      const currentPrice = pos.avgPrice; // 简化处理
      return acc + (pos.shares * currentPrice);
    }, 0);
  }, [storePositions]);
  const totalBalance = availableBalance + positionsValue;

  // 模拟不同时间段的盈亏数据
  const pnlData = {
    '1D': { value: 150.00, percent: 6.52, isPositive: true },
    '1W': { value: 420.50, percent: 18.2, isPositive: true },
    '1M': { value: -120.30, percent: -4.8, isPositive: false },
    '1Y': { value: 2100.00, percent: 145.0, isPositive: true },
  };

  const currentPnl = pnlData[timeRange];

  // 4. 转换 Store 数据为 UI 格式
  // 持仓数据：从 Store 的 Position 转换为 UI 需要的格式
  const positions = useMemo(() => {
    return storePositions.map((pos) => {
      const currentPrice = pos.avgPrice; // 简化：使用平均价格作为当前价格
      const value = pos.shares * currentPrice;
      const cost = pos.shares * pos.avgPrice;
      const pnl = value - cost;
      const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;

      return {
        id: `${pos.marketId}-${pos.outcome}`, // 使用 marketId-outcome 作为唯一 key
        event: MARKET_TITLES[pos.marketId] || `市场 ${pos.marketId}`,
        type: pos.outcome,
        shares: pos.shares,
        avgPrice: pos.avgPrice,
        value: value,
        pnl: pnl,
        pnlPercent: pnlPercent,
        status: 'OPEN' as const,
        marketId: pos.marketId,
      };
    });
  }, [storePositions]);

  // 交易历史：从 Store 的 Transaction 转换为 UI 需要的格式
  const history = useMemo(() => {
    return storeHistory.map((tx) => {
      const actionMap: Record<string, string> = {
        'Buy': '买入',
        'Sell': '卖出',
        'Redeem': '兑换',
      };
      
      return {
        id: tx.id || `${tx.marketId}-${tx.date}-${tx.action}-${Math.random()}`, // 使用 tx.id 或生成唯一 key
        date: tx.date,
        event: MARKET_TITLES[tx.marketId] || `市场 ${tx.marketId}`,
        action: `${actionMap[tx.action] || tx.action} ${tx.outcome === 'YES' ? 'Yes' : 'No'}`,
        price: tx.price,
        shares: tx.shares,
        value: tx.amount,
        status: tx.status === 'Success' ? '成功' : tx.status === 'Pending' ? '处理中' : '失败',
        pnl: tx.pnl,
      };
    });
  }, [storeHistory]);

  const fundings = [
    { id: 1, type: '充值', amount: 1000.00, network: 'Polygon (USDC)', status: '成功', time: '2024-12-10 09:30' },
    { id: 2, type: '提现', amount: 200.00, network: 'Ethereum', status: '处理中', time: '2024-12-12 14:20' },
  ];

  // 渲染函数 - 持仓列表
  const renderPositions = () => (
    <div className="overflow-x-auto p-4">
      <table className="w-full text-left text-sm text-zinc-400">
        <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500 bg-zinc-900/50">
          <tr>
            <th className="px-4 py-3 font-medium">事件</th>
            <th className="px-4 py-3 font-medium text-center">类型</th>
            <th className="px-4 py-3 font-medium text-right">持有份额</th>
            <th className="px-4 py-3 font-medium text-right">均价</th>
            <th className="px-4 py-3 font-medium text-right">当前价值</th>
            <th className="px-4 py-3 font-medium text-right">盈亏</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {positions.map((pos) => (
            <tr key={pos.id} className="hover:bg-zinc-800/30 transition-colors">
              <td className="px-4 py-4 text-zinc-200 max-w-[200px] truncate">
                <Link 
                  href={`/markets/${pos.marketId}`}
                  className="hover:text-white hover:underline decoration-zinc-500 underline-offset-4 cursor-pointer transition-colors"
                >
                  {pos.event}
                </Link>
              </td>
              <td className="px-4 py-4 text-center">
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                  pos.type === 'YES' 
                    ? 'bg-pm-green/20 text-pm-green' 
                    : 'bg-pm-red/20 text-pm-red'
                }`}>
                  {pos.type}
                </span>
              </td>
              <td className="px-4 py-4 text-right text-zinc-300 font-mono">{pos.shares.toFixed(2)}</td>
              <td className="px-4 py-4 text-right font-mono">${pos.avgPrice.toFixed(2)}</td>
              <td className="px-4 py-4 text-right text-white font-medium font-mono">${pos.value.toFixed(2)}</td>
              <td className={`px-4 py-4 text-right font-medium font-mono ${
                pos.pnl >= 0 ? 'text-pm-green' : 'text-pm-red'
              }`}>
                {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(2)} ({pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(2)}%)
              </td>
            </tr>
          ))}
          {positions.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center py-12 text-zinc-600">
                暂无持仓
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  // 渲染函数 - 交易历史（包含盈亏列）
  const renderHistory = () => (
    <div className="overflow-x-auto p-4">
      <table className="w-full text-left text-sm text-zinc-400">
        <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500 bg-zinc-900/50">
          <tr>
            <th className="px-4 py-3 font-medium">时间</th>
            <th className="px-4 py-3 font-medium">市场</th>
            <th className="px-4 py-3 font-medium">操作</th>
            <th className="px-4 py-3 font-medium text-right">价格</th>
            <th className="px-4 py-3 font-medium text-right">数量</th>
            <th className="px-4 py-3 font-medium text-right">总额</th>
            <th className="px-4 py-3 font-medium text-right">盈亏 (P&L)</th>
            <th className="px-4 py-3 font-medium text-right">状态</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {history.map((item) => {
            // 计算盈亏显示样式
            const pnlValue = item.pnl ?? 0;
            const pnlClass = pnlValue > 0 
              ? 'text-pm-green' 
              : pnlValue < 0 
                ? 'text-pm-red' 
                : 'text-zinc-500';
            
            const pnlDisplay = pnlValue === 0 
              ? '-' 
              : pnlValue > 0 
                ? `+${formatUSD(pnlValue)}` 
                : formatUSD(pnlValue);

            return (
              <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                <td className="px-4 py-4 text-xs font-mono">{item.date}</td>
                <td className="px-4 py-4 text-zinc-200 max-w-[200px] truncate">{item.event}</td>
                <td className="px-4 py-4">
                  <span className={`text-xs px-2 py-0.5 rounded border ${
                    item.action.includes('买入') 
                      ? 'border-pm-green/30 text-pm-green' 
                      : item.action.includes('卖出') 
                        ? 'border-pm-red/30 text-pm-red' 
                        : item.action.includes('结算') 
                          ? 'border-zinc-600/30 text-zinc-400 bg-zinc-800/30'
                          : 'border-zinc-700 text-zinc-400'
                  }`}>
                    {item.action}
                  </span>
                </td>
                <td className="px-4 py-4 text-right font-mono">
                  {item.price > 0 ? `$${item.price.toFixed(2)}` : '-'}
                </td>
                <td className="px-4 py-4 text-right font-mono">{item.shares.toFixed(2)}</td>
                <td className="px-4 py-4 text-right text-white font-mono">${item.value.toFixed(2)}</td>
                <td className={`px-4 py-4 text-right font-medium font-mono ${pnlClass}`}>
                  {pnlDisplay}
                </td>
                <td className="px-4 py-4 text-right flex justify-end items-center gap-1">
                  {item.status === '成功' || item.status === '已结算' ? (
                    <CheckCircle2 size={14} className="text-pm-green" />
                  ) : (
                    <CheckCircle2 size={14} className="text-zinc-500" />
                  )}
                  <span className="text-xs">{item.status}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderFunding = () => (
    <div className="overflow-x-auto p-4">
      <table className="w-full text-left text-sm text-zinc-400">
        <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500 bg-zinc-900/50">
          <tr>
            <th className="px-4 py-3 font-medium">时间</th>
            <th className="px-4 py-3 font-medium">类型</th>
            <th className="px-4 py-3 font-medium">网络</th>
            <th className="px-4 py-3 font-medium text-right">金额</th>
            <th className="px-4 py-3 font-medium text-right">状态</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {fundings.map((item) => (
            <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
              <td className="px-4 py-4 text-xs font-mono">{item.time}</td>
              <td className="px-4 py-4 text-white font-medium">{item.type}</td>
              <td className="px-4 py-4 text-zinc-400">{item.network}</td>
              <td className={`px-4 py-4 text-right font-bold font-mono ${
                item.type === '充值' ? 'text-pm-green' : 'text-zinc-200'
              }`}>
                {item.type === '充值' ? '+' : '-'}${item.amount.toFixed(2)}
              </td>
              <td className="px-4 py-4 text-right">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  item.status === '成功' 
                    ? 'bg-green-500/10 text-green-400' 
                    : 'bg-yellow-500/10 text-yellow-400'
                }`}>
                  {item.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="flex-1 max-w-[1600px] mx-auto w-full p-4 md:p-6 lg:p-8">
      {/* 1. 顶部资产卡片区域 */}
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 lg:p-8 backdrop-blur-sm mb-8">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          {/* 左侧：金额信息 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-400">
              <Wallet size={18} />
              <span className="text-sm font-medium">总资产估值</span>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold text-white tracking-tight">
                  ${totalBalance.toLocaleString()}
                </span>
                <span className="text-xl text-zinc-500 font-medium">USD</span>
              </div>
              {/* 盈亏显示 */}
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-1 text-sm font-bold px-2 py-1 rounded-md ${
                  currentPnl.isPositive 
                    ? 'bg-green-500/10 text-green-400' 
                    : 'bg-red-500/10 text-red-400'
                }`}>
                  {currentPnl.isPositive ? <ArrowUp size={14}/> : <ArrowDown size={14}/>}
                  ${Math.abs(currentPnl.value).toFixed(2)} ({currentPnl.percent}%)
                </div>
                <span className="text-xs text-zinc-500">过去 {timeRange}</span>
              </div>
            </div>
            <div className="flex gap-6 text-sm pt-2">
              <div>
                <span className="text-zinc-500 block mb-0.5">可用余额</span>
                <span className="text-white font-mono">${availableBalance}</span>
              </div>
              <div>
                <span className="text-zinc-500 block mb-0.5">持仓价值</span>
                <span className="text-white font-mono">${positionsValue.toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          {/* 右侧：操作区域 */}
          <div className="flex flex-col gap-4 w-full md:w-auto">
            {/* 时间筛选器 */}
            <div className="flex bg-zinc-950 rounded-lg p-1 border border-zinc-800 w-fit self-start md:self-end">
              {(['1D', '1W', '1M', '1Y'] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    timeRange === range 
                      ? 'bg-zinc-800 text-white shadow-sm' 
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
            {/* 充提按钮 */}
            <div className="flex gap-3">
              <button 
                onClick={() => setIsDepositOpen(true)}
                className="flex-1 md:flex-none px-6 py-3 bg-white text-black hover:bg-zinc-200 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors min-w-[120px]"
              >
                <ArrowDownLeft size={18} />
                充值
              </button>
              <button 
                onClick={() => setIsWithdrawOpen(true)}
                className="flex-1 md:flex-none px-6 py-3 bg-zinc-800 text-white hover:bg-zinc-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors min-w-[120px]"
              >
                <ArrowUpRight size={18} />
                提现
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 下方 Tab 内容 */}
      <div className="space-y-4">
        <div className="flex items-center gap-6 border-b border-zinc-800 px-1">
          <button 
            onClick={() => setActiveTab('positions')} 
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'positions' 
                ? 'border-white text-white' 
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <TrendingUp size={16} /> 我的持仓
          </button>
          <button 
            onClick={() => setActiveTab('history')} 
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'history' 
                ? 'border-white text-white' 
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <History size={16} /> 交易历史
          </button>
          <button 
            onClick={() => setActiveTab('funding')} 
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'funding' 
                ? 'border-white text-white' 
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <DollarSign size={16} /> 资金记录
          </button>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden min-h-[400px]">
          {activeTab === 'positions' && renderPositions()}
          {activeTab === 'history' && renderHistory()} 
          {activeTab === 'funding' && renderFunding()}
        </div>
      </div>

      {/* 3. 模态框 */}
      <DepositModal isOpen={isDepositOpen} onClose={() => setIsDepositOpen(false)} />
      <WithdrawModal isOpen={isWithdrawOpen} onClose={() => setIsWithdrawOpen(false)} availableBalance={availableBalance} />
    </div>
  );
}
