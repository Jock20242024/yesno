/**
 * Admin 权限验证工具
 * 
 * 提供统一的 Admin Token 验证函数，用于所有 Admin API 路由
 */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from './prisma';
import { getSession } from './auth-core/sessionStore';

/**
 * Admin Token 验证结果
 */
interface AdminAuthResult {
  success: boolean;
  userId?: string;
  error?: string;
  statusCode?: number;
}

/**
 * 验证 Admin Token 并获取用户信息
 * @param request 请求对象（可选，从 Cookie 中读取 authToken）
 * @returns AdminAuthResult 验证结果
 */
export async function verifyAdminToken(request?: Request | NextRequest): Promise<AdminAuthResult> {
  try {
    // 从 Cookie 读取 auth_core_session
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_core_session')?.value;

    // 检查 session 是否存在
    if (!sessionId) {
      return {
        success: false,
        error: 'Unauthorized. Admin access required.',
        statusCode: 401,
      };
    }

    // 调用 sessionStore.getSession(sessionId)
    const userId = await getSession(sessionId);

    // 若 session 不存在，返回 401
    if (!userId) {
      return {
        success: false,
        error: 'Session expired or invalid.',
        statusCode: 401,
      };
    }

    // 从数据库验证用户是否存在且为管理员
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return {
        success: false,
        error: 'Admin user not found.',
        statusCode: 401,
      };
    }

    // 验证用户是否为管理员
    if (!user.isAdmin) {
      return {
        success: false,
        error: 'User is not an administrator.',
        statusCode: 403,
      };
    }

    // 验证账户是否被禁用
    if (user.isBanned) {
      return {
        success: false,
        error: 'Admin account is banned.',
        statusCode: 403,
      };
    }

    // 验证通过
    return {
      success: true,
      userId: user.id,
    };
  } catch (error) {
    return {
      success: false,
      error: 'Internal server error during token verification.',
      statusCode: 500,
    };
  }
}

/**
 * 创建未授权响应
 * @param message 错误消息
 * @param statusCode HTTP 状态码（默认 401）
 * @returns NextResponse
 */
function createUnauthorizedResponse(
  message: string = 'Unauthorized. Admin access required.',
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

/**
 * 统一的 Admin API 权限验证中间件
 * 
 * 使用方法：
 * ```typescript
 * const authResult = await verifyAdminToken(request);
 * if (!authResult.success) {
 *   return createUnauthorizedResponse(authResult.error, authResult.statusCode);
 * }
 * // 继续处理请求...
 * ```
 */
// 导出函数（同时支持两种命名以保持向后兼容）
export { verifyAdminToken as verifyAdminAuth, createUnauthorizedResponse };

