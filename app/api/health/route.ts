import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRedisClient } from '@/lib/redis';

/**
 * GET /api/health
 * 健康检查接口：测试数据库和 Redis 连接状态
 */
export async function GET() {
  const results = {
    database: {
      connected: false,
      error: null as string | null,
    },
    redis: {
      connected: false,
      error: null as string | null,
    },
    timestamp: new Date().toISOString(),
  };

  // 测试数据库连接
  try {
    await prisma.$queryRaw`SELECT 1`;
    results.database.connected = true;
  } catch (error: any) {
    results.database.connected = false;
    results.database.error = error.message || 'Database connection failed';
  }

  // 测试 Redis 连接
  try {
    const redis = getRedisClient();
    if (!redis) {
      results.redis.connected = false;
      results.redis.error = 'Redis client is null (REDIS_URL not configured)';
    } else {
      await redis.ping();
      results.redis.connected = true;
    }
  } catch (error: any) {
    results.redis.connected = false;
    results.redis.error = error.message || 'Redis connection failed';
  }

  // 返回结果
  const statusCode = results.database.connected && results.redis.connected ? 200 : 503;
  
  return NextResponse.json(results, { status: statusCode });
}

