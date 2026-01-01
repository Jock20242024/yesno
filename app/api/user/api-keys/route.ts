import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/utils';
import { generateApiKey, getApiKeyPrefix, hashApiKey, maskApiKey } from '@/lib/utils/apiKey';
import { randomUUID } from 'crypto';

/**
 * 获取用户的 API Keys 列表
 * GET /api/user/api-keys
 */
export async function GET(request: Request) {
  try {
    // 身份验证
    const authResult = await requireAuth();
    if (!authResult.success || !authResult.userId) {
      const statusCode = 'statusCode' in authResult ? authResult.statusCode : 401;
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: statusCode }
      );
    }

    const userId = authResult.userId;

    // 查询用户的 API Keys（不返回完整 Key）
    const apiKeys = await prisma.api_keys.findMany({
      where: { userId },
      select: {
        id: true,
        label: true,
        keyPrefix: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // 为每个 Key 生成掩码显示
    const maskedKeys = apiKeys.map((key) => ({
      id: key.id,
      label: key.label,
      keyPrefix: key.keyPrefix,
      maskedKey: maskApiKey(key.keyPrefix + '...'), // 生成掩码显示
      lastUsedAt: key.lastUsedAt?.toISOString() || null,
      createdAt: key.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: maskedKeys,
    });
  } catch (error: any) {
    console.error('❌ [API Keys GET] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch API keys',
      },
      { status: 500 }
    );
  }
}

/**
 * 创建新的 API Key
 * POST /api/user/api-keys
 * 
 * Body: { label: string }
 * 
 * 返回完整 Key（仅此一次）
 */
export async function POST(request: Request) {
  try {
    // 身份验证
    const authResult = await requireAuth();
    if (!authResult.success || !authResult.userId) {
      const statusCode = 'statusCode' in authResult ? authResult.statusCode : 401;
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: statusCode }
      );
    }

    const userId = authResult.userId;
    const body = await request.json();
    const { label } = body;

    // 验证 label
    if (!label || typeof label !== 'string' || label.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Label is required' },
        { status: 400 }
      );
    }

    // 生成新的 API Key
    const fullKey = generateApiKey();
    const keyPrefix = getApiKeyPrefix(fullKey);
    const keyHash = hashApiKey(fullKey);

    // 保存到数据库
    const apiKey = await prisma.api_keys.create({
      data: {
        id: randomUUID(),
        userId,
        label: label.trim(),
        keyPrefix,
        keyHash,
      },
      select: {
        id: true,
        label: true,
        keyPrefix: true,
        createdAt: true,
      },
    });

    // ⚠️ 重要：仅在创建时返回完整 Key，之后无法再查看
    return NextResponse.json({
      success: true,
      data: {
        ...apiKey,
        fullKey, // 完整 Key，仅此一次返回
      },
      createdAt: apiKey.createdAt.toISOString(),
    });
  } catch (error: any) {
    console.error('❌ [API Keys POST] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create API key',
      },
      { status: 500 }
    );
  }
}

/**
 * 删除 API Key
 * DELETE /api/user/api-keys
 * 
 * Body: { id: string }
 */
export async function DELETE(request: Request) {
  try {
    // 身份验证
    const authResult = await requireAuth();
    if (!authResult.success || !authResult.userId) {
      const statusCode = 'statusCode' in authResult ? authResult.statusCode : 401;
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: statusCode }
      );
    }

    const userId = authResult.userId;
    const body = await request.json();
    const { id } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'API Key ID is required' },
        { status: 400 }
      );
    }

    // 验证该 Key 属于当前用户
    const apiKey = await prisma.api_keys.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API Key not found' },
        { status: 404 }
      );
    }

    if (apiKey.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // 删除
    await prisma.api_keys.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'API Key deleted successfully',
    });
  } catch (error: any) {
    console.error('❌ [API Keys DELETE] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete API key',
      },
      { status: 500 }
    );
  }
}

