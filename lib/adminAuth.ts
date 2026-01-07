/**
 * 🔥 统一的管理员权限验证工具
 * 
 * 此文件提供统一的管理员权限验证函数，确保所有管理员 API 使用相同的验证逻辑
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/authExport';
import { prisma } from '@/lib/prisma';

/**
 * 管理员权限验证结果
 */
export interface AdminAuthResult {
  success: boolean;
  isAdmin: boolean;
  userId?: string;
  userEmail?: string;
  error?: string;
  statusCode?: number;
}

/**
 * 🔥 统一的管理员权限验证函数
 * 
 * 验证逻辑（按优先级）：
 * 1. 检查 NextAuth session 中的 isAdmin 字段（必须为 true）
 * 2. 如果 isAdmin 不存在，从数据库查询用户的 isAdmin 字段
 * 3. 如果数据库查询失败，返回未授权
 * 
 * @param request NextRequest 对象（可选，用于获取 session）
 * @returns AdminAuthResult 验证结果
 */
export async function verifyAdminAccess(
  request?: NextRequest
): Promise<AdminAuthResult> {
  try {
    // 1. 获取 NextAuth session
    const session = await auth();
    
    if (!session || !session.user) {
      return {
        success: false,
        isAdmin: false,
        error: 'Unauthorized: No session found',
        statusCode: 401,
      };
    }

    const userId = (session.user as any).id || session.user.email;
    const userEmail = session.user.email;

    if (!userEmail) {
      return {
        success: false,
        isAdmin: false,
        error: 'Unauthorized: No user email in session',
        statusCode: 401,
      };
    }

    // 2. 优先检查 session 中的 isAdmin 字段
    const sessionIsAdmin = (session.user as any).isAdmin;
    
    if (sessionIsAdmin === true) {
      return {
        success: true,
        isAdmin: true,
        userId: userId,
        userEmail: userEmail,
      };
    }

    // 3. 如果 session 中没有 isAdmin，从数据库查询
    try {
      const user = await prisma.users.findUnique({
        where: { email: userEmail },
        select: { id: true, email: true, isAdmin: true },
      });

      if (!user) {
        return {
          success: false,
          isAdmin: false,
          error: 'Unauthorized: User not found',
          statusCode: 401,
        };
      }

      if (user.isAdmin !== true) {
        return {
          success: false,
          isAdmin: false,
          userId: user.id,
          userEmail: user.email,
          error: 'Forbidden: Admin access required',
          statusCode: 403,
        };
      }

      return {
        success: true,
        isAdmin: true,
        userId: user.id,
        userEmail: user.email,
      };
    } catch (dbError: any) {
      console.error('❌ [Admin Auth] 数据库查询失败:', dbError);
      return {
        success: false,
        isAdmin: false,
        error: 'Internal error: Failed to verify admin status',
        statusCode: 500,
      };
    }
  } catch (error: any) {
    console.error('❌ [Admin Auth] 权限验证失败:', error);
    return {
      success: false,
      isAdmin: false,
      error: error.message || 'Unauthorized: Failed to verify admin access',
      statusCode: 401,
    };
  }
}

/**
 * 🔥 创建未授权响应（统一格式）
 */
export function createUnauthorizedResponse(
  error: string = 'Unauthorized. Admin access required.',
  statusCode: number = 401
) {
  return NextResponse.json(
    {
      success: false,
      error: error,
    },
    { status: statusCode }
  );
}

/**
 * 🔥 旧版兼容：verifyAdminToken（保留以兼容现有代码）
 * 
 * @deprecated 请使用 verifyAdminAccess 代替
 */
export async function verifyAdminToken(
  request: NextRequest
): Promise<AdminAuthResult> {
  return verifyAdminAccess(request);
}
