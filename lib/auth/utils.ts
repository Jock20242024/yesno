/**
 * NextAuth 统一认证工具函数
 * 
 * 用于所有需要身份验证的 API 路由
 * 
 * 支持两种认证方式：
 * 1. NextAuth Session (Cookie-based) - 网页用户
 * 2. API Key (Bearer Token) - 程序化访问
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/authExport';
import { extractApiKeyFromHeader, verifyApiKey } from '@/lib/utils/apiKeyAuth';

/**
 * 获取当前认证用户 ID
 * 
 * 优先检查 API Key (Bearer Token)，如果不存在则检查 Session
 * 
 * @returns {Promise<{ success: true; userId: string } | { success: false; error: string; statusCode: number }>}
 * 
 * @example
 * ```typescript
 * const authResult = await requireAuth();
 * if (!authResult.success) {
 *   return NextResponse.json(
 *     { success: false, error: authResult.error },
 *     { status: authResult.statusCode }
 *   );
 * }
 * const userId = authResult.userId; // 使用 userId 进行数据库查询
 * ```
 */
export async function requireAuth(): Promise<
  | { success: true; userId: string }
  | { success: false; error: string; statusCode: number }
> {
  try {
    // 🔥 第一步：检查 API Key (Bearer Token)
    const apiKey = await extractApiKeyFromHeader();
    if (apiKey) {
      const apiKeyResult = await verifyApiKey(apiKey);
      if (apiKeyResult.success) {
        return {
          success: true,
          userId: apiKeyResult.userId,
        };
      }
      // API Key 无效，继续尝试 Session 认证
    }

    // 🔥 第二步：检查 NextAuth Session (Cookie-based)
    const session = await auth();

    // 检查 session 是否存在
    if (!session || !session.user) {
      return {
        success: false,
        error: 'Not authenticated',
        statusCode: 401,
      };
    }

    // 🔥 从 session.user.id 获取用户 ID（NextAuth v5 session callback 中已设置）
    const userId = session.user.id;

    // 验证 userId 是否存在且为有效字符串
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return {
        success: false,
        error: 'Invalid user session',
        statusCode: 401,
      };
    }

    // 🔥 User ID 类型是 String UUID，直接返回，不需要转换
    return {
      success: true,
      userId: userId,
    };
  } catch (error: any) {
    console.error('❌ [Auth Utils] requireAuth 失败:', error);
    return {
      success: false,
      error: 'Authentication error',
      statusCode: 500,
    };
  }
}

/**
 * 创建未授权响应
 * 
 * @param message 错误消息
 * @param statusCode HTTP 状态码（默认 401）
 * @returns NextResponse
 */
export function createUnauthorizedResponse(
  message: string = 'Not authenticated',
  statusCode: number = 401
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status: statusCode }
  );
}
