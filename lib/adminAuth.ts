/**
 * Admin 权限验证工具
 * 
 * 提供统一的 Admin Token 验证函数，用于所有 Admin API 路由
 */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { DBService } from './mockData';

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
 * @param request 请求对象（可选，用于从 Cookie 中读取 adminToken）
 * @returns AdminAuthResult 验证结果
 */
export async function verifyAdminToken(request?: Request | NextRequest): Promise<AdminAuthResult> {
  try {
    // 从 Cookie 中读取 adminToken
    const cookieStore = await cookies();
    const adminToken = cookieStore.get('adminToken');

    // 调试日志：打印 Token 信息
    console.log('🔍 [verifyAdminToken] 开始验证 Admin Token');
    console.log(`   adminToken exists: ${!!adminToken}`);
    console.log(`   adminToken value: ${adminToken?.value ? adminToken.value.substring(0, 50) + '...' : 'N/A'}`);

    // 检查 Token 是否存在
    if (!adminToken || !adminToken.value) {
      console.error('❌ [verifyAdminToken] Admin Token 不存在');
      return {
        success: false,
        error: 'Unauthorized. Admin access required.',
        statusCode: 401,
      };
    }

    // Token 格式: admin-token-{userId}-{timestamp}-{random}
    // 其中 userId 是完整的 UUID（包含连字符），例如: e6311bd7-f882-491f-86d0-d5222785be34
    const tokenParts = adminToken.value.split('-');
    console.log(`🔍 [verifyAdminToken] Token 解析:`, {
      tokenLength: adminToken.value.length,
      partsCount: tokenParts.length,
      parts: tokenParts.slice(0, 8),
      fullToken: adminToken.value,
    });

    if (tokenParts.length < 8 || tokenParts[0] !== 'admin' || tokenParts[1] !== 'token') {
      console.error('❌ [verifyAdminToken] Token 格式无效:', {
        partsCount: tokenParts.length,
        part0: tokenParts[0],
        part1: tokenParts[1],
        fullToken: adminToken.value,
      });
      return {
        success: false,
        error: 'Invalid admin token format.',
        statusCode: 401,
      };
    }

    // UUID 格式: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (5个部分)
    // Token 分割后: ['admin', 'token', 'e6311bd7', 'f882', '491f', '86d0', 'd5222785be34', timestamp, random]
    // userId 应该是 parts[2] 到 parts[6] 的组合（5个部分）
    const userId = tokenParts.slice(2, 7).join('-'); // 组合 UUID 的 5 个部分
    console.log(`🔍 [verifyAdminToken] 提取的 userId: ${userId}`);

    // 从数据库验证用户是否存在且为管理员
    const user = await DBService.findUserById(userId);
    console.log(`🔍 [verifyAdminToken] 用户查找结果:`, {
      userExists: !!user,
      userId: user?.id,
      email: user?.email,
      isAdmin: user?.isAdmin,
      isBanned: user?.isBanned,
    });

    if (!user) {
      console.error('❌ [verifyAdminToken] 用户不存在:', userId);
      return {
        success: false,
        error: 'Admin user not found.',
        statusCode: 401,
      };
    }

    // 验证用户是否为管理员
    if (!user.isAdmin) {
      console.error('❌ [verifyAdminToken] 用户不是管理员:', {
        userId: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
      });
      return {
        success: false,
        error: 'User is not an administrator.',
        statusCode: 403,
      };
    }

    // 验证账户是否被禁用
    if (user.isBanned) {
      console.error('❌ [verifyAdminToken] 管理员账户被禁用:', {
        userId: user.id,
        email: user.email,
      });
      return {
        success: false,
        error: 'Admin account is banned.',
        statusCode: 403,
      };
    }

    // 验证通过
    console.log('✅ [verifyAdminToken] Token 验证成功:', {
      userId: user.id,
      email: user.email,
    });
    return {
      success: true,
      userId: user.id,
    };
  } catch (error) {
    console.error('❌ [verifyAdminToken] Token 验证异常:', error);
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

