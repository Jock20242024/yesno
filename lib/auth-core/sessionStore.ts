/**
 * Auth Core - Session 存储
 * 使用数据库表 auth_sessions 存储 session 数据
 */

import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

// Session 有效期：7天（毫秒）
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 创建新的 session
 * @param userId 用户 ID
 * @returns sessionId (UUID)
 */
export async function createSession(userId: string): Promise<string> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_EXPIRY_MS);
  
  const session = await prisma.authSession.create({
    data: {
      id: randomUUID(),
      userId,
      expiresAt,
    },
  });
  
  console.log("SESSION CREATED", session.id);
  
  // 清理过期 session
  await cleanupExpiredSessions();
  
  return session.id;
}

/**
 * 获取 session 数据
 * @param sessionId session ID
 * @returns userId 或 null（如果 session 不存在或已过期）
 */
export async function getSession(sessionId: string): Promise<string | null> {
  const session = await prisma.authSession.findUnique({
    where: { id: sessionId },
  });
  
  if (!session) {
    return null;
  }
  
  // 检查是否过期
  if (new Date() > session.expiresAt) {
    await deleteSession(sessionId);
    return null;
  }
  
  return session.userId;
}

/**
 * 删除 session
 * @param sessionId session ID
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await prisma.authSession.delete({
    where: { id: sessionId },
  }).catch(() => {
    // 忽略删除不存在的 session 的错误
  });
}

/**
 * 清理过期 session
 */
async function cleanupExpiredSessions(): Promise<void> {
  await prisma.authSession.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });
}
