/**
 * 余额刷新工具 Hook
 * 
 * 提供全局的余额刷新函数，用于在充值/提现/管理员调整后立即更新余额
 */

import { mutate } from 'swr';

/**
 * 手动触发余额刷新
 * 在充值/提现/管理员调整成功后调用此函数，立即更新 Navbar 显示的余额
 */
export function refreshBalance() {
  mutate('/api/user/balance');
}
