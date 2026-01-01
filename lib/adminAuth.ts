/**
 * Admin 权限验证工具
 * 
 * 提供统一的 Admin Token 验证函数，用于所有 Admin API 路由
 */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from './prisma';

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
    // 🔥 P0修复：从 Cookie 读取 adminToken（与admin登录API设置的Cookie名称一致）
    const cookieStore = await cookies();
    const adminToken = cookieStore.get('adminToken')?.value;

    // 检查 adminToken 是否存在
    if (!adminToken) {
      // 🔥 性能优化：删除高频认证检查的日志（仅在开发环境输出）
      // console.log('❌ [AdminAuth] adminToken Cookie 不存在');
      return {
        success: false,
        error: 'Unauthorized. Admin access required.',
        statusCode: 401,
      };
    }

    // 🔥 性能优化：删除高频认证解析的日志
    // console.log('🔍 [AdminAuth] 开始解析 adminToken:', adminToken.substring(0, 50) + '...');

    // 解析 adminToken：格式为 admin-token-{userId}-{timestamp}-{random}
    // 例如：admin-token-e6311bd7-f882-491f-86d0-d5222785be34-1234567890-abc123
    // UUID 格式：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (36个字符，包含4个连字符)
    
    // 更可靠的解析方式：查找 "admin-token-" 前缀后的UUID（36个字符）
    const prefix = 'admin-token-';
    if (!adminToken.startsWith(prefix)) {
      // 🔥 性能优化：删除高频验证失败的日志（仅在开发环境输出）
      // console.log('❌ [AdminAuth] Token 格式错误：缺少 admin-token- 前缀');
      return {
        success: false,
        error: 'Invalid admin token format.',
        statusCode: 401,
      };
    }

    // 提取前缀后的内容
    const afterPrefix = adminToken.substring(prefix.length);
    
    // UUID 总是36个字符，从位置0开始提取
    const userId = afterPrefix.substring(0, 36);
    
    // 验证 UUID 格式
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(userId)) {
      // 🔥 性能优化：删除高频验证失败的日志（仅在开发环境输出）
      // console.log('❌ [AdminAuth] UUID 格式验证失败:', userId);
      return {
        success: false,
        error: 'Invalid user ID format in admin token.',
        statusCode: 401,
      };
    }

    // 🔥 性能优化：删除高频认证成功的日志
    // console.log('✅ [AdminAuth] 成功解析 userId:', userId);

    // 从数据库验证用户是否存在且为管理员
    const user = await prisma.users.findUnique({
      where: { id: userId },
    });

    if (!user) {
      // 🔥 性能优化：删除高频验证失败的日志（仅在开发环境输出）
      // console.log('❌ [AdminAuth] 用户不存在:', userId);
      return {
        success: false,
        error: 'Admin user not found.',
        statusCode: 401,
      };
    }

    // 验证用户是否为管理员
    if (!user.isAdmin) {
      // 🔥 性能优化：删除高频验证失败的日志（仅在开发环境输出）
      // console.log('❌ [AdminAuth] 用户不是管理员:', userId);
      return {
        success: false,
        error: 'User is not an administrator.',
        statusCode: 403,
      };
    }

    // 验证账户是否被禁用
    if (user.isBanned) {
      // 🔥 性能优化：删除高频验证失败的日志（仅在开发环境输出）
      // console.log('❌ [AdminAuth] 管理员账户已被禁用:', userId);
      return {
        success: false,
        error: 'Admin account is banned.',
        statusCode: 403,
      };
    }

    // 验证通过
    // 🔥 性能优化：删除高频认证成功的日志
    // console.log('✅ [AdminAuth] 权限验证成功，userId:', userId);
    return {
      success: true,
      userId: user.id,
    };
  } catch (error: any) {
    console.error('❌ [AdminAuth] 权限验证异常:', error);
    console.error('❌ [AdminAuth] 错误堆栈:', error?.stack);
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

