/**
 * 用户余额查询 API
 * GET /api/user/balance
 * 
 * 生产环境最高优先级逻辑：
 * - 无论何种错误，一律返回状态码 200
 * - 确保前端始终能解析到有效的 JSON 数据
 * - 彻底移除 500 状态码，防止 UI 崩溃
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/authExport";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // 🔍 临时调试开关：检查浏览器是否发送了 Cookie
    const cookieHeader = request.headers.get('cookie');

    // 1. 获取 Session
    let session;
    try {
      session = await auth();

    } catch (sessionError) {
      console.error("❌ [Balance API] Session fetch failed:", sessionError);
      // 即使 session 获取失败，也返回 200 状态码，避免前端崩溃
      const response = NextResponse.json({ balance: 0 }, { status: 200 });
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      return response;
    }

    // 2. 检查 session 和 email
    if (!session?.user?.email) {

      const response = NextResponse.json({ balance: 0 }, { status: 200 });
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      return response;
    }

    // 3. 查询数据库（确保使用 email 查询）
    const userEmail = session.user.email;

    let user;
    try {
      user = await prisma.users.findUnique({
        where: { email: userEmail }, // 确保使用 session.user.email 查询
        select: { 
          id: true,
          email: true,
          balance: true 
        }
      });
      
      if (user) {

      } else {

      }
    } catch (dbError) {
      console.error("CRITICAL API ERROR: Database query failed:", dbError);
      // 数据库查询失败，返回 0，但状态码仍然是 200
      const response = NextResponse.json({ balance: 0 }, { status: 200 });
      response.headers.set('Cache-Control', 'no-store');
      return response;
    }

    // 4. 返回余额（确保是数字类型，即使是 null 也返回 0）
    const balance = user?.balance ? parseFloat(user.balance.toString()) : 0;

    const response = NextResponse.json({ balance }, { status: 200 });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    return response;

  } catch (error) {
    // 5. 捕获所有未预期的错误
    console.error("CRITICAL API ERROR:", error);
    
    // 即使服务器崩了，也给前端一个 0，防止 500 报错导致 UI 崩溃
    // 关键：状态码必须是 200，不是 500
    const response = NextResponse.json({ balance: 0 }, { status: 200 });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
}
