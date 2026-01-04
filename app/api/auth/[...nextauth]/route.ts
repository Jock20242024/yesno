import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

// 🔥 修复：添加错误处理包装
let handlers: ReturnType<typeof NextAuth>;

try {
  handlers = NextAuth(authOptions);
} catch (error: any) {
  console.error('❌ [NextAuth Route] 初始化失败:', error?.message || error);
  // 如果初始化失败，创建默认的 handlers（仅支持 credentials）
  handlers = NextAuth({
    ...authOptions,
    providers: authOptions.providers.filter((p: any) => p.id === 'credentials'),
  });
}

// NextAuth v5 使用 handlers 并直接导出 GET 和 POST
const { GET: originalGET, POST: originalPOST } = handlers;

// 🔥 修复：包装 GET 和 POST 以添加错误处理
export const GET = async (request: Request) => {
  try {
    return await originalGET(request);
  } catch (error: any) {
    console.error('❌ [NextAuth GET] 错误:', error?.message || error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
};

export const POST = async (request: Request) => {
  try {
    return await originalPOST(request);
  } catch (error: any) {
    console.error('❌ [NextAuth POST] 错误:', error?.message || error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
};

// Note: auth function is exported from @/lib/authExport to avoid route type validation errors
