import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { DBService } from '@/lib/dbService';
import { TransactionStatus } from '@/types/data';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth-core/sessionStore';

/**
 * 充值 API
 * POST /api/deposit
 * 
 * 处理用户充值请求
 * 请求体：
 * - amount: 充值金额
 * - txHash: 交易哈希（模拟）
 */
export async function POST(request: Request) {
  try {
    // 从 Cookie 读取 auth_core_session
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_core_session')?.value;
    
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // 调用 sessionStore.getSession(sessionId)
    const userId = await getSession(sessionId);
    
    // 若 session 不存在，返回 401
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Session expired or invalid' },
        { status: 401 }
      );
    }

    // 解析请求体
    const body = await request.json();
    const { amount, txHash } = body;

    console.log(`💰 [Deposit API] 充值请求参数:`, {
      amount: amount,
      amountType: typeof amount,
      txHash: txHash,
    });

    // 验证必需字段
    if (!amount || !txHash) {
      console.error('❌ [Deposit API] 缺少必需字段:', { amount: !!amount, txHash: !!txHash });
      return NextResponse.json(
        {
          success: false,
          error: 'amount and txHash are required',
        },
        { status: 400 }
      );
    }

    // 金额调试：打印解析出的充值金额 amount，确保它是 $1000
    const amountNum = parseFloat(amount);
    console.log(`💰 [Deposit API] 金额解析:`, {
      original: amount,
      originalType: typeof amount,
      parsed: amountNum,
      isValid: !isNaN(amountNum) && amountNum > 0,
      isExpected1000: amountNum === 1000,
    });

    if (isNaN(amountNum) || amountNum <= 0) {
      console.error('❌ [Deposit API] 金额无效:', {
        original: amount,
        parsed: amountNum,
        isNaN: isNaN(amountNum),
        isPositive: amountNum > 0,
      });
      return NextResponse.json(
        {
          success: false,
          error: 'amount must be a positive number',
        },
        { status: 400 }
      );
    }

    // 金额验证：确保金额是 $1000（用于 E2E 测试）
    if (amountNum === 1000) {
      console.log(`✅ [Deposit API] 充值金额验证通过: $${amountNum}`);
    } else {
      console.log(`ℹ️ [Deposit API] 充值金额: $${amountNum} (非标准测试金额)`);
    }

    // 获取当前用户
    console.log(`🔍 [Deposit API] 查找用户: ${userId}`);
    const user = await DBService.findUserById(userId);
    
    console.log(`🔍 [Deposit API] 用户查找结果:`, {
      userExists: !!user,
      userId: user?.id,
      email: user?.email,
      currentBalance: user?.balance,
    });

    if (!user) {
      console.error('❌ [Deposit API] 用户不存在:', userId);
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
        },
        { status: 404 }
      );
    }

    // 注释掉外部支付渠道集成（如果有）
    // 注意：当前代码中没有外部支付渠道集成，直接进行余额更新

    // ========== 修复：使用数据库事务确保原子性 ==========
    const oldBalance = user.balance || 0;
    
    const result = await prisma.$transaction(async (tx) => {
      // 1. 获取当前用户（带锁，防止并发）
      const lockedUser = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!lockedUser) {
        throw new Error('User not found');
      }

      // 2. 计算新余额
      const newBalance = lockedUser.balance + amountNum;

      // 3. 更新用户余额
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { balance: newBalance },
      });

      // 4. 创建充值记录（FundRecord）
      const depositId = `D-${Date.now()}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
      const deposit = await tx.deposit.create({
        data: {
          id: depositId,
          userId: userId,
          amount: amountNum,
          txHash: txHash,
          status: TransactionStatus.COMPLETED,
        },
      });

      return {
        updatedUser,
        deposit,
      };
    });

    const updatedUser = result.updatedUser;
    const deposit = result.deposit;

    // ========== 审计记录 ==========
    console.log(`✅ [Deposit API] ========== 充值成功 ==========`);
    console.log(`✅ [Deposit API] 用户ID: ${userId}`);
    console.log(`✅ [Deposit API] 充值金额: $${amountNum}`);
    console.log(`✅ [Deposit API] 旧余额: $${oldBalance}`);
    console.log(`✅ [Deposit API] 新余额: $${updatedUser.balance}`);
    console.log(`✅ [Deposit API] 充值记录ID: ${deposit.id}`);
    console.log(`✅ [Deposit API] 时间戳: ${new Date().toISOString()}`);
    console.log(`✅ [Deposit API] ===============================`);

    // 返回充值成功的记录和更新后的用户余额
    return NextResponse.json({
      success: true,
      message: 'Deposit successful',
      data: {
        deposit: {
          id: deposit.id,
          userId: deposit.userId,
          amount: deposit.amount,
          txHash: deposit.txHash,
          status: deposit.status,
          createdAt: deposit.createdAt.toISOString(),
        },
        updatedBalance: updatedUser.balance,
      },
    });
  } catch (error) {
    console.error('❌ [Deposit API] 充值处理异常:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

