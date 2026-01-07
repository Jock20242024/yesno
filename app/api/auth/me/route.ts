import { NextResponse } from "next/server";
import { auth } from "@/lib/authExport";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. 获取 Session (NextAuth v5 使用 auth() 函数)
    const session = await auth();

    // 🔥 架构修复：防崩溃返回 - 即使 auth() 返回为 null，也不要直接让前端报错
    // 如果 session 为空，返回 { isLoggedIn: false, user: null } 并带上 status: 200（不要给 401）
    // 这样可以阻止前端 AuthProvider 触发无限登出清理逻辑
    if (!session || !session.user?.email) {

      return NextResponse.json({ 
        isLoggedIn: false, 
        user: null 
      }, { status: 200 });
    }

    // 3. 查数据库获取完整信息 (余额、isAdmin等)
    // 🔥 修复：添加连接检查和重试逻辑
    let user;
    try {
      await prisma.$connect();
      user = await prisma.users.findUnique({
        where: { email: session.user.email },
        select: {
          id: true,
          email: true,
          provider: true,
          isAdmin: true,
          balance: true, // 确保前端能拿到余额
        },
      });
    } catch (dbError: any) {
      console.error('❌ [Me API] 数据库查询失败:', dbError);
      if (dbError.message?.includes('Engine is not yet connected') || 
          dbError.message?.includes('Engine was empty')) {
        try {
          await new Promise(resolve => setTimeout(resolve, 100));
          await prisma.$connect();
          user = await prisma.users.findUnique({
            where: { email: session.user.email },
            select: {
              id: true,
              email: true,
              provider: true,
              isAdmin: true,
              balance: true,
            },
          });
        } catch (retryError) {
          console.error('❌ [Me API] 重试查询失败:', retryError);
          // 降级：返回session信息，但balance为0
          return NextResponse.json({
            success: true,
            user: {
              id: session.user.id || '',
              email: session.user.email || '',
              provider: (session.user as any).provider || null,
              isAdmin: (session.user as any).isAdmin || false,
              balance: 0, // 降级：返回0
            },
          });
        }
      } else {
        // 其他错误也降级处理
        return NextResponse.json({
          success: true,
          user: {
            id: session.user.id || '',
            email: session.user.email || '',
            provider: (session.user as any).provider || null,
            isAdmin: (session.user as any).isAdmin || false,
            balance: 0, // 降级：返回0
          },
        });
      }
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 4. 返回成功数据
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        provider: user.provider,
        isAdmin: user.isAdmin === true, // 🔥 确保如果数据库中是 true，API 必须返回 true
        balance: user.balance || 0,
        avatar: (user as any).avatar || "", // 确保字段存在，即使数据库中没有该字段也返回空字符串
      },
    });
  } catch (error) {
    console.error("Me API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
