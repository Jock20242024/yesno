import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/utils';

/**
 * 用户返佣数据 API
 * GET /api/profile/referrals
 * 
 * 返回当前用户的返佣统计和受邀用户列表
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

    // 1. 获取用户的邀请码和基本信息
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        referralCode: true,
        email: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // 2. 统计总返佣收益（聚合 CommissionLog）
    const totalEarningsResult = await prisma.commission_logs.aggregate({
      where: { beneficiaryId: userId },
      _sum: { amount: true },
    });
    const totalEarnings = totalEarningsResult._sum.amount || 0;

    // 3. 统计已邀请用户数量
    const invitedCount = await prisma.users.count({
      where: { invitedById: userId },
    });

    // 4. 获取受邀用户列表（分页）
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const referredUsers = await prisma.users.findMany({
      where: { invitedById: userId },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // 5. 为每个受邀用户计算贡献金额（他们产生的返佣总和）
    const referredUsersWithContribution = await Promise.all(
      referredUsers.map(async (refUser) => {
        const contributionResult = await prisma.commission_logs.aggregate({
          where: {
            beneficiaryId: userId,
            sourceUserId: refUser.id,
          },
          _sum: { amount: true },
        });
        const contribution = contributionResult._sum.amount || 0;

        return {
          id: refUser.id,
          username: refUser.email.split('@')[0], // 使用邮箱前缀作为用户名
          registeredAt: refUser.createdAt.toISOString(),
          contribution,
        };
      })
    );

    // 构建邀请链接
    const referralLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://yesno-app.com'}/register?ref=${user.referralCode}`;

    return NextResponse.json({
      success: true,
      data: {
        referralCode: user.referralCode,
        referralLink,
        totalEarnings,
        invitedCount,
        referredUsers: referredUsersWithContribution,
        pagination: {
          page,
          pageSize,
          total: invitedCount,
          totalPages: Math.ceil(invitedCount / pageSize),
        },
      },
    });
  } catch (error: any) {
    console.error('❌ [Profile Referrals API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch referral data',
      },
      { status: 500 }
    );
  }
}

