/**
 * 管理后台 - 用户余额调整 API
 * POST /api/admin/users/balance
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/authExport";
import { prisma } from '@/lib/prisma';
import { TransactionType, TransactionStatus } from '@prisma/client';

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // 1. 权限校验：必须是管理员
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // @ts-ignore - session.user.isAdmin 在 NextAuth callback 中已设置
    if (!session.user.isAdmin) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    // 2. 解析请求体
    const body = await request.json();
    const { userId, amount, reason } = body;

    // 3. 参数验证
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { success: false, error: "Invalid userId" },
        { status: 400 }
      );
    }

    if (typeof amount !== 'number' || amount === 0) {
      return NextResponse.json(
        { success: false, error: "Amount must be a non-zero number" },
        { status: 400 }
      );
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Reason is required" },
        { status: 400 }
      );
    }

    // 4. 检查用户是否存在（根据管理员选中的 userId）
    console.log(`🔍 [Admin Balance API] Querying user with id: ${userId}`);
    const user = await prisma.user.findUnique({
      where: { id: userId }, // 使用管理员选中的 userId 查询
      select: { 
        id: true, 
        email: true,
        balance: true 
      },
    });

    if (!user) {
      console.log(`[API] User not found with id: ${userId}`);
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }
    
    console.log(`[API] Found user: ${user.email}, Current balance: ${user.balance}`);

    // 5. 检查余额是否足够（如果是扣款）
    if (amount < 0 && user.balance + amount < 0) {
      return NextResponse.json(
        { success: false, error: "Insufficient balance" },
        { status: 400 }
      );
    }

    // 6. 使用事务更新余额并创建交易记录（确保原子性）
    console.log(`🔄 [Admin Balance API] Starting transaction to update balance for user: ${user.email}`);
    const result = await prisma.$transaction(async (tx) => {
      // 确保 amount 是浮点数格式
      const amountFloat = parseFloat(amount.toString());
      const oldBalance = user.balance;
      
      console.log(`🔄 [Admin Balance API] Transaction - User: ${user.email}, Old balance: ${oldBalance}, Adjustment: ${amountFloat}`);
      
      // 更新用户余额（使用浮点数 increment，更新同一个 balance 字段）
      const updatedUser = await tx.user.update({
        where: { id: userId }, // 使用管理员选中的 userId 更新
        data: {
          balance: {
            increment: amountFloat, // 使用浮点数 increment 确保原子性，更新 balance 字段
          },
        },
        select: {
          id: true,
          balance: true,
          email: true,
        },
      });
      
      // 确保余额是浮点数格式
      const newBalance = parseFloat(updatedUser.balance.toString());
      console.log(`🔄 [Admin Balance API] Transaction - Updated balance: ${newBalance}`);
      
      // 创建交易记录（使用浮点数格式，确保数据库同步）
      const transaction = await tx.transaction.create({
        data: {
          userId, // 使用相同的 userId
          amount: amountFloat, // 使用浮点数格式
          type: TransactionType.ADMIN_ADJUSTMENT,
          status: TransactionStatus.COMPLETED, // 管理员调整立即生效
          reason: reason.trim(),
        },
      });
      
      console.log(`🔄 [Admin Balance API] Transaction - Created transaction record: ${transaction.id}`);

      return { user: { ...updatedUser, balance: newBalance }, transaction };
    });
    
    console.log(`✅ [Admin Balance API] Transaction completed successfully for user: ${result.user.email}`);

    // 7. 记录管理员操作日志
    try {
      await prisma.adminLog.create({
        data: {
          adminId: session.user.id as string,
          actionType: 'BALANCE_ADJUSTMENT',
          details: `调整用户 ${result.user.email} (${userId}) 余额: ${amount > 0 ? '+' : ''}${amount.toFixed(2)}，原因: ${reason.trim()}`,
        },
      });
    } catch (logError) {
      // 日志记录失败不影响主流程，只记录错误
      console.error("Failed to create admin log:", logError);
    }

    // 确保返回的余额是浮点数格式
    const finalBalance = parseFloat(result.user.balance.toString());
    
    console.log(`[API] Found user: ${result.user.email}, Current balance: ${finalBalance}`);
    console.log(`✅ [Admin Balance API] 余额调整成功:`, {
      userId: result.user.id,
      userEmail: result.user.email,
      adjustment: amount,
      oldBalance: user.balance,
      newBalance: finalBalance,
      transactionId: result.transaction.id,
    });

    return NextResponse.json({
      success: true,
      data: {
        userId: result.user.id,
        newBalance: finalBalance, // 明确返回浮点数格式
        adjustment: parseFloat(amount.toString()),
        transactionId: result.transaction.id,
      },
    });
  } catch (error) {
    console.error("Admin balance adjustment API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
