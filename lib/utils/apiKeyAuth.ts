import { prisma } from '@/lib/prisma';
import { hashApiKey, isValidApiKeyFormat } from './apiKey';

/**
 * 从请求头中提取 API Key
 * 支持格式: Authorization: Bearer sk_live_xxxxx
 * 
 * @param request Request 对象（可选，如果提供则从 Headers 提取）
 * @param authHeader Authorization header 值（可选，直接提供 header 值）
 */
export function extractApiKeyFromHeader(
  request?: Request,
  authHeader?: string | null
): string | null {
  try {
    // 优先使用提供的 authHeader，否则从 Request 对象提取
    let headerValue = authHeader;
    if (!headerValue && request) {
      headerValue = request.headers.get('authorization');
    }

    if (!headerValue) {
      return null;
    }

    // 提取 Bearer token
    const parts = headerValue.trim().split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return null;
    }

    const apiKey = parts[1];
    
    // 验证格式
    if (!isValidApiKeyFormat(apiKey)) {
      return null;
    }

    return apiKey;
  } catch (error) {
    console.error('❌ [API Key Auth] Error extracting API Key:', error);
    return null;
  }
}

/**
 * 验证 API Key 并返回用户 ID
 * 
 * @returns {Promise<{ success: true; userId: string } | { success: false; error: string }>}
 */
export async function verifyApiKey(apiKey: string): Promise<
  | { success: true; userId: string }
  | { success: false; error: string }
> {
  try {
    // 计算 Key 的哈希值
    const keyHash = hashApiKey(apiKey);

    // 在数据库中查找匹配的记录
    const apiKeyRecord = await prisma.api_keys.findUnique({
      where: { keyHash },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!apiKeyRecord) {
      return {
        success: false,
        error: 'Invalid API Key',
      };
    }

    // 更新最后使用时间（异步，不阻塞）
    prisma.api_keys.update({
      where: { id: apiKeyRecord.id },
      data: { lastUsedAt: new Date() },
    }).catch((error) => {
      console.error('❌ [API Key Auth] Failed to update lastUsedAt:', error);
    });

    return {
      success: true,
      userId: apiKeyRecord.userId,
    };
  } catch (error: any) {
    console.error('❌ [API Key Auth] Error verifying API Key:', error);
    return {
      success: false,
      error: 'Failed to verify API Key',
    };
  }
}

