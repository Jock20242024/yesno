/**
 * API 数据结构定义
 * 用于前后端数据交互的类型定义
 */

/**
 * 市场状态
 */
export type MarketStatus = "OPEN" | "RESOLVED" | "CLOSED";

/**
 * 市场结果
 */
export type MarketResult = "YES" | "NO" | null;

/**
 * 用户持仓接口（用于市场详情页）
 */
export interface UserPosition {
  yesShares: number;
  noShares: number;
  yesAvgPrice: number;
  noAvgPrice: number;
}

/**
 * 市场数据接口
 */
export interface Market {
  id: string;
  title: string;
  imageUrl: string;
  category: string;
  categorySlug: string;
  yesPercent: number;
  noPercent: number;
  volume: number; // 交易量（美元），例如 42000000 表示 $42M
  commentsCount: number; // 评论数量，例如 124
  endTime: string; // ISO 8601 格式，例如 "2024-12-31T23:59:59Z"
  status: MarketStatus; // 市场状态
  winningOutcome: MarketResult; // 获胜结果（仅当 status 为 RESOLVED 时有效）
  createdAt: string; // 创建时间
  updatedAt: string; // 更新时间
  description?: string; // 市场描述
  sourceUrl?: string; // 信息来源链接
  resolutionCriteria?: string; // 结算规则说明
  userPosition?: UserPosition | null; // ✅ 修复：添加用户持仓字段（API 返回）
  userOrders?: any[]; // ✅ 修复：添加用户订单列表字段（API 返回）
}

/**
 * 用户数据接口（用于排行榜和详情页）
 */
export interface User {
  id: string;
  username: string;
  avatarUrl?: string; // 头像 URL（可选）
  rank: number; // 排名
  profitLoss: number; // 利润/亏损（美元）
  volumeTraded: number; // 交易体量（美元）
  positionsValue?: number; // 持仓价值
  biggestWin?: number; // 最大胜利金额
  predictions?: number; // 预测次数
  joinDate?: string; // 注册日期，ISO 8601 格式
  createdAt?: string; // 账户创建时间
  updatedAt?: string; // 最后更新时间
}

/**
 * 交易活动类型
 */
export type ActivityType = "Buy" | "Sell";

/**
 * 交易活动数据接口（用于用户活动表格）
 */
export interface Activity {
  id: string;
  type: ActivityType; // 'Buy' 或 'Sell'
  marketId: string; // 市场 ID
  marketTitle: string; // 市场标题
  amount: number; // 交易金额（美元）
  shares?: number; // 交易份额（Sell 时使用）
  price: number; // 交易价格（0-1 之间）
  outcome: "YES" | "NO"; // 交易方向
  timeAgo: string; // 相对时间，例如 '2 days ago', '5 hours ago'
  timestamp: string; // ISO 8601 格式的绝对时间
  fee?: number; // 交易手续费
  profitLoss?: number; // 盈亏（Sell 时计算）
}

/**
 * 持仓数据接口
 */
export interface Position {
  id: string;
  marketId: string;
  marketTitle: string;
  outcome: "YES" | "NO";
  shares: number; // 持有份额
  avgPrice: number; // 平均成本价（0-1 之间）
  currentPrice: number; // 当前价格（0-1 之间）
  profitLoss: number; // 未实现盈亏
  createdAt: string; // 首次买入时间
  updatedAt: string; // 最后更新时间
}

/**
 * 评论数据接口
 */
export interface Comment {
  id: string;
  marketId: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  text: string;
  likes: number;
  replies: number;
  timeAgo: string; // 相对时间
  timestamp: string; // ISO 8601 格式
  parentId?: string; // 父评论 ID（用于回复）
  createdAt: string;
  updatedAt: string;
}

/**
 * 持有者数据接口
 */
export interface Holder {
  id: string;
  marketId: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  rank: number; // 排名
  shares: number; // 持有份额
  profit: number; // 利润/亏损
  outcome: "YES" | "NO"; // 持有方向
}

/**
 * 订单簿数据接口
 */
export interface OrderBookEntry {
  price: number; // 价格（0-1 之间）
  quantity: number; // 数量（份额）
  total: number; // 总计（美元）
  type: "buy" | "sell"; // 订单类型
}

/**
 * API 响应包装接口
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * 分页响应接口
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 排行榜查询参数
 */
export interface RankingQueryParams {
  timeRange?: "today" | "weekly" | "monthly" | "all";
  search?: string;
  page?: number;
  pageSize?: number;
}

/**
 * 市场列表查询参数
 */
export interface MarketQueryParams {
  category?: string;
  status?: MarketStatus;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "volume" | "endTime" | "createdAt";
  sortOrder?: "asc" | "desc";
}

