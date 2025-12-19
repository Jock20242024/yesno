console.log("🔥 NextAuth API 被触发");

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// NextAuth v5 使用 handlers 并直接导出 GET 和 POST
// 同时导出 auth 函数供其他 API 路由使用
const { handlers, auth } = NextAuth(authOptions);
export const { GET, POST } = handlers;
export { auth };
