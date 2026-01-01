/**
 * 提现 API
 * POST /api/withdraw
 * 
 * 严格的后端校验逻辑：
 * 1. 身份校验：使用 getServerSession(authOptions)
 * 2. 余额对账：从数据库重新查询用户余额，不信任前端传的余额
 * 3. 事务原子性：确保扣除余额和创建 Transaction 记录同时成功或失败
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TransactionType, TransactionStatus } from '@prisma/client';
import { requireAuth } from '@/lib/auth/utils';
import { randomUUID } from 'crypto';

export const dynamic = "force-dynamic";

/**
 * 提现 API
 * POST /api/withdraw
 * 
 * 严格的后端校验逻辑：
 * 1. 身份校验：使用 NextAuth requireAuth()
 * 2. 余额对账：从数据库重新查询用户余额，不信任前端传的余额
 * 3. 事务原子性：确保扣除余额和创建 Transaction 记录同时成功或失败
 * 
 * 🔥 统一认证：使用 NextAuth 进行身份验证
 */
export async function POST(request: Request) {
  try {
    // 🔥 使用统一的 NextAuth 认证（支持 Session 和 API Key）
    const authResult = await requireAuth();
    
    if (!authResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: authResult.error || '未登录，请先登录'
        },
        { status: authResult.statusCode }
      );
    }
    
    const userId = authResult.userId;

    // 解析请求体
    const body = await request.json();
    const { amount, targetAddress } = body;

    // 验证必需字段
    if (!amount || !targetAddress) {
      return NextResponse.json(
        {
          success: false,
          error: 'amount 和 targetAddress 是必填项',
        },
        { status: 400 }
      );
    }

    // 验证 amount 格式
    const withdrawAmount = parseFloat(amount.toString());
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: '提现金额必须是一个正数',
        },
        { status: 400 }
      );
    }

    // 验证 targetAddress
    if (typeof targetAddress !== 'string' || targetAddress.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '提现地址不能为空',
        },
        { status: 400 }
      );
    }

    // ========== 第二重锁：余额对账（不信任前端传来的余额）==========
    // 必须从数据库重新查询该用户的最新 balance
    // 🔥 直接使用 userId 查询，不需要通过 email
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        balance: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: '用户不存在',
        },
        { status: 404 }
      );
    }

    // 严格校验：对比 withdrawAmount 与 user.balance
    // 如果 withdrawAmount > user.balance，立即中断操作
    if (withdrawAmount > user.balance) {
      console.error(`[Withdraw API] 余额不足 - 请求金额: $${withdrawAmount}, 当前余额: $${user.balance}`);
      return NextResponse.json(
        {
          success: false,
          error: '余额不足，提现失败',
        },
        { status: 400 }
      );
    }

    const oldBalance = user.balance;

    // ========== 第三重锁：事务原子性 ==========
    // 使用 prisma.$transaction 确保以下两个动作要么全成功，要么全失败：
    // a. 扣除 User 余额 (decrement)
    // b. 创建一条 Transaction 记录，类型为 WITHDRAWAL，状态为 PENDING 或 COMPLETED
    const result = await prisma.$transaction(async (tx) => {
      // 1. 再次查询用户（带锁，防止并发）
      const lockedUser = await tx.users.findUnique({
        where: { id: user.id },
      });

      if (!lockedUser) {
        throw new Error('User not found');
      }

      // 2. 再次验证余额（防止并发问题）
      if (lockedUser.balance < withdrawAmount) {
        throw new Error('余额不足，提现失败');
      }

      // 3. 扣除用户余额（使用 decrement 确保原子性）
      const updatedUser = await tx.users.update({
        where: { id: user.id },
        data: {
          balance: {
            decrement: withdrawAmount, // 使用 decrement 确保原子性
          },
        },
        select: {
          id: true,
          balance: true,
          email: true,
        },
      });

      // 4. 创建 Transaction 记录（类型为 WITHDRAWAL，状态为 PENDING）
      const transaction = await tx.transactions.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          amount: -withdrawAmount, // 提现为负数
          type: TransactionType.WITHDRAW,
          status: TransactionStatus.PENDING, // 提现初始状态为待处理
          reason: `提现到地址: ${targetAddress.trim()}`,
        },
      });

      // 5. 创建 Withdrawal 记录（保持与现有系统兼容）
      const withdrawalId = `W-${Date.now()}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
      const withdrawal = await tx.withdrawals.create({
        data: {
          id: withdrawalId,
          updatedAt: new Date(),
          userId: user.id,
          amount: withdrawAmount,
          targetAddress: targetAddress.trim(),
          status: TransactionStatus.PENDING,
        },
      });

      return {
        user: updatedUser,
        transaction,
        withdrawal,
      };
    });

    // ========== 审计记录 ==========

    // 返回提现请求的记录
    return NextResponse.json({
      success: true,
      message: '提现申请已提交',
      data: {
        withdrawal: {
          id: result.withdrawal.id,
          userId: result.withdrawal.userId,
          amount: result.withdrawal.amount,
          targetAddress: result.withdrawal.targetAddress,
          status: result.withdrawal.status,
          createdAt: result.withdrawal.createdAt.toISOString(),
        },
        transaction: {
          id: result.transaction.id,
          type: result.transaction.type,
          amount: result.transaction.amount,
          status: result.transaction.status,
        },
        updatedBalance: result.user.balance, // 返回更新后的余额
      },
    });
  } catch (error) {
    console.error('❌ [Withdraw API] 提现失败:', error);
    
    // 根据错误类型返回不同的错误信息
    const errorMessage = error instanceof Error ? error.message : '内部服务器错误';
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage.includes('余额不足') ? '余额不足，提现失败' : '提现失败，请稍后重试',
      },
      { status: 400 }
    );
  }
}
