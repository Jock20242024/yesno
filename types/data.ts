/**
 * 核心业务实体类型定义
 * 
 * 本文件定义了预测市场平台的核心业务实体接口和枚举类型
 */

// ============================================
// 枚举类型 (Enums)
// ============================================

/**
 * 市场状态枚举
 */
export enum MarketStatus {
  /** 开放中 - 用户可以下注 */
  OPEN = "OPEN",
  /** 已关闭 - 市场已关闭，等待结算 */
  CLOSED = "CLOSED",
  /** 已结算 - 市场已结算，结果已确定 */
  RESOLVED = "RESOLVED",
  /** 已取消 - 市场被取消，不进行结算 */
  CANCELED = "CANCELED",
}

/**
 * 结果选项枚举（用于订单选择和市场结算结果）
 */
export enum Outcome {
  /** 是/会/发生 */
  YES = "YES",
  /** 否/不会/不发生 */
  NO = "NO",
  /** 取消/无效 */
  CANCELED = "CANCELED",
}

/**
 * 交易状态枚举
 */
export enum TransactionStatus {
  /** 待处理 */
  PENDING = "PENDING",
  /** 已完成 */
  COMPLETED = "COMPLETED",
  /** 失败 */
  FAILED = "FAILED",
}

// ============================================
// 核心接口 (Interfaces)
// ============================================

/**
 * 用户实体接口
 */
export interface User {
  /** 用户唯一标识符 */
  id: string;
  /** 邮箱地址（唯一标识） */
  email: string;
  /** 密码哈希值（生产环境使用，不存储明文密码） */
  passwordHash: string;
  /** 账户余额（单位：美元） */
  balance: number;
  /** 是否为管理员 */
  isAdmin: boolean;
  /** 是否被禁用 */
  isBanned: boolean;
  /** 创建时间（ISO 8601 格式） */
  createdAt: string;
}

/**
 * 市场实体接口
 */
export interface Market {
  /** 市场唯一标识符 */
  id: string;
  /** 市场标题 */
  title: string;
  /** 市场描述 */
  description: string;
  /** 截止日期（ISO 8601 格式） */
  closingDate: string;
  /** 结算结果（可选，仅在市场结算后才有值） */
  resolvedOutcome?: Outcome;
  /** 市场状态 */
  status: MarketStatus;
  /** 总交易量（单位：美元） */
  totalVolume: number;
  /** YES 选项总金额（单位：美元） */
  totalYes: number;
  /** NO 选项总金额（单位：美元） */
  totalNo: number;
  /** 手续费率（例如：0.05 代表 5%） */
  feeRate: number;
  /** 分类（中文名称，如 "加密货币"） */
  category?: string;
  /** 分类 slug（如 "crypto"） */
  categorySlug?: string;
  /** 创建时间（ISO 8601 格式） */
  createdAt: string;
}

/**
 * 订单实体接口
 */
export interface Order {
  /** 订单唯一标识符 */
  id: string;
  /** 用户ID */
  userId: string;
  /** 市场ID */
  marketId: string;
  /** 选择的结果选项 */
  outcomeSelection: Outcome;
  /** 下注金额（单位：美元） */
  amount: number;
  /** 结算后的支付金额（单位：美元，仅在市场结算后才有值） */
  payout?: number;
  /** 扣除的手续费（单位：美元） */
  feeDeducted: number;
  /** 创建时间（ISO 8601 格式） */
  createdAt: string;
}

/**
 * 充值记录实体接口
 */
export interface Deposit {
  /** 充值记录唯一标识符 */
  id: string;
  /** 用户ID */
  userId: string;
  /** 充值金额（单位：美元） */
  amount: number;
  /** 交易哈希值（区块链交易哈希） */
  txHash: string;
  /** 交易状态 */
  status: TransactionStatus;
  /** 创建时间（ISO 8601 格式） */
  createdAt: string;
}

/**
 * 提现记录实体接口
 */
export interface Withdrawal {
  /** 提现记录唯一标识符 */
  id: string;
  /** 用户ID */
  userId: string;
  /** 提现金额（单位：美元） */
  amount: number;
  /** 目标地址（提现到的钱包地址） */
  targetAddress: string;
  /** 交易状态 */
  status: TransactionStatus;
  /** 创建时间（ISO 8601 格式） */
  createdAt: string;
}

/**
 * 管理员操作日志实体接口
 */
export interface AdminLog {
  /** 日志唯一标识符 */
  id: string;
  /** 管理员用户ID */
  adminId: string;
  /** 操作类型（例如：'MARKET_RESOLVE', 'USER_BAN', 'MARKET_CREATE' 等） */
  actionType: string;
  /** 操作详情（JSON 字符串或描述性文本） */
  details: string;
  /** 操作时间戳（ISO 8601 格式） */
  timestamp: string;
}

