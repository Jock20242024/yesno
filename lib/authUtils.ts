import { cookies } from 'next/headers';

/**
 * 从 HttpOnly Cookie 中的 authToken 提取用户 ID
 * 
 * 强制数据隔离：所有获取用户专属数据的 API 必须使用此函数提取 current_user_id
 * 
 * @returns {Promise<{ success: boolean; userId?: string; error?: string }>}
 * 
 * @example
 * ```typescript
 * const authResult = await extractUserIdFromToken();
 * if (!authResult.success) {
 *   return NextResponse.json({ error: authResult.error }, { status: 401 });
 * }
 * const userId = authResult.userId; // 使用 userId 进行数据库查询
 * ```
 */
export async function extractUserIdFromToken(): Promise<{
  success: boolean;
  userId?: string;
  error?: string;
}> {
  try {
    const cookieStore = await cookies();
    const authToken = cookieStore.get('authToken');

    if (!authToken) {
      return {
        success: false,
        error: 'Not authenticated',
      };
    }

    // Token 格式: auth-token-{userId}-{timestamp}-{random}
    // 其中 userId 是完整的 UUID（包含连字符），例如: e6311bd7-f882-491f-86d0-d5222785be34
    const tokenParts = authToken.value.split('-');
    if (tokenParts.length < 8) {
      return {
        success: false,
        error: 'Invalid token format',
      };
    }

    // UUID 格式: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (5个部分)
    // Token 分割后: ['auth', 'token', 'e6311bd7', 'f882', '491f', '86d0', 'd5222785be34', timestamp, random]
    // userId 应该是 parts[2] 到 parts[6] 的组合（5个部分）
    const userId = tokenParts.slice(2, 7).join('-'); // 组合 UUID 的 5 个部分

    // 验证 UUID 格式
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(userId)) {
      return {
        success: false,
        error: 'Invalid user ID format',
      };
    }

    return {
      success: true,
      userId,
    };
  } catch (error) {
    console.error('❌ [AuthUtils] 提取用户 ID 失败:', error);
    return {
      success: false,
      error: 'Failed to extract user ID',
    };
  }
}
