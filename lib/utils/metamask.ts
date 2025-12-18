/**
 * MetaMask 防御性工具函数
 * 防止在 Server / 初始 render 阶段触发连接
 */

/**
 * 检查是否在客户端环境
 */
export function isClient(): boolean {
  return typeof window !== 'undefined';
}

/**
 * 检查 MetaMask 是否可用
 */
export function isMetaMaskAvailable(): boolean {
  if (!isClient()) return false;
  return typeof window.ethereum !== 'undefined';
}

/**
 * 安全连接 MetaMask
 * 必须在客户端且 MetaMask 可用时才能调用
 */
export async function connectMetaMask(): Promise<string | null> {
  if (!isClient()) {
    console.warn('MetaMask: Cannot connect in server environment');
    return null;
  }

  if (!isMetaMaskAvailable()) {
    console.warn('MetaMask: Not available');
    return null;
  }

  try {
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed');
    }
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts',
    });
    return accounts[0] || null;
  } catch (error) {
    console.error('MetaMask: Connection failed', error);
    return null;
  }
}

/**
 * 声明全局类型（如果不存在）
 */
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      isMetaMask?: boolean;
    };
  }
}
