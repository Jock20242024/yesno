/**
 * @deprecated 此文件已标记为 deprecated，作为对照组存在
 * Session 管理工具
 * 使用内存 Map 存储 session 数据
 * 
 * 对照组说明：
 * - 使用 HttpOnly Cookie: auth_session
 * - Session 数据存储在内存 Map
 * - 完整的注册/登录/登出/刷新/Admin 闭环实现
 */

import { randomUUID } from 'crypto';

// Session 数据接口
interface SessionData {
  userId: string;
  createdAt: number;
  expiresAt: number;
}

// 内存存储 session 数据 (sessionId -> SessionData)
const sessionStore = new Map<string, SessionData>();

// Session 有效期：7天（毫秒）
const SESSION_EXPIRY = 7 * 24 * 60 * 60 * 1000;

/**
 * 创建新的 session
 * @param userId 用户 ID
 * @returns sessionId (UUID)
 */
export function createSession(userId: string): string {
  // 生成 UUID v4
  const sessionId = `sess_${randomUUID()}`;
  
  const now = Date.now();
  const sessionData: SessionData = {
    userId,
    createdAt: now,
    expiresAt: now + SESSION_EXPIRY,
  };
  
  sessionStore.set(sessionId, sessionData);
  
  // 清理过期 session（异步）
  cleanupExpiredSessions();
  
  return sessionId;
}

/**
 * 获取 session 数据
 * @param sessionId session ID
 * @returns userId 或 null（如果 session 不存在或已过期）
 */
export function getSession(sessionId: string): string | null {
  const session = sessionStore.get(sessionId);
  
  if (!session) {
    return null;
  }
  
  // 检查是否过期
  if (Date.now() > session.expiresAt) {
    sessionStore.delete(sessionId);
    return null;
  }
  
  return session.userId;
}

/**
 * 删除 session
 * @param sessionId session ID
 */
export function deleteSession(sessionId: string): void {
  sessionStore.delete(sessionId);
}

/**
 * 清理过期 session
 */
function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [sessionId, session] of sessionStore.entries()) {
    if (now > session.expiresAt) {
      sessionStore.delete(sessionId);
    }
  }
}
