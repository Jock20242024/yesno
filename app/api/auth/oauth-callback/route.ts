/**
 * OAuth 回调处理
 * 在 NextAuth OAuth 登录成功后，同步创建 auth_core_session Cookie
 */

/**
 * OAuth 回调处理
 * 在 NextAuth OAuth 登录成功后，同步创建 auth_core_session Cookie
 * 这个 API 会被 NextAuth 的 redirect callback 调用
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/authExport";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth-core/sessionStore";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    // 等待一小段时间确保 NextAuth session 已创建
    await new Promise((resolve) => setTimeout(resolve, 100));

    const session = await auth();

    if (!session || !session.user?.email) {
      console.error("OAuth callback: No session found");
      return NextResponse.redirect(new URL("/login?error=OAuthFailed", request.url));
    }

    const email = session.user.email.toLowerCase().trim();

    // 查找用户
    const dbUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!dbUser) {
      console.error("OAuth callback: User not found", email);
      return NextResponse.redirect(new URL("/login?error=UserNotFound", request.url));
    }

    // 创建 session 并设置 Cookie（与现有系统对齐）
    const sessionId = await createSession(dbUser.id);
    const cookieStore = await cookies();

    cookieStore.set("auth_core_session", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 天
      path: "/",
    });

    cookieStore.set("auth_user_id", dbUser.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 天
      path: "/",
    });

    // 重定向到首页或指定的 callbackUrl
    const callbackUrl = request.nextUrl.searchParams.get("callbackUrl") || "/";
    const baseUrl = request.nextUrl.origin;
    const redirectUrl = callbackUrl.startsWith("http") ? callbackUrl : `${baseUrl}${callbackUrl}`;
    
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(new URL("/login?error=InternalError", request.url));
  }
}
