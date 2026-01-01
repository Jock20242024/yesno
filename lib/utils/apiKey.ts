import { createHash, randomBytes } from 'crypto';

/**
 * 生成 API Key
 * 格式: sk_live_{32字节随机字符串(Base64编码)}
 */
export function generateApiKey(): string {
  const randomBytesData = randomBytes(32);
  const encoded = randomBytesData.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `sk_live_${encoded}`;
}

/**
 * 获取 API Key 的前缀（用于展示）
 */
export function getApiKeyPrefix(key: string): string {
  // 返回前 7 位，例如 "sk_live"
  return key.substring(0, 7);
}

/**
 * 获取 API Key 的掩码显示（用于列表展示）
 * 例如: sk_live_abc123...xyz789
 */
export function maskApiKey(key: string): string {
  if (key.length <= 15) return key;
  return `${key.substring(0, 15)}...${key.substring(key.length - 6)}`;
}

/**
 * 计算 API Key 的 SHA256 哈希值
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * 验证 API Key 格式
 */
export function isValidApiKeyFormat(key: string): boolean {
  return key.startsWith('sk_live_') && key.length > 20;
}

