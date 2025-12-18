import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. 获取 Session (NextAuth v5 使用 auth() 函数)
    const session = await auth();
    console.log('🔍 [Auth Me API] Session User Email:', session?.user?.email);

    // 🔥 架构修复：防崩溃返回 - 即使 auth() 返回为 null，也不要直接让前端报错
    // 如果 session 为空，返回 { isLoggedIn: false, user: null } 并带上 status: 200（不要给 401）
    // 这样可以阻止前端 AuthProvider 触发无限登出清理逻辑
    if (!session || !session.user?.email) {
      console.log('🔒 [Auth Me API] No session or email, returning 200 with isLoggedIn: false');
      return NextResponse.json({ 
        isLoggedIn: false, 
        user: null 
      }, { status: 200 });
    }

    // 3. 查数据库获取完整信息 (余额、isAdmin等)
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        email: true,
        provider: true,
        isAdmin: true,
        balance: true, // 确保前端能拿到余额
      },
    });

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
        isAdmin: user.isAdmin || false,
        balance: user.balance || 0,
      },
    });
  } catch (error) {
    console.error("Me API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
