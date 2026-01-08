/**
 * 市场流动性健康分计算工具
 * 
 * 用于评估市场深度状态，帮助运营人员发现需要补充流动性的市场
 */

import { Outcome } from '@/types/data';
import { calculateCPMMPrice } from './engine/match';

export type MarketHealthStatus = 'HEALTHY' | 'WARNING' | 'DEPLETED';

export interface MarketHealthScore {
  status: MarketHealthStatus;
  score: number; // 0-100，分数越高越健康
  slippageAt500: number; // 单笔$500交易的滑点百分比
  slippageAt100: number; // 单笔$100交易的滑点百分比
  message: string; // 健康状态描述
}

/**
 * 计算市场深度健康分
 * @param totalYes YES侧流动性
 * @param totalNo NO侧流动性
 * @param outcome 测试方向（YES或NO）
 * @returns 健康分评估结果
 */
export function calculateMarketHealth(
  totalYes: number,
  totalNo: number,
  outcome: Outcome = Outcome.YES
): MarketHealthScore {
  // 如果没有流动性，直接返回枯竭状态
  if (totalYes <= 0 && totalNo <= 0) {
    return {
      status: 'DEPLETED',
      score: 0,
      slippageAt500: 100,
      slippageAt100: 100,
      message: '流动性池为空，需要立即补充',
    };
  }

  const totalLiquidity = totalYes + totalNo;
  
  // 计算当前价格（交易前）
  const currentPrice = totalLiquidity > 0
    ? (outcome === Outcome.YES ? totalYes / totalLiquidity : totalNo / totalLiquidity)
    : 0.5;

  // 测试1：单笔$500交易的滑点
  const testAmount500 = 500;
  const cpmmResult500 = calculateCPMMPrice(totalYes, totalNo, outcome, testAmount500);
  const executionPrice500 = cpmmResult500.executionPrice;
  const slippage500 = currentPrice > 0
    ? Math.abs(executionPrice500 - currentPrice) / currentPrice * 100
    : 0;

  // 测试2：单笔$100交易的滑点
  const testAmount100 = 100;
  const cpmmResult100 = calculateCPMMPrice(totalYes, totalNo, outcome, testAmount100);
  const executionPrice100 = cpmmResult100.executionPrice;
  const slippage100 = currentPrice > 0
    ? Math.abs(executionPrice100 - currentPrice) / currentPrice * 100
    : 0;

  // 评估健康状态
  let status: MarketHealthStatus;
  let score: number;
  let message: string;

  // 健康标准：$500交易滑点<5%
  const isHealthy = slippage500 < 5;
  // 枯竭标准：$100交易滑点>20%
  const isDepleted = slippage100 > 20;

  if (isHealthy) {
    status = 'HEALTHY';
    score = Math.max(80, 100 - slippage500 * 2); // 滑点越低，分数越高
    message = `健康：深度充足，单笔$500交易滑点仅${slippage500.toFixed(2)}%`;
  } else if (isDepleted) {
    status = 'DEPLETED';
    score = Math.max(0, 40 - (slippage100 - 20)); // 滑点越高，分数越低
    message = `枯竭：流动性不足，单笔$100交易滑点高达${slippage100.toFixed(2)}%，建议补充流动性`;
  } else {
    status = 'WARNING';
    score = 40 + (slippage500 - 5) * 2; // 介于40-80之间
    message = `警告：深度较浅，单笔$500交易滑点${slippage500.toFixed(2)}%，建议增加流动性`;
  }

  return {
    status,
    score: Math.round(score),
    slippageAt500: slippage500,
    slippageAt100: slippage100,
    message,
  };
}

